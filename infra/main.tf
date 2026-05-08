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
# Etapa 4 — Mensajería (EventBridge + SQS + SNS)
# Va antes que compute porque compute necesita los ARNs de aquí.
################################################################
module "messaging" {
  source = "./modules/messaging"

  resource_prefix    = local.resource_prefix
  notification_email = var.notification_email
}

################################################################
# Etapa 2 — Lambdas (compute) + API Gateway HTTP (api)
################################################################
module "compute" {
  source = "./modules/compute"

  resource_prefix         = local.resource_prefix
  orders_table_name       = module.data.orders_table_name
  orders_table_arn        = module.data.orders_table_arn
  event_bus_name          = module.messaging.event_bus_name
  event_bus_arn           = module.messaging.event_bus_arn
  notifications_queue_arn = module.messaging.notifications_queue_arn
  admin_alerts_topic_arn  = module.messaging.admin_alerts_topic_arn
}

module "api" {
  source = "./modules/api"

  resource_prefix             = local.resource_prefix
  orders_lambda_invoke_arn    = module.compute.orders_lambda_invoke_arn
  orders_lambda_function_name = module.compute.orders_lambda_function_name
}

################################################################
# Etapa 3 — Frontend (S3 público)
################################################################
module "frontend" {
  source = "./modules/frontend"

  resource_prefix     = local.resource_prefix
  frontend_source_dir = "${path.root}/../frontend"
  api_url             = module.api.api_url
}

################################################################
# Próximas etapas:
# module "observability" { source = "./modules/observability" ... }
################################################################
