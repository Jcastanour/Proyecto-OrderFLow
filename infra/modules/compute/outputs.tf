output "orders_lambda_arn" {
  description = "ARN de la Lambda. Lo usa API Gateway para invocarla."
  value       = aws_lambda_function.orders_handler.arn
}

output "orders_lambda_invoke_arn" {
  description = "Invoke ARN (formato especial que pide API Gateway)."
  value       = aws_lambda_function.orders_handler.invoke_arn
}

output "orders_lambda_function_name" {
  description = "Nombre de la función. Se usa para el permiso de invocación."
  value       = aws_lambda_function.orders_handler.function_name
}
