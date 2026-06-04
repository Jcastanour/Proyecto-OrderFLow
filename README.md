# 🛵 OrderFlow

**App de domicilios de comida colombiana**, construida 100% serverless sobre AWS con Terraform y desplegada con GitHub Actions.

> **Proyecto final** · Bootcamp BeTek Cloud · **Grupo 02** · **Proyecto 04**

---

## 🎯 Qué hace

Tres roles, una sola plataforma:

| Rol | Vista | Qué hace |
|---|---|---|
| 🍽️ **Cliente** | `index.html` | Explora 24 platos colombianos en 6 categorías, agrega al carrito, hace pedido y ve el tracker en tiempo real. |
| 👨‍🍳 **Cocina** | `cocina.html` | Dashboard con KPIs del día y kanban Recibido → En Cocina → Listo. |
| 🛵 **Repartidor** | `domiciliario.html` | Perfil con rating, ve pedidos listos para recoger, los acepta y marca como entregados. |

---

## 🏗️ Arquitectura

![Arquitectura de OrderFlow en AWS](Docs/arquitectura.png)

100% **serverless** y **event-driven**, todo provisionado con Terraform:

- **Acceso & Frontend** — CloudFront + S3 sirven el sitio estático; **Cognito (User Pool)** maneja el registro/login de usuarios.
- **API** — API Gateway HTTP enruta a las Lambdas de negocio.
- **Lógica de negocio (Compute)** — 4 Lambdas (`orders`, `products`, `riders`, `notifier`) en Python 3.12 sobre DynamoDB (orders, products, riders) y un bucket S3 de imágenes.
- **Notificaciones (event-driven)** — los eventos de dominio van a **EventBridge → SQS → Lambda notifier → SNS → 📧 email**.
- **Observabilidad** — CloudWatch con alarmas + dashboard.
- **DevOps (CI/CD)** — GitHub Actions corre Terraform y despliega a la cuenta elegida (personal ↔ betek).

<details>
<summary>Ver el mismo flujo en ASCII</summary>

```
  Cliente ─► CloudFront/S3 ─► (Cognito login)
                   │ HTTPS fetch
                   ▼
            API Gateway HTTP
          ┌────────┼────────┐
       orders   products   riders        (Lambdas Python 3.12)
          │        │          │
       DynamoDB  DynamoDB  DynamoDB  +  S3 imágenes
       (orders)  (products)(riders)
          │
     EventBridge ─► SQS ─► Lambda notifier ─► SNS ─► 📧 email

  Observabilidad: CloudWatch (alarmas + dashboard)
  CI/CD: GitHub Actions (deploy/destroy multi-cuenta personal ↔ betek)
```
</details>

---

## 🧱 Stack AWS

| Servicio | Para qué |
|---|---|
| **Lambda** (Python 3.12) | 4 funciones: `orders`, `notifier`, `products`, `riders` |
| **API Gateway HTTP** | 7 rutas REST (`/orders`, `/products`, `/riders`) |
| **Cognito** | User Pool + client para registro/login de usuarios |
| **CloudFront** | CDN delante del sitio estático en S3 |
| **DynamoDB** | 3 tablas on-demand: `orders`, `products`, `riders` |
| **S3** | 3 buckets: state Terraform, sitio web, imágenes de comida |
| **EventBridge** | Bus central de eventos de dominio |
| **SQS** | Cola entre EventBridge y Lambda notifier |
| **SNS** | Topic de alertas → email al admin |
| **CloudWatch** | 12 alarmas (Lambda errors, API 5xx, SQS age, DynamoDB throttles) + dashboard |
| **IAM** | Roles least-privilege por Lambda |

---

## 🛠️ Stack del frontend

- **HTML5 + Vanilla JS (ES Modules) + CSS modular** — sin frameworks, sin bundler.
- **Diseño 2026**: paleta brasa/cilantro/yuca, tipografías Inter + Manrope, mobile-first.
- **Adapter mock ↔ AWS**: el frontend funciona en local sin AWS (modo mock) o contra el API real (modo AWS), según `window.ENV.API_URL`.
- **Matching dinámico de imágenes**: tirá un archivo `{slug-del-plato}.png` (o `.jpg`, `.svg`, `.webp`) en `/images/` y el deploy lo asocia automáticamente al producto correspondiente. Sin tocar código.

---

## 📁 Estructura del repo

```
.github/workflows/
├── deploy.yml          ← Push a main = deploy automático (CI/CD)
└── destroy.yml         ← Botón manual con confirmación

infra/                  ← TODA la infraestructura (Terraform modular)
├── main.tf, outputs.tf, variables.tf, providers.tf, backend.tf
├── seed/
│   ├── products.json   ← 24 platos
│   ├── riders.json     ← 1 rider demo
│   └── seed_dynamo.py  ← Carga los JSON en DynamoDB
└── modules/
    ├── data/           — Tablas DynamoDB
    ├── compute/        — Lambdas (Python 3.12)
    │   └── lambdas/    — orders_handler, notifier_handler, products_handler, riders_handler
    ├── api/            — API Gateway HTTP + rutas + integraciones
    ├── messaging/      — EventBridge bus + SQS + SNS
    ├── images/         — Bucket S3 público de imágenes
    ├── auth/           — Cognito User Pool + client (login)
    ├── frontend/       — Bucket S3 + CloudFront + website hosting
    └── observability/  — Alarmas CloudWatch + Dashboard

frontend/               ← El sitio (3 vistas)
├── index.html          — Cliente
├── cocina.html         — Admin/cocina
├── domiciliario.html   — Repartidor
├── nosotros.html       — Página informativa
└── assets/             — CSS, JS, copias locales de imágenes para modo mock

images/                 ← FUENTE DE VERDAD de las imágenes de comida
                          (se suben automáticamente al bucket S3 en cada deploy)

scripts/                ← Utilidades operativas (ver sección abajo)
├── load_test.py        — Generador de carga contra el API
├── load_test_ramp.py   — Carga en rampa (escalonada)
└── watch_orderflow.py  — Dashboard en vivo en terminal

Docs/                   ← Diagrama, planes, contexto y requisitos del proyecto
```

