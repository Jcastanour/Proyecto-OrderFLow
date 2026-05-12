# 🎨 Prompt para generar `docs/diagrama-arquitectura.png`

> Copiar TODO el bloque debajo de la línea y pegarlo en ChatGPT (con generación de imágenes), Gemini, DALL·E o el generador de tu preferencia.

---

## PROMPT (versión completa)

Create a **professional, clean, high-resolution AWS cloud architecture diagram** for a serverless food-delivery app called **"OrderFlow"** (a Colombian food delivery platform). Style it like an official AWS reference architecture (whitepaper / Well-Architected Framework). Use **official AWS service icons** with their standard color squares (orange = compute, pink = application integration, blue = networking, green = storage/database, red = security, purple = management).

**Format:** flat 2D, landscape 16:9, white background (#FFFFFF), clean sans-serif typography (Amazon Ember or Inter style), generous whitespace, dark-gray thin arrows with arrowheads and short verb labels ("invokes", "publishes", "fan-out", "reads", "writes", "notifies"). Group related services in **rounded rectangles with light dashed borders** with a small title label on the top-left of each group.

**Top title (bold, centered):** "OrderFlow — Serverless Food Delivery on AWS"
**Subtitle (smaller, gray italic):** "Event-driven · Terraform IaC · GitHub Actions CI/CD · 3 roles (Cliente · Cocina · Repartidor)"

**Layout (left to right, top to bottom):**

1. **Far left — User**: a single user icon labeled **"User (Cliente / Cocina / Repartidor)"**. Arrow → S3/Frontend labeled **"HTTPS"**.

2. **Group "Frontend Layer"**:
   - Amazon S3 (Static Website Hosting) labeled "OrderFlow site (HTML + Vanilla JS + CSS)".
   - 3 small panel boxes below: `index.html (cliente)`, `cocina.html`, `domiciliario.html`.
   - Arrow user → S3.

3. **Group "API Layer"**: Amazon API Gateway HTTP API labeled "7 routes: /orders /products /riders". Arrow S3 frontend → API Gateway labeled **"fetch JSON"**.

4. **Group "Compute Layer — AWS Lambda (Python 3.12)"**: four Lambda icons side by side, each labeled:
   - `orders_handler` (CRUD pedidos, publishes events)
   - `products_handler` (lista catálogo, resolve image URLs from S3)
   - `riders_handler` (perfil del repartidor)
   - `notifier_handler` (SQS consumer → SNS publisher)
   Arrows API Gateway → `orders`, `products`, `riders` labeled "invokes".

5. **Group "Data Layer"**:
   - Amazon DynamoDB shown as **3 table icons** labeled `orders`, `products`, `riders` (note: "PAY_PER_REQUEST · on-demand").
   - Amazon S3 bucket labeled **"Images bucket (public, CORS enabled)"** with note "11 colombian food PNGs".
   - Arrows from `orders_handler` → DynamoDB `orders` labeled "read/write".
   - Arrows from `products_handler` → DynamoDB `products` labeled "scan" AND to S3 images bucket labeled "list/getObject (slug match)".
   - Arrow from `riders_handler` → DynamoDB `riders` labeled "getItem".

6. **Group "Event-Driven Messaging"**:
   - Amazon EventBridge in the center labeled **"OrderFlow Bus"** (custom event bus).
   - Arrow `orders_handler` → EventBridge labeled **"publishes OrderCreated / OrderStatusChanged"**.
   - Fan-out from EventBridge to:
     - Amazon SQS `notifications-queue` (with DLQ visual) → arrow to `notifier_handler` Lambda.
     - Arrow `notifier_handler` → Amazon SNS topic `admin-alerts` → email icon labeled "📧 Admin email".

7. **Group "Observability"** (bottom band):
   - Amazon CloudWatch icon labeled **"12 alarms · 1 dashboard with 8 widgets"** (note: "Lambda errors · API 5xx · SQS age · DynamoDB throttles").
   - Dotted arrows from all 4 Lambdas + API Gateway → CloudWatch.
   - Arrow CloudWatch alarms → SNS `admin-alerts` labeled "alarm → email".

8. **Group "CI/CD & Infrastructure as Code"** (top-right band):
   - GitHub Actions logo + Terraform logo.
   - Two AWS account icons labeled **"AWS Personal Account ($25 credits, daily dev)"** and **"AWS Betek Account (project day)"**.
   - Arrows from GitHub Actions → both accounts labeled **"AssumeRole with credentials"**.
   - Small badges inside the group: "▶ Deploy (push to main)", "⏹ Destroy (manual, confirm 'DESTROY')".
   - Note: "Terraform state in S3 bucket `orderflow-g2p4-tfstate`".
   - Note: "Seed via Python script: 24 products + 1 rider populated automatically on every deploy".

**Floating annotations (small italic gray text near each group):**
- Near Compute: *"Least-privilege IAM role per Lambda"*
- Near Data: *"DynamoDB schemaless: orders has direccion + riderId fields added dynamically"*
- Near Images: *"Dynamic image matching: filename slug → product name (slugify normalize)"*
- Near Messaging: *"EventBridge = central event bus, fan-out pattern, decouples producers from consumers"*
- Near CI/CD: *"Multi-account: same Terraform, different AWS credentials via GitHub Secrets"*

**Bottom legend** (small horizontal row with colored dots):
🟧 Compute · 🩷 Application Integration · 🟩 Storage/Data · 🟦 Networking/API · 🟪 Management/CI

**Footer (small, centered):** "OrderFlow · Grupo 02 · Proyecto 04 · Bootcamp BeTek Cloud 2026"

**Do NOT include:**
- No VPC, subnets, NAT gateways (this is pure serverless).
- No 3D / isometric style — keep flat 2D.
- No cartoon characters or photorealistic elements.
- No services beyond the ones listed (no EC2, no RDS, no ECS, no Cognito, no Docker, no CloudFront).

**Output:** high-resolution PNG, presentation-quality, ready for a university final-project slide.

---

## PROMPT (versión corta, por si el modelo recorta)

> Flat 2D AWS architecture diagram, landscape 16:9, white background, official AWS icons. Title: "OrderFlow — Serverless Food Delivery on AWS". Groups in dashed rounded rectangles: (1) User → S3 static site with 3 panels (cliente/cocina/domiciliario). (2) API Gateway HTTP API (7 routes). (3) Four Python 3.12 Lambdas: orders_handler, products_handler, riders_handler, notifier_handler. (4) DynamoDB tables orders/products/riders + S3 images bucket. (5) EventBridge bus fan-out to SQS notifications-queue → notifier Lambda → SNS admin-alerts → email. (6) CloudWatch with 12 alarms + 1 dashboard. (7) GitHub Actions + Terraform deploying to two AWS accounts (Personal + Betek) with state in S3 bucket orderflow-g2p4-tfstate. Clean arrows with verb labels, AWS color palette, professional whitepaper style, no VPC, no containers. Footer: "Grupo 02 · Proyecto 04 · BeTek Cloud 2026".

---

## Cuando tengas el PNG

Guárdalo como `docs/diagrama-arquitectura.png` en el repo. El README ya hace referencia a esa ruta.
