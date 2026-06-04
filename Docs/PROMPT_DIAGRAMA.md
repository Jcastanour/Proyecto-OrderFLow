# 🎨 Prompt para generar `Docs/diagrama-arquitectura.png`

> Copiar TODO el bloque debajo de la línea y pegarlo en ChatGPT (con generación de imágenes), Gemini, DALL·E o el generador de tu preferencia.

---

## PROMPT (versión completa · actualizado al estado final del repo)

Create a **professional, clean, high-resolution AWS cloud architecture diagram** for a serverless food-delivery app called **"OrderFlow"** (a Colombian food delivery platform). Style it like an official AWS reference architecture (whitepaper / Well-Architected Framework). Use **official AWS service icons** with their standard color squares (orange = compute, pink = application integration, blue = networking, green = storage/database, red = security/auth, purple = management).

**Format:** flat 2D, landscape 16:9, white background (#FFFFFF), clean sans-serif typography (Amazon Ember or Inter style), generous whitespace, dark-gray thin arrows with arrowheads and short verb labels ("invokes", "publishes", "fan-out", "queries", "scans", "reads", "writes", "notifies", "authenticates"). Group related services in **rounded rectangles with light dashed borders** with a small title label on the top-left of each group.

**Top title (bold, centered):** "OrderFlow — Serverless Food Delivery on AWS"
**Subtitle (smaller, gray italic):** "Event-driven · Cognito auth · Terraform IaC · GitHub Actions CI/CD · 3 roles (Cliente · Cocina · Repartidor)"

**Layout (left to right, top to bottom):**

1. **Far left — User**: a single user icon labeled **"User (Cliente / Cocina / Repartidor)"** with note "100% Colombia traffic, no CDN needed". Two arrows going right:
   - **HTTPS → S3 site** (loads frontend)
   - **HTTPS → Cognito** (login / signup with email confirmation)

2. **Group "Authentication" (NEW)** (red color theme):
   - **Amazon Cognito User Pool** icon labeled "User Pool + App Client".
   - Note: "Email-based signup with confirmation code".
   - Arrow Cognito → user labeled "JWT token (id + access)".
   - Arrow user → API Gateway labeled **"fetch + Bearer token"**.

3. **Group "Frontend Layer"**:
   - Amazon S3 (Static Website Hosting) labeled "OrderFlow site (HTML + Vanilla JS + CSS)".
   - 4 small panel boxes below: `index.html (cliente)`, `cocina.html`, `domiciliario.html`, `nosotros.html`.
   - Note: "HTTP-only · no CloudFront · users in Colombia".

4. **Group "API Layer"**: Amazon API Gateway HTTP API labeled **"8 routes"** with sub-labels:
   - `/orders` (POST, GET, GET/{id}, PATCH/{id})
   - `/orders/user/{email}` (GET) ← NEW with Cognito context
   - `/products` (GET, GET/{id})
   - `/riders/{id}` (GET)

5. **Group "Compute Layer — AWS Lambda (Python 3.12)"**: four Lambda icons in a row, each labeled:
   - `orders_handler` — CRUD pedidos + publishes events to EventBridge + queries GSI UserEmailIndex.
   - `products_handler` — list/get products + resolves image URL from S3 by slug matching.
   - `riders_handler` — get rider profile.
   - `notifier_handler` — SQS consumer → SNS publisher.
   Arrows from API Gateway to `orders`, `products`, `riders` labeled "invokes".

6. **Group "Data Layer"**:
   - Amazon DynamoDB shown as **3 table icons** labeled:
     - `orders` with subnote "PK: orderId · **GSI: UserEmailIndex**"
     - `products` (PK: productId · 24 items)
     - `riders` (PK: riderId)
     - All marked "PAY_PER_REQUEST · on-demand".
   - Amazon S3 bucket labeled **"Images bucket (public + CORS)"** with note "11 colombian food PNGs".
   - Arrows:
     - `orders_handler` ↔ DynamoDB `orders` labeled "PutItem / UpdateItem / Scan"
     - `orders_handler` → DynamoDB `orders` GSI labeled "Query UserEmailIndex (user orders)"
     - `products_handler` → DynamoDB `products` labeled "Scan / GetItem"
     - `products_handler` → S3 images bucket labeled "ListObjects + slug match"
     - `riders_handler` → DynamoDB `riders` labeled "GetItem"

7. **Group "Event-Driven Messaging"**:
   - Amazon EventBridge in the center labeled **"OrderFlow Bus"** (custom event bus).
   - Arrow `orders_handler` → EventBridge labeled **"publishes OrderCreated / OrderStatusChanged"**.
   - Fan-out from EventBridge to:
     - Amazon SQS `notifications-queue` (with DLQ visual) → arrow to `notifier_handler` Lambda.
     - Arrow `notifier_handler` → Amazon SNS topic `admin-alerts` → email icon labeled "📧 Admin email".

8. **Group "Observability"** (bottom band):
   - Amazon CloudWatch icon labeled **"12 alarms · 1 dashboard with 8 widgets"** with sub-notes:
     - "4 × Lambda Errors (one per function)"
     - "1 × API Gateway 5xx"
     - "1 × SQS age > 5min"
     - "6 × DynamoDB throttles (3 tables × read+write)"
   - Dotted arrows from all 4 Lambdas + API Gateway → CloudWatch.
   - Arrow CloudWatch alarms → SNS `admin-alerts` labeled "alarm → email".

9. **Group "CI/CD & Infrastructure as Code"** (top-right band):
   - GitHub Actions logo + Terraform logo (1.9.8).
   - Two AWS account icons labeled **"AWS Personal Account ($25 credits, daily dev)"** and **"AWS Betek Account (project day)"**.
   - Arrows from GitHub Actions → both accounts labeled **"AssumeRole with credentials"**.
   - Small badges inside: "▶ Deploy (push to main = auto)", "🎯 workflow_dispatch (choose target)", "⏹ Destroy (manual, confirm 'DESTROY')".
   - Note: "Terraform state in S3 bucket `orderflow-g2p4-tfstate` (versioning enabled)".
   - Note: "Seed: Python script populates 24 products + riders on every deploy".

**Floating annotations (small italic gray text near each group):**
- Near Auth: *"Cognito free tier: 50K MAU. JWT validated client-side, sent in headers."*
- Near Compute: *"Least-privilege IAM role per Lambda. Memory 128MB."*
- Near Data: *"DynamoDB schemaless: orders has direccion + riderId + userEmail. GSI for user query."*
- Near Images: *"Dynamic image matching: slugify(product.name) → bucket key. Add PNG, redeploy, done."*
- Near Messaging: *"EventBridge = central event bus. Fan-out decouples producers from consumers."*
- Near CI/CD: *"Multi-account: same Terraform, different AWS credentials via 4 GitHub Secrets."*
- Near Frontend: *"No CloudFront: 100% Colombia traffic, sub-MB site, cache evitable. Saves $5-8/mes."*

**Bottom legend** (small horizontal row with colored dots):
🟧 Compute · 🩷 Application Integration · 🟩 Storage/Data · 🟦 Networking/API · 🟪 Management/CI · 🟥 Authentication

**Footer (small, centered):** "OrderFlow · Grupo 02 · Proyecto 04 · Bootcamp BeTek Cloud 2026"

**Do NOT include:**
- No VPC, subnets, NAT gateways (pure serverless).
- No 3D / isometric style — keep flat 2D.
- No cartoon characters or photorealistic elements.
- No services beyond the ones listed (no EC2, no RDS, no ECS, no Docker, no CloudFront, no Step Functions).

**Output:** high-resolution PNG, presentation-quality, ready for a university final-project slide.

---

## PROMPT (versión corta, por si el modelo recorta)

> Flat 2D AWS architecture diagram, landscape 16:9, white background, official AWS icons. Title: "OrderFlow — Serverless Food Delivery on AWS". Groups in dashed rounded rectangles: (1) User in Colombia → Cognito User Pool for login (red theme) → S3 static site with 4 panels (cliente/cocina/domiciliario/nosotros). (2) API Gateway HTTP API with 8 routes including /orders/user/{email}. (3) Four Python 3.12 Lambdas: orders_handler (with EventBridge publish + GSI UserEmailIndex query), products_handler, riders_handler, notifier_handler. (4) DynamoDB tables orders (with GSI UserEmailIndex), products, riders + S3 images bucket public with CORS. (5) EventBridge bus fan-out to SQS notifications-queue → notifier Lambda → SNS admin-alerts → email. (6) CloudWatch with 12 alarms (4 Lambda errors + 1 API 5xx + 1 SQS age + 6 DynamoDB throttles) + 1 dashboard. (7) GitHub Actions + Terraform 1.9.8 deploying to two AWS accounts (Personal + Betek) with state in S3 bucket orderflow-g2p4-tfstate. Clean arrows with verb labels, AWS color palette including red for Cognito, professional whitepaper style, no VPC, no containers, no CloudFront (annotated: "100% Colombia traffic"). Footer: "Grupo 02 · Proyecto 04 · BeTek Cloud 2026".

---

## Cuando tengas el PNG

Guárdalo como `Docs/diagrama-arquitectura.png` en el repo. El README ya hace referencia a esa ruta.

---

## Cheat sheet de cambios desde la versión anterior del prompt

Lo nuevo en esta versión:
- ➕ **Cognito User Pool** como módulo separado (auth con email + confirmación).
- ➕ **GSI `UserEmailIndex`** en tabla orders.
- ➕ **Ruta nueva** `GET /orders/user/{email}` para que cada cliente vea sus pedidos.
- ➕ **Conteo correcto** de rutas API (8 totales) y alarmas CloudWatch (12).
- ➕ Justificación explícita "no CloudFront porque 100% Colombia" con costo evitado.
- ➕ Annotation que aclara que el sitio es HTTP-only.
- ➕ Detalles de las 4 categorías de alarmas.
- ➕ Terraform versión actualizada a 1.9.8 (fix del bug PGP).
