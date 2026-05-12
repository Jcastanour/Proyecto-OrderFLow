variable "resource_prefix" {
  description = "Prefijo común de nombres."
  type        = string
}

# ─── orders_handler ───────────────────────────────────────────
variable "orders_lambda_invoke_arn" {
  description = "Invoke ARN de la Lambda orders (output del módulo compute)."
  type        = string
}

variable "orders_lambda_function_name" {
  description = "Nombre de la función Lambda orders."
  type        = string
}

# ─── products_handler (Etapa E) ───────────────────────────────
variable "products_lambda_invoke_arn" {
  description = "Invoke ARN de la Lambda products."
  type        = string
}

variable "products_lambda_function_name" {
  description = "Nombre de la función Lambda products."
  type        = string
}

# ─── riders_handler (Etapa E) ─────────────────────────────────
variable "riders_lambda_invoke_arn" {
  description = "Invoke ARN de la Lambda riders."
  type        = string
}

variable "riders_lambda_function_name" {
  description = "Nombre de la función Lambda riders."
  type        = string
}
