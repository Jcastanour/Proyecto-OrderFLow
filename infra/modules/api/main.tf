################################################################
# modules/api/main.tf
# - API Gateway HTTP API (más barata y simple que REST API)
# - 4 rutas conectadas a la Lambda orders_handler
# - Stage $default con auto-deploy (cada cambio se publica solo)
# - Permiso para que API Gateway invoque la Lambda
################################################################

################################################################
# 1) La API en sí
################################################################
resource "aws_apigatewayv2_api" "orderflow_http_api" {
  name          = "${var.resource_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"] # estudio: abierto. Después restringimos al dominio CloudFront
    allow_methods = ["GET", "POST", "PATCH", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

################################################################
# 2) Integración: cómo la API conecta con la Lambda
################################################################
resource "aws_apigatewayv2_integration" "orders_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.orderflow_http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.orders_lambda_invoke_arn
  integration_method     = "POST" # siempre POST hacia Lambda
  payload_format_version = "2.0"
}

################################################################
# 3) Rutas — cada una mapea método+path a la integración
################################################################
locals {
  orders_routes = {
    list_orders         = "GET /orders"
    create_order        = "POST /orders"
    get_order_by_id     = "GET /orders/{orderId}"
    update_order_status = "PATCH /orders/{orderId}"
  }
}

resource "aws_apigatewayv2_route" "orders_routes" {
  for_each = local.orders_routes

  api_id    = aws_apigatewayv2_api.orderflow_http_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.orders_lambda_integration.id}"
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
# 5) Permiso para que API Gateway pueda invocar la Lambda
################################################################
resource "aws_lambda_permission" "allow_api_gateway_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.orders_lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.orderflow_http_api.execution_arn}/*/*"
}
