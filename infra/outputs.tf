output "orders_table_name" {
  description = "Nombre de la tabla de pedidos."
  value       = module.data.orders_table_name
}

output "user_pool_id" {
  description = "ID del User Pool de Cognito."
  value       = module.auth.user_pool_id
}

output "user_pool_client_id" {
  description = "ID del App Client del User Pool de Cognito."
  value       = module.auth.user_pool_client_id
}


output "products_table_name" {
  description = "Nombre de la tabla de productos (la usará el workflow para el seed)."
  value       = module.data.products_table_name
}

output "riders_table_name" {
  description = "Nombre de la tabla de repartidores (la usará el workflow para el seed)."
  value       = module.data.riders_table_name
}

output "images_bucket_name" {
  description = "Bucket S3 de imágenes (el workflow hace `aws s3 sync` acá)."
  value       = module.images.images_bucket_name
}

output "images_bucket_url" {
  description = "URL pública base del bucket de imágenes."
  value       = module.images.images_bucket_url
}

output "dashboard_url" {
  description = "URL directa al dashboard CloudWatch en consola AWS."
  value       = module.observability.dashboard_url
}

output "api_url" {
  description = "URL pública de la API."
  value       = module.api.api_url
}

output "site_url" {
  description = "URL pública del sitio (HTTP via S3 website endpoint)."
  value       = module.frontend.site_url
}

output "event_bus_name" {
  description = "Bus de EventBridge donde la Lambda orders publica eventos."
  value       = module.messaging.event_bus_name
}

output "notifications_queue_url" {
  description = "URL de la cola SQS de notificaciones."
  value       = module.messaging.notifications_queue_url
}

output "admin_alerts_topic_arn" {
  description = "Topic SNS donde se publican las alertas administrativas."
  value       = module.messaging.admin_alerts_topic_arn
}
