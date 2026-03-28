# 🍕 OrderFlow - Delivery Management System (Serverless)

OrderFlow es una plataforma web de gestión de domicilios rápida, moderna y altamente escalable construida sobre una arquitectura **100% Serverless en AWS** y un Frontend despachado mediante Módulos Nativos de Vanilla JS y Tailwind CSS.

## 🏗️ Arquitectura del Sistema
El proyecto se divide en dos macro-componentes fuertemente desacoplados:

### 1. Frontend (Clean Architecture y "Mobile-First")
- **Tecnologías:** HTML5 Semántico, Vanilla JavaScript (Módulos ES6), Tailwind CSS (A través de CDN para máxima portabilidad).
- **Diseño del Código:** Patrón *Adapter/Repository* (`config.js`) que permite conmutar entre una base de datos Mock local en memoria y el verdadero API Gateway de AWS, logrando desarrollo ágil sin acoplamiento a la nube.
- **Alojamiento:** Amazon S3 configurado como "Static Website Hosting" (Aprox. $0.005 USD/GB).

### 2. Backend (AWS Cloud Native)
- **API Gateway (HTTP API):** Punto de entrada ultrarrápido y enrutador de las peticiones REST (`POST /pedidos`, `GET /pedidos`).
- **AWS Lambda (Node.js 20.x):** Capa de cómputo transitorio. Funciones independientes y sin estado que se encargan de la lógica de negocio básica.
- **Amazon DynamoDB:** Base de datos NoSQL sin servidor (Tabla `OrderFlow_Pedidos` con Partition Key `orderId`). Escalamiento automático On-Demand logrando latencias de un dígito de milisegundo a cualquier escala.
- **AWS SNS y SQS (Event-Driven Architecture):** Desacople de procesos. Cuando una Lambda logística actualiza un pedido a estado "En Camino", publica un evento (PublishCommand) en un tópico SNS, el cual alimenta de inmediato una cola SQS tolerante a fallos, previendo un futuro servicio notificador que despache correos/SMS a clientes.
- **Roles IAM:** Principio del Menor Privilegio (POLP). Las políticas otorgan permisos granulares (Solo lectura/escritura a nombres exactos de tablas y colas).

---

## 🚀 Instrucciones de Ejecución (Despliegue Local Mock)
La arquitectura Limpia permite probar la intefaz en milisegundos.
1. Clonar el repositorio.
2. Usar un entorno como la extensión **"Live Server"** en Visual Studio Code para evadir el bloqueo nativo (CORS/File protocols).
3. Abrir la subcarpeta `frontend/` y ejecutar `index.html`. 
   *(Nota técnica: Por defecto, la importación del módulo `/js/config.js` inyectará la base simulada `orderMock.js` para pruebas UI instantáneas).*

---

## ⚙️ Instrucciones de Despliegue en AWS
*(Flujo mediante la Consola Interactiva de AWS bajo la metodología ClickOps para fines demotrativos de este proyecto, integrando con CI/CD)*

1. **Configuración de Datos y Red (Backend)**
   - Navegue a AWS DynamoDB. Cree una nueva tabla llamada `OrderFlow_Pedidos` con la clave de partición `orderId` tipo String. Provisionamiento On-Demand.
   - Navegue a AWS SNS y cree el tópico de notificaciones estándar, seguido de una cola en AWS SQS suscrita a este tópico.

2. **Gestión de Identidades (IAM)**
   - Navegue a IAM > Roles > Crear Nuevo Rol (Servicio Lambda).
   - Adjunte las políticas preconfiguradas: `AmazonDynamoDBFullAccess`, `AmazonSNSFullAccess` y `AWSLambdaBasicExecutionRole`. Nombrarlo `OrderFlow_LambdaRole`.

3. **Cómputo Transitorio (Lambda)**
   - Cree 3 funciones Lambda Node.js (ej. `createOrder`, `getOrder`, `updateOrder`). Asigne el Rol de IAM previo.
   - Pegue el código JavaScript contenido dentro de la carpeta local `./backend/src/` hacia el editor en línea de AWS.

4. **Exposición de Servicios (API Gateway)**
   - Cree un nuevo HTTP API.
   - Establezca Rutas e integre (`Attach Integration`) apuntando hacia su Lambda respectiva autorizando métodos de tipo OPTIONS/CORS globalmente.

---

## 📊 Monitoreo Crítico (CloudWatch)
Para asegurar niveles operativos SLA de la start-up, el sistema automatiza el volcado de trazas hacia **Amazon CloudWatch**, configurando alarmas para:
- Vigilancia de cuellos de botella controlando la métrica `Duration` de la Lambda de creación de pedidos (Superando los 3.0s).
- Detección de caída de la red levantando el flag en `5xxErrorRate` del API Gateway.
- Verificación del Desacople asíncrono disparando alertas si la edad máxima del mensaje de la SQS (`ApproximateAgeOfOldestMessage`) supera parámetros críticos, indicando colapso de notificación en logística.
