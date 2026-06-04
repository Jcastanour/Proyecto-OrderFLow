# OrderFlow — Contexto para calculadora de costos AWS

> Documento auto-contenido para pasar a otro chat / herramienta de costing.
> Describe el sistema, las decisiones de arquitectura, los volúmenes esperados
> y los parámetros necesarios para estimar la factura AWS por mes.

---

## 1. Qué es OrderFlow

**App de domicilios de comida colombiana**, proyecto final del Bootcamp BeTek Cloud (Grupo 02 · Proyecto 04). Sirve a 3 roles distintos:

| Rol | Acción típica |
|---|---|
| 🍽️ Cliente | Abre el catálogo, navega 24 platos en 6 categorías, agrega al carrito, hace pedido con dirección, ve tracker en tiempo real |
| 👨‍🍳 Cocina | Dashboard kanban: ve pedidos entrantes, los mueve a "En Cocina" → "Listo" |
| 🛵 Repartidor | Ve pedidos en estado "Listo", los acepta (entra a "En Camino"), marca como entregados |

Mercado: **restaurantes y asaderos locales en Colombia** que quieren su propia plataforma sin pagar 30% de comisión a las grandes apps.

---

## 2. Stack AWS completo

Arquitectura **100% serverless**, sin servidores fijos. Toda la infra está en Terraform modular.

### 2.1 Componentes y rol de cada uno

| Servicio | Cuántos | Para qué | Costo modelo |
|---|---|---|---|
| **API Gateway HTTP API** | 1 | Punto de entrada único. 10+ rutas REST en `/orders`, `/products`, `/riders`. | $1.00/M requests |
| **AWS Lambda** (Python 3.12) | 4 funciones | `orders_handler`, `products_handler`, `riders_handler`, `notifier_handler`. Lógica de negocio. | $0.20/M invocations + GB-sec |
| **DynamoDB** (on-demand) | 3 tablas | `orders` (con GSI por userEmail), `products` (24 items), `riders` (1+ items). | $1.25/M write + $0.25/M read |
| **S3** | 3 buckets | (1) state Terraform, (2) sitio web estático, (3) imágenes de comida públicas. | $0.023/GB-mes + requests |
| **EventBridge** | 1 bus custom | Bus `orderflow-bus`. Recibe eventos `OrderCreated` y `OrderStatusChanged`. | $1.00/M events |
| **SQS** | 1 cola | `notifications-queue` entre EventBridge y Lambda notifier. | $0.40/M requests |
| **SNS** | 1 topic | `admin-alerts`. Email al equipo cuando hay pedidos o alarmas. | $0.50/M API + $2/100K emails |
| **CloudWatch** | 12 alarmas + 1 dashboard + logs de 4 Lambdas | Observabilidad y alerting. Retención de logs 7 días. | $0.10/alarm + $0.50/GB logs |
| **IAM** | 4 roles + 1 deploy user | Roles least-privilege por Lambda. Usuario IAM para GitHub Actions. | Gratis |
| **Cognito User Pool** | 1 pool | Auth de clientes (signup, login, confirmación por email). Mantiene `userEmail` que se usa como key del GSI en `orders`. | 50K MAUs gratis + $0.0055/MAU |

### 2.2 Lo que NO usamos (y por qué)

- ❌ **CloudFront** — Argumento abajo en sección 5.
- ❌ **EC2 / RDS** — todo serverless, sin servers fijos que costean por hora.
- ❌ **VPC** — Lambda corre en la red gestionada de AWS. Sin VPC = sin NAT Gateway ($35/mes), sin cold starts extra de ENI.
- ❌ **API Gateway REST API** — preferimos HTTP API (~70% más barata, suficiente para nuestro caso).
- ❌ **DynamoDB Provisioned** — usamos on-demand porque el tráfico es irregular (picos a la hora del almuerzo, bajo en madrugada).
- ❌ **ECS / Fargate / Docker** — sin contenedores. Lambda con runtime nativo Python.
- ❌ **Step Functions** — el flujo de pedidos es event-driven simple, no requiere orquestación compleja.

---

## 3. Arquitectura y flujos

### 3.1 Diagrama de alto nivel

