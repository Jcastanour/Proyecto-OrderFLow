################################################################
# variables.tf (raíz)
# - Las "perillas" configurables del proyecto.
# - Sus valores reales viven en terraform.tfvars.
################################################################

variable "project_name" {
  description = "Nombre del producto. Se usa como primer fragmento del prefijo."
  type        = string
  default     = "orderflow"
}

variable "team_number" {
  description = "Número del grupo del bootcamp (somos Grupo 2)."
  type        = number
  default     = 2
}

variable "project_number" {
  description = "Número del proyecto del bootcamp (es el Proyecto 4)."
  type        = number
  default     = 4
}

variable "env" {
  description = "Entorno: 'personal' (cuenta de pruebas) o 'betek' (cuenta del bootcamp)."
  type        = string
  default     = "personal"

  validation {
    condition     = contains(["personal", "betek"], var.env)
    error_message = "env debe ser 'personal' o 'betek'."
  }
}

variable "aws_region" {
  description = "Región AWS principal. us-east-1 es la más barata y completa."
  type        = string
  default     = "us-east-1"
}

variable "notification_email" {
  description = "Email donde llegan las alertas SNS. Si se deja vacío, no se crea suscripción."
  type        = string
  default     = ""
}
