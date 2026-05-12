variable "resource_prefix" {
  description = "Prefijo común de nombres. Ej: 'orderflow-g2p4-personal'."
  type        = string
}

# ─── orders_handler ───────────────────────────────────────────
variable "orders_table_name" {
  description = "Nombre de la tabla DynamoDB de pedidos. Se inyecta como env var."
  type        = string
}

variable "orders_table_arn" {
  description = "ARN de la tabla de pedidos. Permiso IAM least-privilege."
  type        = string
}

variable "event_bus_name" {
  description = "Nombre del bus EventBridge donde la Lambda orders publica eventos."
  type        = string
}

variable "event_bus_arn" {
  description = "ARN del bus EventBridge (permiso IAM)."
  type        = string
}

# ─── notifier_handler ─────────────────────────────────────────
variable "notifications_queue_arn" {
  description = "ARN de la SQS que dispara la Lambda notifier."
  type        = string
}

variable "admin_alerts_topic_arn" {
  description = "ARN del SNS topic donde notifier publica alertas."
  type        = string
}

# ─── products_handler (Etapa D) ───────────────────────────────
variable "products_table_name" {
  description = "Nombre de la tabla DynamoDB de productos."
  type        = string
}

variable "products_table_arn" {
  description = "ARN de la tabla de productos. Permiso IAM least-privilege."
  type        = string
}

variable "images_bucket_name" {
  description = "Nombre del bucket S3 de imágenes (la Lambda lista objetos)."
  type        = string
}

variable "images_bucket_arn" {
  description = "ARN del bucket de imágenes (permiso IAM)."
  type        = string
}

variable "images_bucket_url" {
  description = "URL pública base del bucket de imágenes (env var para construir imageUrl)."
  type        = string
}

# ─── riders_handler (Etapa D) ─────────────────────────────────
variable "riders_table_name" {
  description = "Nombre de la tabla DynamoDB de repartidores."
  type        = string
}

variable "riders_table_arn" {
  description = "ARN de la tabla de repartidores. Permiso IAM least-privilege."
  type        = string
}