```
[Cliente Web (Colombia)] ──HTTPS──> [S3 sitio público] (estático)
       │
       │ fetch JSON
       ▼
[API Gateway HTTP] ───┬─────> [Lambda orders_handler]    ─┬─> DynamoDB orders + GSI UserEmailIndex
                      ├─────> [Lambda products_handler]    ├─> DynamoDB products + S3 images (matching slug)
                      ├─────> [Lambda riders_handler]      └─> DynamoDB riders
                      │
                      │ orders_handler también:
                      └────> publica evento ──> [EventBridge bus]
                                                      │
                                              fan-out a:
                                              ├─> [SQS] ──> [Lambda notifier] ──> [SNS] ──> 📧 Email
                                              └─> CloudWatch metrics

[Cognito User Pool] ←── signup/login (cliente) ──┐
                                                 │
                                          el JWT viaja en headers
                                          del frontend al API
```

### 3.2 Tablas DynamoDB (schema)

#### `orders`
- **PK**: `orderId` (UUID string)
- **GSI**: `UserEmailIndex` con hash key `userEmail` → permite "GET /orders/user/{email}" eficiente para que un cliente vea SUS pedidos.
- Atributos: `customer`, `userEmail`, `items[]`, `total`, `status`, `createdAt`, `direccion`, `riderId` (opcional).
- Modo: **PAY_PER_REQUEST**.

#### `products`
- **PK**: `productId` (string, ej. "p001")
- Atributos: `name`, `description`, `price`, `category`, `emoji`, `tags`, `rating`, `prepMinutes`, `available`.
- **No tiene** `imageKey` — la imagen se resuelve dinámicamente en la Lambda matcheando el slug del `name` contra archivos del bucket S3.
- Modo: **PAY_PER_REQUEST**. ~24 items totales (catálogo demo).

#### `riders`
- **PK**: `riderId` (string)
- Atributos: `name`, `avatar`, `rating`, `totalDeliveries`, `online`, `todayStats` (map).
- Modo: **PAY_PER_REQUEST**. 1-10 items.

### 3.3 Flujo de un pedido (paso a paso)

```
1. Cliente login con Cognito       → 1 API call a Cognito-IDP
2. Cliente carga el catálogo       → 1 GET /products (Lambda + Scan a DynamoDB + ListObjects a S3 images)
3. Cliente abre detalle de plato   → 1 GET /products/{id} (Lambda + GetItem)
4. Cliente hace pedido             → 1 POST /orders
                                     • PutItem en DynamoDB orders
                                     • PutEvents en EventBridge → SQS → Lambda notifier → SNS publish → email admin
5. Cocina ve nuevos pedidos        → polling GET /orders cada ~5s (o WebSocket en versión futura)
6. Cocina avanza estado            → 1 PATCH /orders/{id} (UpdateItem + evento EventBridge → email)
7. Repartidor ve "Listo"           → 1 GET /orders (filtro local en frontend)
8. Repartidor acepta               → 1 PATCH /orders/{id} {status, riderId} (UpdateItem + evento)
9. Cliente ve tracker              → 1 GET /orders/user/{email} cada 8s (polling con GSI Query)
10. Repartidor entrega             → 1 PATCH /orders/{id} (UpdateItem + evento)
```

**Suma por pedido**: ~12-18 API calls + 5-7 DynamoDB ops + 3 EventBridge events + 3 SQS messages + 3 SNS messages + 3 emails.

---

## 4. Volúmenes esperados (parámetros para costing)

### 4.1 Asunciones por usuario activo

| Métrica | Valor |
|---|---|
| Sesiones por usuario por día | 1.2 |
| Pedidos por usuario por día | 0.4 (no todos los días pide) |
| Requests GET /products por sesión | 3 (cargar catálogo + filtrar + abrir 1-2 detalles) |
| Requests GET /orders/user/me por sesión (polling tracker) | 8 (1 sesión activa con polling 8s × 1 minuto de espera) |
| Imágenes cargadas por sesión | 24 PNG (~50KB c/u con compresión) = 1.2 MB |
| Latencia esperada p95 | <300ms (warm) / <1500ms (cold start) |

### 4.2 Escenarios de escala

#### Escenario A — MVP / Bootcamp Demo (lo que tenemos hoy)
- **Usuarios totales**: 10-50 demo
- **Pedidos/día**: 5-20
- **Tráfico pico**: 5 req/s
- **Tabla orders**: ~600 items/mes
- **Costo estimado**: dentro de free tier AWS (~$1-3/mes)