---

## 🚀 Cómo desplegar

### Pre-requisitos (una sola vez por cuenta AWS)

1. **Bucket de state Terraform** (mismo nombre en ambas cuentas):
   ```bash
   aws s3api create-bucket --bucket orderflow-g2p4-tfstate --region us-east-1
   aws s3api put-bucket-versioning --bucket orderflow-g2p4-tfstate \
       --versioning-configuration Status=Enabled
   ```

2. **Usuario IAM** con `PowerUserAccess` (genera Access Key + Secret).

3. **Secrets en GitHub** (`Settings → Secrets and variables → Actions`):

   | Secret | Para qué |
   |---|---|
   | `AWS_ACCESS_KEY_ID_PERSONAL` | Credenciales cuenta personal |
   | `AWS_SECRET_ACCESS_KEY_PERSONAL` | — |
   | `AWS_ACCESS_KEY_ID_BETEK` | Credenciales cuenta del bootcamp |
   | `AWS_SECRET_ACCESS_KEY_BETEK` | — |

### Deploy automático

```bash
git push origin main
```

Esto dispara `deploy.yml` que:
1. Corre `terraform apply` (crea TODA la infra).
2. Sube las imágenes de `/images/` al bucket S3.
3. Pobla las tablas DynamoDB con los seeds.
4. Notifica al SNS con las URLs finales (llega email).

### Deploy manual a la cuenta que elijas

`Actions` → `Deploy a AWS` → `Run workflow` → elegís `personal` o `betek`.

### Destruir todo

`Actions` → `Destroy AWS` → `Run workflow` → elegís cuenta + escribís literal `DESTROY` para confirmar.

---

## 🧪 Probar después del deploy

Al terminar el deploy, en `Actions tab` ves las URLs en el job summary. Probá:

```bash
# Listar los 24 productos
curl https://<api_url>/products | jq 'length'

# Producto con imageUrl resuelto desde S3
curl https://<api_url>/products/p002 | jq '.imageUrl'

# Crear pedido con dirección
curl -X POST https://<api_url>/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":"Juan","items":["Bandeja Paisa"],"total":25000,"direccion":"Calle 85"}'

# Asignar repartidor (rider acepta el pedido)
curl -X PATCH https://<api_url>/orders/<id> \
  -H "Content-Type: application/json" \
  -d '{"status":"En Camino","riderId":"r001"}'
```

En el navegador: abrí el `site_url` del summary y andá rotando por las 3 vistas.

---

## 💻 Desarrollo local (sin AWS)

```bash
cd frontend
python3 -m http.server 8000
```

Abrí `http://localhost:8000/index.html`. Como `window.ENV.API_URL` está vacío, el frontend usa el adapter mock con los datos en memoria.

Para sumar una imagen nueva en modo mock, copiala a `frontend/assets/img/{slug}.{ext}`. Para producción, la fuente de verdad es `/images/` raíz (el workflow hace `aws s3 sync` desde ahí al bucket S3).

---

## 📊 Scripts de carga y monitoreo

Utilidades en `scripts/` para probar y observar el sistema en vivo (requieren `pip install requests boto3`):

```bash
# Pruebas de carga contra el API (70% lecturas, 20% lectura puntual, 10% escritura)
python3 scripts/load_test.py --api-url https://<api_url> --total 500 --concurrency 50

# Carga en rampa (escala la concurrencia por etapas)
python3 scripts/load_test_ramp.py --api-url https://<api_url>

# Dashboard en vivo en la terminal (pedidos por estado, invocaciones/errores Lambda, SQS)
python3 scripts/watch_orderflow.py
```

---

## ✅ Requisitos del PDF cumplidos

- AWS Lambda procesando el flujo de pedidos (4 Lambdas en total).
- API Gateway HTTP con endpoints `POST /orders`, `GET /orders`, `PATCH /orders/{id}`.
- DynamoDB para almacenamiento (3 tablas: orders, products, riders).
- Frontend web con formulario de pedido + tracker en tiempo real.
- Integración con backend mediante fetch al API Gateway.
- Pipeline CI/CD con GitHub Actions (deploy automático en push a main).
- Notificaciones de fallo del pipeline al SNS topic admin-alerts.
- CloudWatch con métricas y alarmas (12 alarmas + dashboard).
- Integración SNS + SQS con Lambdas (EventBridge → SQS → Lambda notifier → SNS).
- Repositorio GitHub con backend + frontend + pipeline IaC.
- README con instrucciones y diagrama de arquitectura.

---

## 👥 Equipo

**Grupo 02** · **Proyecto 04** · Bootcamp BeTek Cloud 2026

— OrderFlow, comida colombiana sin intermediarios glamorosos.
