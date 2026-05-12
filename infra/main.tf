################################################################
# main.tf (raíz)
# - Orquesta los módulos.
# - Calcula el prefijo común para nombrar todos los recursos.
# - Pasa variables a los módulos y conecta sus outputs entre sí.
################################################################

locals {
  # Prefijo: "orderflow-g2p4-personal"
  resource_prefix = "${var.project_name}-g${var.team_number}p${var.project_number}-${var.env}"
}

################################################################
# Etapa 1 — DynamoDB
################################################################
module "data" {
  source = "./modules/data"

  resource_prefix = local.resource_prefix
}

################################################################
# Auth - Cognito
################################################################
module "auth" {
  source = "./modules/auth"

  resource_prefix = local.resource_prefix
}

################################################################
# Etapa 4 — Mensajería (EventBridge + SQS + SNS)
# Va antes que compute porque compute necesita los ARNs de aquí.
################################################################
module "messaging" {
  source = "./modules/messaging"

  resource_prefix    = local.resource_prefix
  notification_email = var.notification_email
}

################################################################
# Etapa C — Bucket S3 público para imágenes de productos.
# Va antes que compute porque la Lambda products_handler
# necesita el ARN y el nombre del bucket para permisos y env vars.
################################################################
module "images" {
  source = "./modules/images"

  resource_prefix = local.resource_prefix
}

################################################################
# Etapa 2 + D — Lambdas (compute) + API Gateway HTTP (api)
################################################################
module "compute" {
  source = "./modules/compute"

  resource_prefix = local.resource_prefix
  # orders + notifier (existentes)
  orders_table_name       = module.data.orders_table_name
  orders_table_arn        = module.data.orders_table_arn
  event_bus_name          = module.messaging.event_bus_name
  event_bus_arn           = module.messaging.event_bus_arn
  notifications_queue_arn = module.messaging.notifications_queue_arn
  admin_alerts_topic_arn  = module.messaging.admin_alerts_topic_arn

  # products + riders (Etapa D)
  products_table_name = module.data.products_table_name
  products_table_arn  = module.data.products_table_arn
  riders_table_name   = module.data.riders_table_name
  riders_table_arn    = module.data.riders_table_arn
  images_bucket_name  = module.images.images_bucket_name
  images_bucket_arn   = module.images.images_bucket_arn
  images_bucket_url   = module.images.images_bucket_url
}

module "api" {
  source = "./modules/api"

  resource_prefix             = local.resource_prefix
  orders_lambda_invoke_arn    = module.compute.orders_lambda_invoke_arn
  orders_lambda_function_name = module.compute.orders_lambda_function_name
  # Etapa E: nuevas Lambdas conectadas a rutas
  products_lambda_invoke_arn    = module.compute.products_lambda_invoke_arn
  products_lambda_function_name = module.compute.products_lambda_function_name
  riders_lambda_invoke_arn      = module.compute.riders_lambda_invoke_arn
  riders_lambda_function_name   = module.compute.riders_lambda_function_name
}

################################################################
# Etapa 3 — Frontend (S3 público)
################################################################
module "frontend" {
  source = "./modules/frontend"

  resource_prefix     = local.resource_prefix
  frontend_source_dir = "${path.root}/../frontend"
  api_url             = module.api.api_url
  user_pool_id        = module.auth.user_pool_id
  user_pool_client_id = module.auth.user_pool_client_id
}

################################################################
# Etapa G — Observability (CloudWatch alarmas + dashboard).
# Va al final porque necesita los nombres de TODOS los recursos
# que monitorea (Lambdas, tablas, API, SQS).
################################################################
module "observability" {
  source = "./modules/observability"

  resource_prefix        = local.resource_prefix
  aws_region             = var.aws_region
  admin_alerts_topic_arn = module.messaging.admin_alerts_topic_arn

  # Una alarma por Lambda (4 funciones)
  lambda_function_names = {
    orders   = module.compute.orders_lambda_function_name
    notifier = module.compute.notifier_lambda_function_name
    products = module.compute.products_lambda_function_name
    riders   = module.compute.riders_lambda_function_name
  }

  # Una alarma por tabla (3 tablas)
  dynamodb_table_names = {
    orders   = module.data.orders_table_name
    products = module.data.products_table_name
    riders   = module.data.riders_table_name
  }

  api_id         = module.api.api_id
  sqs_queue_name = module.messaging.notifications_queue_name
}