#### Escenario B — Restaurante mediano local (1 restaurante real)
- **Usuarios activos/mes (MAU)**: 500
- **Pedidos/día**: 50-100
- **Tráfico pico** (hora de almuerzo 12-13h y cena 19-20h): 30 req/s sostenidos, ráfagas a 100 req/s
- **Lambda invocations/mes**: ~150K
- **DynamoDB writes/mes**: ~6K
- **DynamoDB reads/mes**: ~50K
- **S3 image GETs/mes**: ~360K (cada sesión carga 24 PNGs, 500 MAU × 30 sesiones/mes)
- **Egress S3**: ~14 GB/mes (image GETs × ~40KB promedio)
- **Costo estimado**: $15-30/mes

#### Escenario C — 10 restaurantes (multi-tenant)
- **MAU**: 5.000
- **Pedidos/día**: 500-1000
- **Tráfico pico**: 200-300 req/s
- **Lambda invocations/mes**: ~1.5M
- **DynamoDB writes/mes**: ~60K
- **DynamoDB reads/mes**: ~500K
- **S3 image GETs/mes**: ~3.6M
- **Egress S3**: ~140 GB/mes
- **Cognito MAU**: 5K (gratis hasta 50K)
- **Costo estimado**: $80-150/mes

#### Escenario D — 100 restaurantes (operación real LATAM)
- **MAU**: 50.000
- **Pedidos/día**: 5K-10K
- **Tráfico pico**: 1K-2K req/s
- **Lambda invocations/mes**: ~15M
- **DynamoDB writes/mes**: ~600K
- **DynamoDB reads/mes**: ~5M
- **S3 image GETs/mes**: ~36M
- **Egress S3**: ~1.4 TB/mes
- **Cognito MAU**: 50K (límite del free tier)
- **Costo estimado**: $400-800/mes
- **A este nivel SÍ tendría sentido reconsiderar CloudFront** (ahorra egress S3 y agrega caching).

#### Escenario E — Stress test programado (el que vamos a demostrar)
- 60 segundos de tráfico con rampa de 5 → 200 req/s.
- Total: ~6.300 requests en 1 minuto.
- Lambda concurrency: pico de ~50-100 simultáneas.
- Costo del test individual: ~$0.005 (despreciable, free tier).

---

## 5. Argumentación de decisiones (CRÍTICO para el costing)

### 5.1 ¿Por qué NO CloudFront?

**Decisión**: El sitio y las imágenes se sirven **directo desde S3** sin CDN.

**Argumentos a favor de no usarlo:**

1. **Usuarios concentrados en Colombia**: el 100% del tráfico esperado viene de Colombia. CloudFront brilla cuando los usuarios están distribuidos geográficamente — pero nuestros usuarios están en un solo país. La región `us-east-1` (Virginia) tiene latencia razonable a Colombia (~80-120ms vs ~40ms desde un edge en Bogotá), pero el costo extra no se justifica para el volumen del MVP.

2. **Tamaño del sitio es minúsculo**: el frontend completo pesa <500KB (HTML/CSS/JS) más 11 PNG de comida de ~50KB c/u = ~1.2MB total. Eso cabe en el cache del navegador en la primera visita.

3. **Costo evitado**:
   - CloudFront: $0.085/GB primer 10TB + $0.0075/10K HTTPS requests.
   - En escenario B (mediano, 500 MAU), CloudFront sumaría ~$5-8/mes adicional.
   - El cliente paga el egress S3 (~$0.09/GB después del free tier).
   - **Trade-off**: CloudFront es caro hasta volumen alto, no compensa.

4. **HTTPS gratis con S3 está fuera**: el endpoint web de S3 es HTTP. Esto es la **mayor desventaja**. Para producción real con `https://` propio, necesitarías CloudFront + ACM. Para el MVP del bootcamp, HTTP basta.

5. **Caché del navegador**: las imágenes tienen URLs estables (slug + extensión). Una vez cargadas, el navegador las cachea. Recargas posteriores no consultan S3 de nuevo (a menos que se invalide el cache).

**Cuándo SÍ valdría la pena agregarlo** (escenario D, 100+ restaurantes):
- Egress S3 supera el GB/día.
- Necesitamos HTTPS con dominio personalizado.
- Picos de tráfico sostenidos > 500 req/s en el sitio estático.

### 5.2 ¿Por qué Lambda (serverless) vs EC2?

