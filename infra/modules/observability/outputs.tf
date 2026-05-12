output "dashboard_name" {
  description = "Nombre del dashboard CloudWatch (URL: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=<este_valor>)."
  value       = aws_cloudwatch_dashboard.orderflow_dashboard.dashboard_name
}

output "dashboard_url" {
  description = "URL directa al dashboard en la consola AWS."
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.orderflow_dashboard.dashboard_name}"
}
