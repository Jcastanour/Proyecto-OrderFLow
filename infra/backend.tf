################################################################
# backend.tf — Terraform state remoto en S3
#
# El state ya NO vive local (en infra/terraform.tfstate).
# Vive en el bucket s3://orderflow-g2p4-tfstate/infra/terraform.tfstate.
#
# Ventajas:
#   - Compartido entre tu Mac y los workflows de GitHub Actions
#     (los dos ven el mismo state, no se pisan).
#   - Versionado (el bucket tiene Bucket Versioning enabled).
#   - Encriptado en reposo.
#
# Cuenta múltiple (personal vs betek):
#   En cada cuenta hay que crear MANUALMENTE el bucket con el mismo
#   nombre (orderflow-g2p4-tfstate) ANTES del primer terraform init.
#   El bucket en la cuenta de Betek solo va a existir el día D del proyecto.
#   En PERSONAL ya está creado (lo creaste por consola).
#
# Para migrar el state local que YA tienes a este bucket:
#   cd infra
#   terraform init -migrate-state
#   # Te va a preguntar si quieres copiar el state local al remoto. Decí yes.
#   # Después podés borrar infra/terraform.tfstate y .terraform.tfstate.backup
################################################################
terraform {
  backend "s3" {
    bucket  = "orderflow-g2p4-tfstate"
    key     = "infra/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
