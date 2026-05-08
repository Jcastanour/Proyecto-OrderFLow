# 🎨 Instrucciones para generar el diagrama de arquitectura de OrderFlow

> Pegar todo lo que está debajo de la línea en ChatGPT Images / DALL·E / cualquier generador de imágenes.

---

## PROMPT PARA LA IMAGEN

Create a **professional, clean, high-resolution AWS cloud architecture diagram** for a food ordering system called **"OrderFlow"**. The diagram must look like an official AWS reference architecture (similar to the ones published by AWS on their whitepapers and well-architected framework). Use **official AWS service icons** (the square icons with colored backgrounds: orange for compute, blue for networking, green for storage, red for security, purple for management, pink for application integration).

### Visual style
- **Orientation**: horizontal (landscape), 16:9 aspect ratio.
- **Background**: white or very light gray (#F5F7FA).
- **Typography**: sans-serif, clean (similar to Amazon Ember or Inter). Small service names under each icon, bold section titles.
- **Color palette**: AWS official — orange `#FF9900`, dark blue `#232F3E`, light blue `#1A73E8`, green `#7AA116`, purple `#7D3C98`.
- **Arrows**: thin, dark gray, with clear arrowheads; label each arrow with a short verb ("invokes", "publishes", "reads", "writes", "fan-out", "notifies").
- **Grouping**: wrap related services in **rounded rectangles** (light dashed border) with a title label on top-left corner of each group (e.g., "Frontend Layer", "API Layer", "Compute Layer", "Data Layer", "Messaging Layer", "Observability", "CI/CD").
- **No clutter**, lots of whitespace, everything readable.

### Layout — 7 horizontal bands / groups, left to right and top to bottom

**1. User (far left)**
- A single user icon labeled **"User (Client / Kitchen / Delivery / Admin)"**.
- Arrow going right labeled **"HTTPS"** to CloudFront.

**2. Frontend Layer** (rounded rectangle, title "Frontend Layer")
- **Amazon CloudFront** icon.
- **Amazon S3** icon labeled "Static Site (HTML + Tailwind + Vanilla JS)".
- Arrow CloudFront → S3 labeled "origin".
- Below S3 put 4 small boxes labeled: `/cliente`, `/cocina`, `/domi`, `/admin` (role-based panels).

**3. API Layer** (rounded rectangle, title "API Layer")
- **Amazon API Gateway (HTTP API)** icon.
- Arrow from CloudFront to API Gateway labeled **"fetch / JWT"**.

**4. Compute Layer** (rounded rectangle, title "Compute Layer — AWS Lambda (Node.js 20)")
- 5 Lambda icons side by side, each labeled:
  - `auth` (login, JWT)
  - `orders` (CRUD)
  - `products` (CRUD)
  - `mailer` (email consumer)
  - `kitchen` (kitchen consumer)
- Arrow from API Gateway to first 3 Lambdas (auth, orders, products) labeled "invokes".

**5. Data Layer** (rounded rectangle, title "Data Layer")
- **Amazon DynamoDB** shown as 4 table icons labeled: `Users`, `Orders`, `Products`, `Notifications`.
- Arrow from Lambdas to DynamoDB labeled **"read / write"**.
- **AWS Systems Manager — Parameter Store** icon labeled "JWT secret".
- Arrow from `auth` Lambda to Parameter Store labeled "reads".

**6. Messaging Layer** (rounded rectangle, title "Event-Driven Messaging")
- **Amazon EventBridge** icon in the center labeled "OrderFlow Bus".
- Arrow from `orders` Lambda to EventBridge labeled **"publishes `order.created`, `order.ready`, `order.delivered`"**.
- Fan-out from EventBridge to:
  - **SQS queue** `email-queue` → arrow to `mailer` Lambda → arrow to **Amazon SES** (or SNS email).
  - **SQS queue** `kitchen-queue` → arrow to `kitchen` Lambda.
  - **Amazon SNS** topic `admin-alerts` → arrow to email icon labeled "Admin email/SMS".

**7. Observability** (rounded rectangle at the bottom, title "Observability")
- **Amazon CloudWatch** icon — labeled "Logs + Metrics + Alarms + Dashboard".
- **AWS X-Ray** icon labeled "Tracing".
- Dotted arrows from all Lambdas and API Gateway to CloudWatch.

**8. CI/CD & IaC** (rounded rectangle on the right side or top-right, title "CI/CD & Infrastructure as Code")
- **GitHub Actions** logo.
- **Terraform** logo.
- Two AWS account icons labeled **"Personal Account ($25 credits)"** and **"Betek Bootcamp Account"**.
- Arrows from GitHub Actions to both accounts labeled **"OIDC assume-role"**.
- Small icons inside: "Deploy ▶", "Destroy ⏹".
- **Amazon S3** icon labeled "Seeds / Backups bucket" with arrows labeled "backup before destroy" and "restore after deploy" connecting to DynamoDB.

### Required labels / annotations
Add these small text annotations as floating notes near the relevant groups:
- Near Messaging: *"EventBridge = central event bus — fan-out pattern"*.
- Near Data: *"DynamoDB On-Demand — multi-table"*.
- Near CI/CD: *"One-click Deploy & Destroy from GitHub Actions UI"*.
- Near CI/CD: *"Automatic DB backup to S3 before destroy, auto-restore after deploy"*.

### Top title bar
Big bold title at the top center:
**"OrderFlow — Serverless Food Ordering Platform on AWS"**
Subtitle (smaller, gray): *"Event-driven architecture · Terraform IaC · Dual-account CI/CD"*.

### Bottom legend
A small horizontal legend at the bottom with 4 colored dots:
- 🟧 Compute
- 🟦 Networking / API
- 🟩 Storage / Data
- 🟪 Messaging / Integration

### Do NOT include
- No photorealistic elements.
- No 3D isometric style — keep it **flat 2D**.
- No cartoon characters.
- No extra fictional services (only the AWS services listed above).
- No VPC/subnets (this is pure serverless, no VPC).

### Output
High-resolution PNG, suitable for a university final project presentation slide.

---

## (Opcional) Versión corta para si ChatGPT recorta el prompt

> Flat 2D AWS architecture diagram, landscape 16:9, white background, official AWS icons. Title: "OrderFlow — Serverless Food Ordering Platform on AWS". Groups in rounded dashed rectangles: (1) User → CloudFront → S3 static site with panels cliente/cocina/domi/admin. (2) API Gateway HTTP API. (3) Lambdas: auth, orders, products, mailer, kitchen. (4) DynamoDB tables Users/Orders/Products/Notifications + SSM Parameter Store. (5) EventBridge bus fan-out to SQS email-queue, SQS kitchen-queue, SNS admin-alerts → SES email. (6) CloudWatch + X-Ray observability. (7) GitHub Actions + Terraform deploying via OIDC to two AWS accounts (Personal + Betek), with S3 seeds bucket for backup-before-destroy and restore-after-deploy. Clean arrows with verb labels, AWS color palette, professional whitepaper style.