| Criterio | Lambda | EC2 (t3.medium) |
|---|---|---|
| Costo idle | $0 | $30/mes (24/7) |
| Tiempo de provisioning | 0ms | 2-5 min |
| Patching del SO | AWS lo hace | Tú lo haces |
| Escala automática | Sí (hasta 1K concurrent default) | Manual (con ASG) |
| Cold start | 200-1000ms primer hit | Ninguno |
| Modelo de cobro | $0.20/M invocations + GB-sec | $0.0416/hora |

**Veredicto**: para una app que tiene tráfico muy irregular (picos cortos de almuerzo/cena, casi cero en madrugada), Lambda gana. En escenario B, EC2 costaría $30/mes solo el server; Lambda nos sale en $1-5.

### 5.3 ¿Por qué DynamoDB on-demand?

**Alternativa**: Provisioned con auto-scaling.

**Por qué on-demand**:
1. Tráfico altamente variable (hora pico vs madrugada → diferencia 100x).
2. Provisioned requiere predecir capacidad → si subestimas, throttling; si sobreestimas, pagas idle.
3. On-demand cobra por request (~$1.25/M writes + $0.25/M reads). En nuestro escenario B (6K writes + 50K reads/mes), eso es **$0.02/mes**. Ridículamente barato.
4. No hay que tunear nada — DynamoDB escala automático hasta 40K WCU/RCU por tabla.

### 5.4 ¿Por qué HTTP API en vez de REST API?

- REST API tiene features que no usamos (request validation, API keys, usage plans).
- HTTP API es **70% más barata**: $1/M requests vs $3.50/M.
- Lo único que perdemos es API keys nativas → no nos importa porque la auth la maneja Cognito + headers.

### 5.5 ¿Por qué EventBridge + SQS en vez de invocar Lambda directo?

**Patrón "fan-out con desacople"**:
- La Lambda `orders_handler` publica un evento sin saber quién lo consume.
- EventBridge enruta a 1-N targets según patrones de filtro.
- Si mañana queremos sumar "Lambda que actualiza analytics", "Lambda que manda SMS via Twilio", solo agregamos un target a la regla EventBridge. **Sin tocar `orders_handler`**.

Costo extra del patrón: ~$1/M events + $0.40/M SQS requests = despreciable a este volumen.

### 5.6 ¿Por qué Cognito y no auth casero?

- Free tier muy generoso: 50.000 MAUs gratis.
- Implementación de signup/login/confirmación por email lista — solo configurás.
- Manejo de JWTs validados por API Gateway (Lambda Authorizer).
- Más seguro que rolar bcrypt + sessions a mano.

### 5.7 ¿Por qué Terraform + GitHub Actions y no consola AWS?

- **Reproducibilidad**: el día del proyecto Betek, hacemos `terraform apply` y todo el ambiente queda igual al de pruebas.
- **Multi-cuenta**: el mismo código despliega a "personal" o "betek" cambiando solo los secrets.
- **Destroy seguro**: borrar todo con un click (workflow `destroy.yml` con confirmación).
- **Free**: GitHub Actions es gratis para repos públicos hasta 2.000 min/mes.

---

## 6. Datos exactos para alimentar la calculadora

### 6.1 Tabla de inputs

| Variable | Valor recomendado | Origen |
|---|---|---|
| **Región** | us-east-1 | Más barata, tiene todos los servicios |
| **MAU** | escalable según escenario | Input |
| **Pedidos/día por MAU** | 0.4 | Asunción de mercado |
| **Sesiones/día por MAU** | 1.2 | Asunción |
| **Lambda avg duration** | 150ms (warm) / 1000ms (cold) | Medible |
| **Lambda memory** | 128 MB (todas las Lambdas) | Configurado |
| **DynamoDB write/pedido** | 6 (1 PutItem + 5 UpdateItem promedio) | Por flujo |
| **DynamoDB read/sesión** | 30 (catálogo + tracker polling) | Por flujo |
| **S3 image size** | 50 KB/imagen × 11 imágenes = 550 KB | Medible |
| **S3 image GETs/sesión** | 11 (todas las imágenes del catálogo) | Sin caché agresivo |
| **Egress S3/GB** | $0.09 (after 1GB free) | Tarifa pública |
| **EventBridge events/pedido** | 4 (creación + 3 cambios de estado) | Por flujo |
| **SNS emails/pedido** | 4 (notificaciones al admin) | Por flujo |
| **Cognito MAU** | = MAU del sistema | 50K gratis |
| **CloudWatch alarms** | 12 | Fijas |
| **CloudWatch logs retention** | 7 días | Configurado |
| **API Gateway requests/sesión** | 12 (login + catálogo + tracker polling) | Por flujo |

