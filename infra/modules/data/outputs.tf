################################################################
# modules/data/outputs.tf
# - OUTPUTS del módulo. Lo que el módulo "devuelve" a quien lo
#   invocó. Otros módulos (la Lambda, en la Etapa 2) leerán esto.
################################################################

output "orders_table_name" {
  description = "Nombre de la tabla de pedidos."
  value       = aws_dynamodb_table.orders.name
}

output "orders_table_arn" {
  description = "ARN de la tabla de pedidos. Lo usará la Lambda para permisos IAM."
  value       = aws_dynamodb_table.orders.arn
}
