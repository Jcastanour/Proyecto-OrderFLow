################################################################
# modules/api/main.tf
# - API Gateway HTTP API (más barata y simple que REST API)
# - 7 rutas conectadas a 3 Lambdas distintas
# - Stage $default con auto-deploy (cada cambio se publica solo)
# - 3 permisos para que API Gateway invoque cada Lambda
################################################################

################################################################
# 1) La API en sí
################################################################
resource "aws_apigatewayv2_api" "orderflow_http_api" {
  name          = "${var.resource_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"] # estudio: abierto. Producción: restringir al dominio del sitio.
    allow_methods = ["GET", "POST", "PATCH", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

################################################################
# 2) Integraciones: una por Lambda
################################################################
resource "aws_apigatewayv2_integration" "orders_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.orderflow_http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.orders_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Etapa E: nueva integración para products_handler
resource "aws_apigatewayv2_integration" "products_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.orderflow_http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.products_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Etapa E: nueva integración para riders_handler
resource "aws_apigatewayv2_integration" "riders_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.orderflow_http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.riders_lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

################################################################
# 3) Rutas — agrupadas por Lambda destino
################################################################

# ─── /orders → orders_handler ────────────────────────────────
locals {
  orders_routes = {
    list_orders         = "GET /orders"
    create_order        = "POST /orders"
    get_order_by_id     = "GET /orders/{orderId}"
    update_order_status = "PATCH /orders/{orderId}"
    get_user_orders     = "GET /orders/user/{userEmail}"
  }

  # Etapa E: nuevas rutas
  products_routes = {
    list_products     = "GET /products"
    get_product_by_id = "GET /products/{productId}"
  }

  riders_routes = {
    get_rider_by_id = "GET /riders/{riderId}"
  }
}

resource "aws_apigatewayv2_route" "orders_routes" {
  for_each = local.orders_routes

  api_id    = aws_apigatewayv2_api.orderflow_http_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.orders_lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "products_routes" {
  for_each = local.products_routes

  api_id    = aws_apigatewayv2_api.orderflow_http_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.products_lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "riders_routes" {
  for_each = local.riders_routes

  api_id    = aws_apigatewayv2_api.orderflow_http_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.riders_lambda_integration.id}"
}

################################################################
# 4) Stage: el punto público al que se conecta la gente
#    $default + auto_deploy = cualquier cambio se publica solo
################################################################
resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.orderflow_http_api.id
  name        = "$default"
  auto_deploy = true
}

################################################################
# 5) Permisos para que API Gateway pueda invocar cada Lambda
################################################################
resource "aws_lambda_permission" "allow_api_gateway_invoke_orders" {
  statement_id  = "AllowExecutionFromAPIGatewayOrders"
  action        = "lambda:InvokeFunction"
  function_name = var.orders_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.orderflow_http_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_api_gateway_invoke_products" {
  statement_id  = "AllowExecutionFromAPIGatewayProducts"
  action        = "lambda:InvokeFunction"
  function_name = var.products_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.orderflow_http_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_api_gateway_invoke_riders" {
  statement_id  = "AllowExecutionFromAPIGatewayRiders"
  action        = "lambda:InvokeFunction"
  function_name = var.riders_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.orderflow_http_api.execution_arn}/*/*"
}