### 6.2 Fórmulas clave

```
Lambda costo/mes
  = (invocations / 1.000.000) × 0.20
  + (GB × duration_sec × invocations / 1.000.000) × 16.67

API Gateway HTTP costo/mes
  = (requests / 1.000.000) × 1.00

DynamoDB on-demand costo/mes
  = (writes / 1.000.000) × 1.25
  + (reads / 1.000.000) × 0.25
  + storage_GB × 0.25

S3 costo/mes
  = storage_GB × 0.023
  + (PUT_requests / 1.000) × 0.005
  + (GET_requests / 1.000) × 0.0004
  + egress_GB × 0.09  (después del 1GB free)

EventBridge costo/mes
  = (events / 1.000.000) × 1.00

SQS costo/mes
  = (requests / 1.000.000) × 0.40

SNS costo/mes
  = (publishes / 1.000.000) × 0.50
  + (emails / 100.000) × 2.00

CloudWatch costo/mes
  = num_alarms × 0.10
  + log_storage_GB × 0.50

Cognito costo/mes
  = max(0, MAU - 50.000) × 0.0055
```

### 6.3 Output que necesitamos de la calculadora

1. **Costo total mensual** por cada uno de los 4 escenarios (A, B, C, D).
2. **Breakdown por servicio** (qué servicio domina la factura en cada escenario).
3. **Punto de inflexión** donde un servicio se vuelve dominante (ej: a qué MAU las imágenes S3 superan a Lambda).
4. **Sugerencia de optimización** si algún escenario supera $X — qué cambiarías (ej: agregar CloudFront cuando egress > 1TB).
5. **Costo por pedido** (KPI clave: cuánto le cuesta a OrderFlow procesar un pedido vs los $0.30/pedido que cobran Rappi).

---

## 7. Lo que la calculadora podría visualizar (para la sustentación)

- Gráfico de barras: costo mensual por escenario (A, B, C, D).
- Pie chart: breakdown de servicios para escenario B (mediano).
- Línea de costo total vs MAU (de 0 a 100K).
- Tabla comparativa: nuestro costo/pedido vs comisión Rappi 30%.

---

## 8. Anexo: ¿qué pasaría si tuviéramos que ir global?

Si OrderFlow escalara a múltiples países (no en plan), necesitaríamos:

1. **CloudFront** (~$50-200/mes según volumen) para reducir latencia a usuarios fuera de Colombia.
2. **Multi-region DynamoDB** (DynamoDB Global Tables) — duplica costo de storage y agrega replication writes.
3. **Route 53** geolocation routing → ~$0.50/M queries.
4. **Lambda@Edge** o **CloudFront Functions** para A/B testing en el edge.

Pero **NADA de eso aplica hoy** porque:
- Estamos en Colombia.
- Tenemos < 100K usuarios.
- El SLA del MVP no requiere multi-AZ activo-activo.

---

## 9. TL;DR para el otro chat

> Construimos OrderFlow, una app serverless de domicilios colombiana usando AWS Lambda + API Gateway HTTP + DynamoDB on-demand + S3 + EventBridge + SQS + SNS + CloudWatch + Cognito + Terraform + GitHub Actions. **No usamos CloudFront** porque nuestros usuarios están todos en Colombia y el volumen del MVP no justifica el costo extra del CDN; el sitio se sirve directo desde S3 con un endpoint estático y las imágenes se sirven públicamente desde otro bucket S3. La arquitectura es **event-driven**: cuando se crea o cambia un pedido, una Lambda publica un evento en EventBridge que llega a una SQS y dispara otra Lambda que manda email vía SNS. Tres tablas DynamoDB: `orders` (con GSI por userEmail), `products` (24 platos), `riders`. Auth con Cognito. CI/CD multi-cuenta con GitHub Actions (push a main = deploy a personal; manual = elegís personal o betek). Queremos una calculadora de costos que estime la factura mensual en 4 escenarios: (A) demo bootcamp 50 MAU, (B) 1 restaurante real 500 MAU, (C) 10 restaurantes 5K MAU, (D) 100 restaurantes 50K MAU. Necesitamos: breakdown por servicio, comparativa vs comisión Rappi 30%, y sugerencias de cuándo sumar CloudFront / cambiar a provisioned / etc.
