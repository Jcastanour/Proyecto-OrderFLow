variable "resource_prefix" {
  description = "Prefijo común de nombres."
  type        = string
}

variable "orders_lambda_invoke_arn" {
  description = "Invoke ARN de la Lambda orders (output del módulo compute)."
  type        = string
}

variable "orders_lambda_function_name" {
  description = "Nombre de la función Lambda orders."
  type        = string
}
