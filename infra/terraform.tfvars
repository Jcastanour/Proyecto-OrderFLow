################################################################
# terraform.tfvars
# Valores REALES de las variables.
# Terraform lee este archivo automáticamente.
################################################################

project_name   = "orderflow"
team_number    = 2 # Grupo 2 del bootcamp
project_number = 4 # Proyecto 4
env            = "personal"
aws_region     = "us-east-1"

# Email donde llegarán las alertas. Cámbialo por el tuyo y AWS te
# mandará un correo de confirmación tras el primer apply.
notification_email = "pablocastano6@gmail.com"
