# Especificaciones de Infraestructura AWS (Backend)

Este documento detalla los recursos técnicos exactos que deben ser provisionados en la cuenta de AWS para brindar soporte al entorno Frontend (el cual ya está desarrollado y finalizado mediante una arquitectura de Mocks limpios).

## 1. Almacenamiento de Datos (Amazon DynamoDB)
- **Servicio:** DynamoDB
- **Nombre de Tabla:** `OrderFlow_Pedidos`
- **Partition Key:** `orderId` (Tipo: `String`)
- **Capacidad:** On-Demand (Bajo demanda)

## 2. Almacenamiento de Archivos (Amazon S3 - Assets)
- **Servicio:** S3 (Simple Storage Service)
- **Función:** Alojar de forma pública las imágenes estáticas del Frontend (fotos de platos locales) para evitar dependencias de URLs externas caídas o errores de CORS.
- **Configuración requerida:** 
  - Crear un Bucket público (ej. `orderflow-assets`).
  - Habilitar acceso de lectura pública (Read) a los objetos del bucket mediante *Object Ownership* y *Bucket Policy*.
  - Subir las imágenes de la Bandeja Paisa, Empanadas, Arepa y Salchipapa, y conservar sus URLs públicas.

## 3. Seguridad y Políticas (AWS IAM)
- **Servicio:** IAM Roles
- **Entidad de Confianza:** AWS Lambda
- **Nombre del Rol:** `OrderFlow_LambdaRole`
- **Políticas nativas requeridas:**
  - `AmazonDynamoDBFullAccess`
  - `AmazonSNSFullAccess`
  - `AWSLambdaBasicExecutionRole`

## 4. Funciones FaaS (AWS Lambda)
Se requiere crear un componente de tres (3) funciones usando el Runtime libre de **Node.js 20.x**. A cada función se le debe asignar el Rol IAM definido en el numeral 3.

### 4.1. Lambda: `createOrder`
- **Input (event.body JSON proveniente del Frontend):**
  ```json
  { "cliente": "Nombre", "items": ["Item1", "Item2"] }
  ```
- **Proceso Interno:** 
  - Autogenerar un UUID (`orderId`).
  - Asignar atributos estáticos: `estado: "Recibido"` y `fecha: "TIMESTAMP"`.
  - Persistir dicho objeto en la tabla `OrderFlow_Pedidos`.
- **Output de Respuesta (Status 201):**
  ```json
  { "status": "success", "data": { "orderId": "ORD-123", "cliente": "Nombre", "items": ["Item1", "Item2"], "estado": "Recibido", "fecha": "..." } }
  ```

### 4.2. Lambda: `getOrders`
- **Input:** Request `GET` estándar sin cuerpo.
- **Proceso Interno:** Ejecutar un `ScanCommand` o `Query` a la tabla `OrderFlow_Pedidos` para recuperar todo el histórico.
- **Output de Respuesta (Status 200):**
  ```json
  { "status": "success", "data": [ { ...pedido1 }, { ...pedido2 } ] }
  ```

### 4.3. Lambda: `updateOrder`
- **Input (event.body JSON proveniente del equipo Logístico):**
  ```json
  { "orderId": "ORD-123", "nuevoEstado": "En Camino" }
  ```
- **Procesos Internos:** 
  1. Modificar y hacer UPDATE del registro correspondiente en DynamoDB cambiando únicamente el valor de la clave `estado`.
  2. Implementar `PublishCommand` de SNS hacia el ARN del Tópico logístico enviando un mensaje tipo *"El pedido X cambió"* (Integración requerida).
- **Output de Respuesta (Status 200):**
  ```json
  { "status": "success" }
  ```

## 5. Enrutamiento Unificado (Amazon API Gateway)
- **Servicio:** API Gateway
- **Tipo Recomendado:** HTTP API 
- **Integraciones:**
  - endpoint `POST /pedidos`  ➔ Enlazar a lambda `createOrder`.
  - endpoint `GET /pedidos`   ➔ Enlazar a lambda `getOrders`.
  - endpoint `PUT /pedidos`   ➔ Enlazar a lambda `updateOrder`.
- **Configuración Crítica (CORS):**
  - Parameter `Access-Control-Allow-Origin`: `*`
  - Parameter `Access-Control-Allow-Methods`: `GET, POST, PUT, OPTIONS`
  - Parameter `Access-Control-Allow-Headers`: `content-type`

## 6. Desacople Asíncrono (Amazon SNS & SQS)
- **Tema (Topic) en SNS:** Crear con el identificador `OrderUpdatesTopic`. *Notificar ARN al desarrollador de updateOrder.*
- **Cola en SQS:** Crear con el identificador `OrderUpdatesQueue`.
- **Suscripción de Red:** Navegar al Topic SNS y crear una suscripción estricta desde SNS hacia la cola SQS, asegurando que cada mutación de pedido encole un mensaje sin bloquear a las Lambdas.
