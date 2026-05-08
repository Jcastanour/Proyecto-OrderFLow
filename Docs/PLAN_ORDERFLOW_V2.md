# 🚀 OrderFlow V2 — Plan Maestro (Proyecto Final Bootcamp)

> Versión rediseñada para ser un **proyecto top**: IaC end-to-end, CI/CD dual (cuenta personal ↔ cuenta Betek), deploy/destroy con un botón, y restore automático de datos semilla tras cada destrucción.

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| IaC | **Terraform** (módulos + remote state en S3 + DynamoDB lock) |
| Auth / paneles por rol | **Casero** (JWT propio en Lambda + tabla `Users` en DynamoDB). Cognito queda como mejora futura. |
| Mensajería / eventos | **EventBridge + SQS + SNS** (EventBridge como bus central — visto en clase — y SQS como buffer asíncrono para notificaciones) |
| Base de datos | **DynamoDB multi-tabla** (`Users`, `Orders`, `Products`, `Notifications`) |
| Frontend | HTML + Tailwind + Vanilla JS (se queda, pero separado por **paneles** según rol) |
| Backend | **Lambda Node.js 20** detrás de **API Gateway HTTP API** |
| Hosting front | **S3 + CloudFront** (HTTPS + caché) |
| Observabilidad | CloudWatch Logs + Alarms + Dashboard |

---

## 1. Arquitectura lógica

```
                     ┌──────────────┐
 Usuario ──► CloudFront ──► S3 (front estático por rol)
                     └──────┬───────┘
                            │ fetch
                            ▼
                   API Gateway (HTTP API)  ──►  Lambdas (auth, orders, products, users)
                                                     │
                          ┌──────────────────────────┼──────────────────────────┐
                          ▼                          ▼                          ▼
                      DynamoDB                 EventBridge Bus            CloudWatch
                  (Users/Orders/…)       (order.created, order.paid,…)   (logs+alarms)
                                                     │
                                     ┌───────────────┼────────────────┐
                                     ▼               ▼                ▼
                                  SQS (email)    SQS (kitchen)     SNS (admin)
                                     │               │                │
                                 Lambda mailer   Lambda kitchen    Email/SMS
```

### Flujo del pedido (evento-driven)
1. Cliente crea pedido → `POST /orders` → Lambda valida JWT, guarda en `Orders`, publica `order.created` en EventBridge.
2. EventBridge hace fan-out: SQS-cocina (panel cocina), SQS-mailer (email cliente), SNS-admin (métrica).
3. Cocina marca "listo" → `PATCH /orders/{id}` → evento `order.ready` → SQS-domiciliario.
4. Domiciliario cierra → `order.delivered` → mailer agradece + Dynamo marca cerrado.

---

## 2. Paneles por rol (frontend)

Un único bundle estático en S3, con rutas protegidas en el front por JWT decodificado:

| Rol | Panel | Qué ve |
|---|---|---|
| `cliente` | `/cliente` | Menú, crear pedido, tracking en vivo (polling cada 5s) |
| `cocina` | `/cocina` | Cola de pedidos entrantes (lee de SQS-cocina vía Lambda), botón "listo" |
| `domiciliario` | `/domi` | Pedidos listos para recoger, botón "entregado" |
| `admin` | `/admin` | CRUD productos, usuarios, métricas CloudWatch embebidas |

Login único (`/login`) → Lambda `auth` → devuelve JWT con `role` → front redirige al panel correspondiente.

---

## 3. IaC con Terraform

### Estructura
```
infra/
├── backend.tf                # S3 + Dynamo lock (por cuenta)
├── providers.tf              # provider AWS con assume_role opcional
├── variables.tf              # env, account_id, project_name
├── envs/
│   ├── personal.tfvars       # tu cuenta ($25 créditos)
│   └── betek.tfvars          # cuenta bootcamp
└── modules/
    ├── frontend/             # S3 + CloudFront + OAC
    ├── api/                  # API Gateway HTTP + stages
    ├── lambdas/              # todas las Lambdas + roles IAM
    ├── data/                 # DynamoDB tables + backups
    ├── messaging/            # EventBridge bus + SQS + SNS
    └── observability/        # CloudWatch dashboard + alarms
```

