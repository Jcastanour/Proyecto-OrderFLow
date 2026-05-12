output "api_url" {
  description = "URL pública de la API. Termina en .amazonaws.com (sin path)."
  value       = aws_apigatewayv2_api.orderflow_http_api.api_endpoint
}

output "api_id" {
  description = "ID del API Gateway HTTP API (dimensión de las métricas CloudWatch)."
  value       = aws_apigatewayv2_api.orderflow_http_api.id
}
