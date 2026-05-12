# ─── notifier_handler ─────────────────────────────────────────
output "notifier_lambda_function_name" {
  description = "Nombre de la función notifier (para alarmas CloudWatch)."
  value       = aws_lambda_function.notifier_handler.function_name
}

# ─── orders_handler ───────────────────────────────────────────
output "orders_lambda_arn" {
  description = "ARN de la Lambda orders."
  value       = aws_lambda_function.orders_handler.arn
}

output "orders_lambda_invoke_arn" {
  description = "Invoke ARN (formato que pide API Gateway)."
  value       = aws_lambda_function.orders_handler.invoke_arn
}

output "orders_lambda_function_name" {
  description = "Nombre de la función orders. Para el permiso de invocación."
  value       = aws_lambda_function.orders_handler.function_name
}

# ─── products_handler (Etapa D) ───────────────────────────────
output "products_lambda_arn" {
  description = "ARN de la Lambda products."
  value       = aws_lambda_function.products_handler.arn
}

output "products_lambda_invoke_arn" {
  description = "Invoke ARN para API Gateway."
  value       = aws_lambda_function.products_handler.invoke_arn
}

output "products_lambda_function_name" {
  description = "Nombre de la función products."
  value       = aws_lambda_function.products_handler.function_name
}

# ─── riders_handler (Etapa D) ─────────────────────────────────
output "riders_lambda_arn" {
  description = "ARN de la Lambda riders."
  value       = aws_lambda_function.riders_handler.arn
}

output "riders_lambda_invoke_arn" {
  description = "Invoke ARN para API Gateway."
  value       = aws_lambda_function.riders_handler.invoke_arn
}

output "riders_lambda_function_name" {
  description = "Nombre de la función riders."
  value       = aws_lambda_function.riders_handler.function_name
}