### State backend
- Bucket `orderflow-tfstate-<account>` + tabla `orderflow-tf-lock`.
- **Bootstrap**: un workflow único `terraform-bootstrap` crea el bucket/tabla la primera vez (idempotente).

---

## 4. CI/CD dual — cuenta personal ↔ Betek

### Estrategia: **un solo repo, dos environments de GitHub**

GitHub Environments:
- `personal` → secrets `AWS_ROLE_ARN` apuntando a tu cuenta ($25 créditos). Usado siempre por default.
- `betek` → secrets a la cuenta del bootcamp. Se activa **manualmente** el día del proyecto.

### Workflows (`.github/workflows/`)

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | push/PR | Lint + tests unitarios Lambdas + `terraform validate` + `terraform plan` |
| `deploy.yml` | `workflow_dispatch` con input `target=personal\|betek` | `terraform apply` + sube front a S3 + invalida CloudFront + **seed DB** |
| `destroy.yml` | `workflow_dispatch` con input `target` y `confirm=DESTROY` | **Backup DB → S3** + `terraform destroy` |
| `bootstrap.yml` | `workflow_dispatch` una sola vez por cuenta | Crea bucket de state y tabla de lock |
| `nightly-personal.yml` | cron diario 03:00 | destroy de personal para ahorrar créditos (opcional) |

### Autenticación: **OIDC, sin access keys**
- En cada cuenta creamos (una sola vez manualmente o con script) un rol `GitHubActionsDeployer` con trust policy a `token.actions.githubusercontent.com`.
- GitHub Actions usa `aws-actions/configure-aws-credentials@v4` con `role-to-assume`. Cero secrets largos en el repo.

---

## 5. Botones "prender" y "apagar" desde GitHub

Como son `workflow_dispatch`, GitHub te da **botón "Run workflow"** directo en la pestaña Actions:

- **🟢 Deploy**: Actions → `deploy.yml` → Run → eliges `personal` o `betek` → Run workflow.
- **🔴 Destroy**: Actions → `destroy.yml` → Run → tecleas `DESTROY` en el input `confirm` (salvaguarda) → Run.

Bonus: un `README.md` con badges-link directos:
```
[![Deploy Personal](https://img.shields.io/badge/Deploy-Personal-green)](…/actions/workflows/deploy.yml)
[![Destroy](https://img.shields.io/badge/Destroy-red)](…/actions/workflows/destroy.yml)
```

---

## 6. Backup + restore automático de DynamoDB

El "preza" que mencionas (tener que rehacer todo cada día) se resuelve así:

### En `destroy.yml` — **antes** de `terraform destroy`:
1. Job `backup`:
   - Para cada tabla (`Users`, `Orders`, `Products`): `aws dynamodb scan` → JSON → sube a `s3://orderflow-seeds-<account>/backups/<timestamp>/<tabla>.json`.
   - Copia también a `s3://…/backups/latest/` (sobreescribe).
2. Job `destroy` corre Terraform destroy (que NO borra el bucket `orderflow-seeds` — está fuera del state, o tiene `prevent_destroy = true`).

### En `deploy.yml` — **después** de `terraform apply`:
1. Job `seed`:
   - Lee `s3://orderflow-seeds-<account>/backups/latest/*.json`.
   - Si existe → `aws dynamodb batch-write-item` para repoblar.
   - Si NO existe (primer deploy) → usa `seed/initial/*.json` versionado en el repo (productos demo, usuarios demo, un pedido ejemplo).
2. Invalida CloudFront para refrescar el front.

### Bucket de seeds — **persistente entre destroys**
- Vive en un stack Terraform aparte (`infra-persistent/`) que **nunca se destruye**.
- O fuera de Terraform, creado por el bootstrap.
- Versionado + lifecycle: retener 7 días de backups, `latest/` siempre vigente.

---

## 7. Observabilidad (para el jurado)

