# 🧠 Arquitectura Detallada de OrderFlow (Decisiones Finales)

Aquí dejaremos plasmadas las decisiones finales de arquitectura, pensadas específicamente para tu equipo y los requisitos técnicos del proyecto.

## 1. El Frontend (Sencillo pero Moderno)
- **Decisión:** Usaremos **HTML y JavaScript puro (Vanilla JS)** con la ayuda de **CDN de Tailwind CSS**.
- **Beneficio:** Evitas la complejidad de React para un equipo que no sabe código, pero logras una interfaz moderna y profesional.

## 2. API Gateway: HTTP API
- **Decisión:** Usaremos **HTTP API** (más baratas y rápidas que REST API para este caso de uso).

## 3. Redes y Seguridad: El "Mito" de la VPC en Serverless
- Lo que te enseñaron en clase es **100% correcto para servidores**: Si usas EC2 o bases de datos relacionales (RDS), crear VPCs públicas y privadas es vital.
- **Pero en Serverless puro (como este proyecto):** S3, DynamoDB, API Gateway, SNS y SQS son servicios gestionados por AWS. No viven dentro de "tu" VPC, viven en las redes internas seguras de AWS.
- **¿Qué pasa si metes la Lambda en una VPC?** Una Lambda solo debe ir en una VPC si necesita acceder a un recurso privado (ej. una base de datos EC2/RDS sin internet). Si la metes en una VPC para este proyecto:
  1. La Lambda perderá acceso a Internet y a DynamoDB por defecto.
  2. Tendrás que pagar un NAT Gateway (~$30 USD/mes) o configurar VPC Endpoints complejos.
  3. Los tiempos de arranque (Cold Start) de la función serán más lentos.
- **Conclusión:** ¡No haremos VPC! Nos apoyamos en la seguridad nata de AWS (Roles IAM precisos) y ahorramos costos.

## 4. Componentes e Inventario IAM
1. **S3:** Alojamiento estático web.
2. **IAM:** Un Rol estricto para las Lambdas de "Solo lectura/escritura" a nuestra tabla DynamoDB y a SNS.
3. **API Gateway (HTTP API):** Rutas `/pedidos`.
4. **AWS Lambda:** Funciones sencillas en Node.js.
5. **DynamoDB:** Almacenamiento ágil (Partition Key: `orderId`).
6. **SNS y SQS:** Desacople de notificaciones para cuando un pedido cambie de estado.

## 5. Alarmas de Monitoreo (CloudWatch)
Para asegurar que tu sistema esté sano y para sacar ese 100/100, crearemos gráficas y alarmas en Amazon CloudWatch que vigilen estos puntos críticos:
- **Para las Lambdas:**
  - Alarma de `Errors > 0`: Para que te avise si tu código en JS falla.
  - Alarma de `Duration > 3 segundos`: Para saber si las órdenes están tardando mucho en guardarse.
- **Para el API Gateway:** 
  - Alarma de `5XXError > 1%`: Para saber si la API colapsa o está rota.
- **Para SQS (La Cola de Notificaciones):**
  - Alarma de `ApproximateAgeOfOldestMessage > 5 minutos`: Si un mensaje se queda atascado 5 minutos ahí, significa que los correos o notificaciones no están saliendo.
