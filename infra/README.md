# OrderFlow — Infraestructura (Terraform)

Toda la infraestructura AWS del proyecto vive en esta carpeta y se gestiona con **Terraform**.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `providers.tf` | Declara qué versión de Terraform y de AWS usamos. |
| `variables.tf` | Declara las "perillas" configurables (nombre, entorno, región). |
| `terraform.tfvars` | Los **valores** concretos de esas variables. |
| `main.tf` | Los **recursos** AWS que queremos crear. |
| `outputs.tf` | Lo que Terraform imprime al final del apply. |
| `.gitignore` | Excluye state local y secrets de git. |

## Flujo de trabajo

```bash
cd infra

# 1) Solo la primera vez (descarga el provider AWS):
terraform init

# 2) Ver qué cambios va a hacer (sin aplicarlos):
terraform plan

# 3) Aplicar (crea/modifica recursos en AWS):
terraform apply

# 4) Cuando ya no necesites la infra:
terraform destroy
```

## Etapas

- [x] **Etapa 1**: tabla DynamoDB de pedidos.
- [ ] Etapa 2: Lambda + API Gateway HTTP.
- [ ] Etapa 3: S3 + CloudFront para el frontend.
- [ ] Etapa 4: SNS + SQS + EventBridge.
- [ ] Etapa 5: CloudWatch (logs + alarmas).
- [ ] Etapa 6: GitHub Actions (deploy/destroy automatizado).

## Nota sobre el state

Por simplicidad de proyecto de estudio, el state de Terraform se guarda **localmente** en `terraform.tfstate` (excluido de git). En un proyecto real iría en un bucket S3 con lock en DynamoDB.
