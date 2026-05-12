################################################################
# modules/data/outputs.tf
# OUTPUTS del módulo. Lo que el módulo "devuelve" a quien lo
# invocó. Los módulos compute/api/observability leerán esto.
################################################################

# ─── orders ────────────────────────────────────────────────────
output "orders_table_name" {
  description = "Nombre de la tabla de pedidos."
  value       = aws_dynamodb_table.orders.name
}

output "orders_table_arn" {
  description = "ARN de la tabla de pedidos. Lo usa la Lambda orders_handler."
  value       = aws_dynamodb_table.orders.arn
}

# ─── products ──────────────────────────────────────────────────
output "products_table_name" {
  description = "Nombre de la tabla de productos."
  value       = aws_dynamodb_table.products.name
}

output "products_table_arn" {
  description = "ARN de la tabla de productos. Lo usa la Lambda products_handler."
  value       = aws_dynamodb_table.products.arn
}

# ─── riders ────────────────────────────────────────────────────
output "riders_table_name" {
  description = "Nombre de la tabla de repartidores."
  value       = aws_dynamodb_table.riders.name
}

output "riders_table_arn" {
  description = "ARN de la tabla de repartidores. Lo usa la Lambda riders_handler."
  value       = aws_dynamodb_table.riders.arn
}
