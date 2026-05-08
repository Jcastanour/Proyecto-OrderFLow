################################################################
# providers.tf
# - Versión mínima de Terraform y de los providers
# - Configuración del provider AWS + tags por defecto
################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Tags que se aplican a TODOS los recursos automáticamente.
  # Útil para identificar qué cuesta qué en el billing y separar
  # recursos del Grupo 2, Proyecto 4 de cualquier otra cosa en la cuenta.
  default_tags {
    tags = {
      Project       = var.project_name
      Environment   = var.env
      TeamNumber    = tostring(var.team_number)
      ProjectNumber = tostring(var.project_number)
      Bootcamp      = "BeTek-Cloud"
      ManagedBy     = "Terraform"
    }
  }
}
