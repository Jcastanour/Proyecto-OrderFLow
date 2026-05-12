variable "resource_prefix" {
  description = "Prefijo común de nombres."
  type        = string
}

variable "frontend_source_dir" {
  description = "Ruta absoluta a la carpeta frontend/ (donde están los HTML/CSS/JS)."
  type        = string
}

variable "api_url" {
  description = "URL del API Gateway. Se inyecta en el frontend vía env.js."
  type        = string
}

variable "user_pool_id" {
  type = string
}

variable "user_pool_client_id" {
  type = string
}
