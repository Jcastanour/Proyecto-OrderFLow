################################################################
# modules/data/main.tf
# Recursos de almacenamiento (DynamoDB).
#
# 3 tablas:
#   - orders    → pedidos del cliente (ya existía)
#   - products  → catálogo de platos (Etapa B)
#   - riders    → perfil de repartidores (Etapa B)
#
# Todas las tablas se crean VACÍAS. La carga de datos se hace
# desde el workflow de GitHub Actions con un script Python que
# llama a batch_write_item. Así separamos "crear infra" (IaC)
# de "poblar datos" (CI/CD).
################################################################

################################################################
# Tabla: orders (ya existía)
# Clave: orderId (string). Resto de atributos schemaless.
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

################################################################
# Tabla: products (NUEVA · Etapa B)
# Clave: productId (string).
# Atributos típicos (schemaless en DynamoDB, los crea la app):
#   - name, description, price, category, emoji, tags,
#     rating, prepMinutes, available
# La imagen NO se guarda acá. Se resuelve dinámicamente en la
# Lambda products_handler matcheando contra el bucket S3.
################################################################
resource "aws_dynamodb_table" "products" {
  name         = "${var.resource_prefix}-products"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "productId"

  attribute {
    name = "productId"
    type = "S"
  }
}

################################################################
# Tabla: riders (NUEVA · Etapa B)
# Clave: riderId (string).
# Atributos típicos:
#   - name, avatar, rating, totalDeliveries, online,
#     todayStats (map con deliveries/earnings/hoursOnline)
################################################################
resource "aws_dynamodb_table" "riders" {
  name         = "${var.resource_prefix}-riders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "riderId"

  attribute {
    name = "riderId"
    type = "S"
  }
}
