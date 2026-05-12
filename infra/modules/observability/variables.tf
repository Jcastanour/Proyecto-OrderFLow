variable "resource_prefix" {
  description = "Prefijo común de nombres."
  type        = string
}

variable "aws_region" {
  description = "Región donde corren los recursos (la usamos para el dashboard)."
  type        = string
}

variable "admin_alerts_topic_arn" {
  description = "Topic SNS donde las alarmas publican notificaciones (vienen al email)."
  type        = string
}

# ─── Lambdas que monitoreamos ─────────────────────────────────
# Pasamos un map de label → function name para crear alarmas con for_each
# y mantenerlo legible en el plan.
variable "lambda_function_names" {
  description = "Map de label → function_name. Una alarma de errores por cada Lambda."
  type        = map(string)
  # Ej: { orders = "orderflow-g2p4-personal-orders", notifier = "...-notifier" }
}

# ─── API Gateway ──────────────────────────────────────────────
variable "api_id" {
  description = "ID del HTTP API. Lo usamos como dimensión ApiId en las métricas."
  type        = string
}

# ─── Tablas DynamoDB ──────────────────────────────────────────
variable "dynamodb_table_names" {
  description = "Map de label → table_name. Una alarma de throttles por cada tabla."
  type        = map(string)
}

# ─── SQS ──────────────────────────────────────────────────────
variable "sqs_queue_name" {
  description = "Nombre de la cola SQS (dimensión QueueName)."
  type        = string
}
