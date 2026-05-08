output "orders_table_name" {
  description = "Nombre de la tabla de pedidos."
  value       = module.data.orders_table_name
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
