################################################################
# modules/observability/main.tf
#
# Cubre el requisito del PDF:
# "Configurar métricas y alarmas en CloudWatch para supervisar
#  las invocaciones de Lambda, el tráfico en API Gateway y la
#  tasa de consumo de la tabla de DynamoDB."
#
# Crea:
#   1) 4 alarmas Lambda errors > 0 (una por Lambda)
#   2) 1 alarma API Gateway 5xx > 5 en 5min
#   3) 1 alarma SQS ApproximateAgeOfOldestMessage > 300s (5 minutos)
#   4) N alarmas DynamoDB throttles (una por tabla)
#   5) 1 dashboard con widgets para ver todo
#
# Todas las alarmas notifican al SNS topic admin_alerts → email.
################################################################

################################################################
# 1) Lambdas — alarma de errores (una por función)
################################################################
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.lambda_function_names

  alarm_name          = "${var.resource_prefix}-lambda-${each.key}-errors"
  alarm_description   = "Lambda ${each.value} reportó errores en los últimos 5 minutos."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [var.admin_alerts_topic_arn]
  ok_actions    = [var.admin_alerts_topic_arn]
}

################################################################
# 2) API Gateway HTTP API — alarma de 5xx
#    Métrica del namespace AWS/ApiGateway para HTTP API:
#    "5xx" (Count) con dimensión ApiId.
################################################################
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "${var.resource_prefix}-api-5xx"
  alarm_description   = "API Gateway está devolviendo errores 5xx (backend caído o fallando)."
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
  }

  alarm_actions = [var.admin_alerts_topic_arn]
  ok_actions    = [var.admin_alerts_topic_arn]
}

################################################################
# 3) SQS — alarma de mensaje atascado en cola
#    Si el consumer (Lambda notifier) está caído, el mensaje
#    más viejo va envejeciendo. > 5 min = problema serio.
################################################################
resource "aws_cloudwatch_metric_alarm" "sqs_oldest_message_age" {
  alarm_name          = "${var.resource_prefix}-sqs-age"
  alarm_description   = "Hay mensajes en la cola sin procesar hace más de 5 minutos."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 300
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.sqs_queue_name
  }

  alarm_actions = [var.admin_alerts_topic_arn]
  ok_actions    = [var.admin_alerts_topic_arn]
}

################################################################
# 4) DynamoDB — alarma de throttles por tabla
#    Sumamos read+write throttle events.
################################################################
resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  for_each = var.dynamodb_table_names

  alarm_name          = "${var.resource_prefix}-dynamodb-${each.key}-read-throttles"
  alarm_description   = "Tabla DynamoDB ${each.value} está siendo throttled en lecturas."
  namespace           = "AWS/DynamoDB"
  metric_name         = "ReadThrottleEvents"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = each.value
  }

  alarm_actions = [var.admin_alerts_topic_arn]
  ok_actions    = [var.admin_alerts_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  for_each = var.dynamodb_table_names

  alarm_name          = "${var.resource_prefix}-dynamodb-${each.key}-write-throttles"
  alarm_description   = "Tabla DynamoDB ${each.value} está siendo throttled en escrituras."
  namespace           = "AWS/DynamoDB"
  metric_name         = "WriteThrottleEvents"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = each.value
  }

  alarm_actions = [var.admin_alerts_topic_arn]
  ok_actions    = [var.admin_alerts_topic_arn]
}

################################################################
# 5) Dashboard CloudWatch
#    Widgets:
#      - Invocaciones Lambda por función
#      - Errores Lambda por función
#      - Latencia API Gateway
#      - Counts API Gateway (2xx vs 4xx vs 5xx)
#      - DynamoDB capacity consumida por tabla
#      - SQS: mensajes visibles + age del más viejo
################################################################
locals {
  # Construir las listas de métricas para los widgets
  lambda_invocations_metrics = [
    for label, fname in var.lambda_function_names :
    ["AWS/Lambda", "Invocations", "FunctionName", fname, { label = label }]
  ]

  lambda_errors_metrics = [
    for label, fname in var.lambda_function_names :
    ["AWS/Lambda", "Errors", "FunctionName", fname, { label = label }]
  ]

  lambda_duration_metrics = [
    for label, fname in var.lambda_function_names :
    ["AWS/Lambda", "Duration", "FunctionName", fname, { label = label }]
  ]

  dynamodb_consumed_read_metrics = [
    for label, tname in var.dynamodb_table_names :
    ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", tname, { label = label }]
  ]

  dynamodb_consumed_write_metrics = [
    for label, tname in var.dynamodb_table_names :
    ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", tname, { label = label }]
  ]
}

resource "aws_cloudwatch_dashboard" "orderflow_dashboard" {
  dashboard_name = "${var.resource_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Fila 1: Lambdas
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda · Invocaciones"
          metrics = local.lambda_invocations_metrics
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda · Errores"
          metrics = local.lambda_errors_metrics
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 60
        }
      },

      # Fila 2: Lambda Duration + API Gateway 5xx
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Lambda · Duración (avg ms)"
          metrics = local.lambda_duration_metrics
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Average"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title = "API Gateway · Requests por estado"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.api_id, { label = "Total" }],
            [".", "4xx", ".", ".", { label = "4xx" }],
            [".", "5xx", ".", ".", { label = "5xx" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 60
        }
      },

      # Fila 3: API latency + SQS
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title = "API Gateway · Latencia (ms)"
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiId", var.api_id, { label = "p50", stat = "p50" }],
            ["...", { label = "p95", stat = "p95" }],
            ["...", { label = "p99", stat = "p99" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title = "SQS · Cola de notificaciones"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.sqs_queue_name, { label = "Mensajes visibles" }],
            [".", "ApproximateAgeOfOldestMessage", ".", ".", { label = "Age del más viejo (s)" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Maximum"
          period  = 60
        }
      },

      # Fila 4: DynamoDB consumed capacity
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title   = "DynamoDB · Read capacity consumida"
          metrics = local.dynamodb_consumed_read_metrics
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title   = "DynamoDB · Write capacity consumida"
          metrics = local.dynamodb_consumed_write_metrics
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          stat    = "Sum"
          period  = 60
        }
      }
    ]
  })
}
