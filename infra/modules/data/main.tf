################################################################
# modules/data/main.tf
# - Recursos de almacenamiento (DynamoDB).
# - Por ahora solo la tabla de pedidos.
# - Más adelante agregaremos: Users, Products, Notifications.
################################################################

resource "aws_dynamodb_table" "orders" {
  name         = "${var.resource_prefix}-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }
}
