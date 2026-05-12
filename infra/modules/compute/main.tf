################################################################
# modules/compute/main.tf
# Lambdas del proyecto:
#   1) orders_handler    — API REST de pedidos. Publica eventos.
#   2) notifier_handler  — Consume SQS, publica notificaciones a SNS.
#   3) products_handler  — API REST de productos (Etapa D).
#                          Lista bucket S3 y matchea imágenes por slug.
#   4) riders_handler    — API REST de repartidores (Etapa D).
################################################################

terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

################################################################
# Trust policy: AMBAS Lambdas la usan
################################################################
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

################################################################
# ================== Lambda 1: orders_handler ==================
################################################################
data "archive_file" "orders_handler_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambdas/orders_handler"
  output_path = "${path.module}/.build/orders_handler.zip"
}

resource "aws_iam_role" "orders_lambda_role" {
  name               = "${var.resource_prefix}-orders-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# Logs
resource "aws_iam_role_policy_attachment" "orders_lambda_basic_logs" {
  role       = aws_iam_role.orders_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Acceso solo a la tabla de pedidos + permiso para publicar a EventBridge
data "aws_iam_policy_document" "orders_lambda_inline_policy_doc" {
  statement {
    sid    = "DynamoDBOrdersTable"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query",
    ]
    resources = [var.orders_table_arn]
  }

  statement {
    sid       = "EventBridgePutEvents"
    effect    = "Allow"
    actions   = ["events:PutEvents"]
    resources = [var.event_bus_arn]
  }
}

resource "aws_iam_role_policy" "orders_lambda_inline_policy" {
  name   = "${var.resource_prefix}-orders-policy"
  role   = aws_iam_role.orders_lambda_role.id
  policy = data.aws_iam_policy_document.orders_lambda_inline_policy_doc.json
}

resource "aws_cloudwatch_log_group" "orders_lambda_logs" {
  name              = "/aws/lambda/${var.resource_prefix}-orders"
  retention_in_days = 7
}

resource "aws_lambda_function" "orders_handler" {
  function_name    = "${var.resource_prefix}-orders"
  role             = aws_iam_role.orders_lambda_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.orders_handler_zip.output_path
  source_code_hash = data.archive_file.orders_handler_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      ORDERS_TABLE_NAME = var.orders_table_name
      EVENT_BUS_NAME    = var.event_bus_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.orders_lambda_logs]
}

################################################################
# ================ Lambda 2: notifier_handler ==================
################################################################
data "archive_file" "notifier_handler_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambdas/notifier_handler"
  output_path = "${path.module}/.build/notifier_handler.zip"
}

resource "aws_iam_role" "notifier_lambda_role" {
  name               = "${var.resource_prefix}-notifier-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "notifier_lambda_basic_logs" {
  role       = aws_iam_role.notifier_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permisos: leer SQS + publicar a SNS
data "aws_iam_policy_document" "notifier_lambda_inline_policy_doc" {
  statement {
    sid    = "ReadFromNotificationsQueue"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [var.notifications_queue_arn]
  }

  statement {
    sid       = "PublishToAdminAlerts"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [var.admin_alerts_topic_arn]
  }
}

resource "aws_iam_role_policy" "notifier_lambda_inline_policy" {
  name   = "${var.resource_prefix}-notifier-policy"
  role   = aws_iam_role.notifier_lambda_role.id
  policy = data.aws_iam_policy_document.notifier_lambda_inline_policy_doc.json
}

resource "aws_cloudwatch_log_group" "notifier_lambda_logs" {
  name              = "/aws/lambda/${var.resource_prefix}-notifier"
  retention_in_days = 7
}

resource "aws_lambda_function" "notifier_handler" {
  function_name    = "${var.resource_prefix}-notifier"
  role             = aws_iam_role.notifier_lambda_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.notifier_handler_zip.output_path
  source_code_hash = data.archive_file.notifier_handler_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      ADMIN_ALERTS_TOPIC_ARN = var.admin_alerts_topic_arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.notifier_lambda_logs]
}

# Conecta la SQS a la Lambda: cada mensaje invoca el handler
resource "aws_lambda_event_source_mapping" "sqs_to_notifier" {
  event_source_arn = var.notifications_queue_arn
  function_name    = aws_lambda_function.notifier_handler.arn
  batch_size       = 5
}

################################################################
# ================ Lambda 3: products_handler ==================
# Lee tabla `products` + lista bucket de imágenes (matching slug)
################################################################
data "archive_file" "products_handler_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambdas/products_handler"
  output_path = "${path.module}/.build/products_handler.zip"
}

resource "aws_iam_role" "products_lambda_role" {
  name               = "${var.resource_prefix}-products-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "products_lambda_basic_logs" {
  role       = aws_iam_role.products_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permisos: lectura de tabla products + listado del bucket de imágenes
data "aws_iam_policy_document" "products_lambda_inline_policy_doc" {
  statement {
    sid    = "DynamoDBProductsReadOnly"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Scan",
      "dynamodb:Query",
    ]
    resources = [var.products_table_arn]
  }

  statement {
    sid       = "ListImagesBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [var.images_bucket_arn]
  }

  statement {
    sid       = "GetImagesObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${var.images_bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy" "products_lambda_inline_policy" {
  name   = "${var.resource_prefix}-products-policy"
  role   = aws_iam_role.products_lambda_role.id
  policy = data.aws_iam_policy_document.products_lambda_inline_policy_doc.json
}

resource "aws_cloudwatch_log_group" "products_lambda_logs" {
  name              = "/aws/lambda/${var.resource_prefix}-products"
  retention_in_days = 7
}

resource "aws_lambda_function" "products_handler" {
  function_name    = "${var.resource_prefix}-products"
  role             = aws_iam_role.products_lambda_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.products_handler_zip.output_path
  source_code_hash = data.archive_file.products_handler_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      PRODUCTS_TABLE_NAME = var.products_table_name
      IMAGES_BUCKET_NAME  = var.images_bucket_name
      IMAGES_BUCKET_URL   = var.images_bucket_url
    }
  }

  depends_on = [aws_cloudwatch_log_group.products_lambda_logs]
}

################################################################
# ================ Lambda 4: riders_handler ====================
# Lee tabla `riders`. Endpoint simple.
################################################################
data "archive_file" "riders_handler_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambdas/riders_handler"
  output_path = "${path.module}/.build/riders_handler.zip"
}

resource "aws_iam_role" "riders_lambda_role" {
  name               = "${var.resource_prefix}-riders-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "riders_lambda_basic_logs" {
  role       = aws_iam_role.riders_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "riders_lambda_inline_policy_doc" {
  statement {
    sid       = "DynamoDBRidersReadOnly"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources = [var.riders_table_arn]
  }
}

resource "aws_iam_role_policy" "riders_lambda_inline_policy" {
  name   = "${var.resource_prefix}-riders-policy"
  role   = aws_iam_role.riders_lambda_role.id
  policy = data.aws_iam_policy_document.riders_lambda_inline_policy_doc.json
}

resource "aws_cloudwatch_log_group" "riders_lambda_logs" {
  name              = "/aws/lambda/${var.resource_prefix}-riders"
  retention_in_days = 7
}

resource "aws_lambda_function" "riders_handler" {
  function_name    = "${var.resource_prefix}-riders"
  role             = aws_iam_role.riders_lambda_role.arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.riders_handler_zip.output_path
  source_code_hash = data.archive_file.riders_handler_zip.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      RIDERS_TABLE_NAME = var.riders_table_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.riders_lambda_logs]
}
