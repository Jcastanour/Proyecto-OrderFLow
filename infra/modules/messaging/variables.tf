variable "resource_prefix" {
  description = "Prefijo común de nombres."
  type        = string
}

variable "notification_email" {
  description = "Email donde llegan las alertas. Vacío = sin suscripción."
  type        = string
  default     = ""
}