- **Dashboard CloudWatch** con widgets:
  - Invocaciones/errores/duración por Lambda.
  - Mensajes en cada SQS.
  - Items en DynamoDB.
  - 4xx/5xx de API Gateway.
- **Alarmas** (las que ya tenías + nuevas):
  - `SQS ageOfOldestMessage > 5min`.
  - `Lambda Errors > 0`.
  - `API 5XX > 1%`.
  - `DynamoDB ThrottledRequests > 0`.
- **X-Ray** activado en las Lambdas para mostrar trazas end-to-end.

---

## 8. Temas del bootcamp cubiertos (para sustentación)

| Tema | Dónde aparece en OrderFlow |
|---|---|
| IAM | Roles por Lambda, rol OIDC GitHub Actions |
| S3 | Hosting front + bucket de seeds/backups |
| CloudFront | CDN + HTTPS del front |
| DynamoDB | 4 tablas + backups |
| Lambda | Auth, orders, products, mailer, kitchen |
| API Gateway HTTP | Entrada única a las Lambdas |
| SNS/SQS | Fan-out de notificaciones |
| EventBridge | Bus de eventos de dominio |
| CloudWatch | Logs, métricas, alarmas, dashboard |
| X-Ray | Tracing distribuido |
| Terraform (IaC) | Toda la infra |
| CI/CD | GitHub Actions multi-cuenta con OIDC |
| Backup/Restore | Scan + batch-write vs S3 |

---

## 9. Roadmap de implementación (orden sugerido)

1. **Semana 1 — Fundaciones**
   - [ ] Bootstrap state en tu cuenta personal (bucket + dynamo lock).
   - [ ] Crear rol OIDC `GitHubActionsDeployer` en personal.
   - [ ] Workflow `bootstrap.yml` + `ci.yml` (validate + plan).
   - [ ] Módulo `data/` (tablas DynamoDB) desplegado.

2. **Semana 2 — Backend mínimo**
   - [ ] Lambda `auth` (login/signup con JWT).
   - [ ] Lambda `orders` CRUD.
   - [ ] API Gateway conectada.
   - [ ] Seed inicial de productos/usuarios.

3. **Semana 3 — Eventos + paneles**
   - [ ] EventBridge bus + reglas → SQS cocina/mailer.
   - [ ] Lambdas consumidoras.
   - [ ] Paneles frontend por rol (cliente/cocina/domi/admin).
   - [ ] S3 + CloudFront.

4. **Semana 4 — Pulido + Betek**
   - [ ] Dashboard CloudWatch + alarmas + X-Ray.
   - [ ] Workflow `destroy.yml` con backup.
   - [ ] Workflow `deploy.yml` con restore.
   - [ ] Probar destroy/deploy en bucle en tu cuenta personal.
   - [ ] Configurar environment `betek` + rol OIDC en cuenta Betek.
   - [ ] Ensayo: destroy personal → deploy betek → destroy betek.

---

## 10. Costo estimado en tu cuenta personal ($25)

Con destroy nocturno:
- CloudFront + S3: ~$0.50/mes
- DynamoDB on-demand (pruebas): ~$1
- Lambda (free tier cubre casi todo): ~$0
- API Gateway HTTP: ~$0.10
- CloudWatch logs: ~$0.50
- **Total estimado con uso de pruebas: ~$2–4/mes** → $25 te dan meses de pruebas.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cuenta Betek bloquea un servicio el día D | Tener el deploy probado 100% en personal; IaC hace el deploy en minutos |
| State corrupto | Versionado en S3 + lock en DynamoDB |
| Backup falla antes de destroy | `destroy.yml` tiene job `backup` como dependency obligatoria; si falla, no destruye |
| JWT casero inseguro | Firmado con secret en SSM Parameter Store + expiración corta |
| CloudFront tarda en invalidar | Workflow espera a invalidación antes de cerrar |

---

## 12. Siguiente paso concreto

Decir "go" y arranco por **Semana 1 — paso 1**: estructura de carpetas `infra/` + `backend.tf` + `bootstrap.yml`.
