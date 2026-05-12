output "event_bus_name" {
  description = "Nombre del bus de EventBridge. Lo usa la Lambda orders para publicar eventos."
  value       = aws_cloudwatch_event_bus.orderflow_event_bus.name
}

output "event_bus_arn" {
  description = "ARN del bus. Se usa para permisos IAM."
  value       = aws_cloudwatch_event_bus.orderflow_event_bus.arn
}

output "notifications_queue_arn" {
  description = "ARN de la cola SQS. La Lambda notifier la consumirá."
  value       = aws_sqs_queue.notifications_queue.arn
}

output "notifications_queue_url" {
  description = "URL de la cola (para boto3)."
  value       = aws_sqs_queue.notifications_queue.url
}

output "notifications_queue_name" {
  description = "Nombre de la cola (dimensión QueueName en CloudWatch)."
  value       = aws_sqs_queue.notifications_queue.name
}

output "admin_alerts_topic_arn" {
  description = "ARN del topic SNS. La Lambda notifier publica acá."
  value       = aws_sns_topic.admin_alerts_topic.arn
}
