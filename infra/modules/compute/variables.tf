variable "resource_prefix" {
  description = "Prefijo común de nombres. Ej: 'orderflow-g2p4-personal'."
  type        = string
}

variable "orders_table_name" {
  description = "Nombre de la tabla DynamoDB de pedidos. Se inyecta como env var."
  type        = string
}

variable "orders_table_arn" {
  description = "ARN de la tabla. Se usa para el permiso IAM least-privilege."
  type        = string
}

variable "event_bus_name" {
  description = "Nombre del bus EventBridge donde la Lambda orders publica eventos."
  type        = string
}

variable "event_bus_arn" {
  description = "ARN del bus EventBridge (para el permiso IAM)."
  type        = string
}

variable "notifications_queue_arn" {
  description = "ARN de la SQS que dispara la Lambda notifier."
  type        = string
}

variable "admin_alerts_topic_arn" {
  description = "ARN del SNS topic donde la Lambda notifier publica alertas."
  type        = string
}
