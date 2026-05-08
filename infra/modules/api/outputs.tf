output "api_url" {
  description = "URL pública de la API. Termina en .amazonaws.com (sin path)."
  value       = aws_apigatewayv2_api.orderflow_http_api.api_endpoint
}
