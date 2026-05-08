"""
Lambda: notifier_handler
- Trigger: SQS (notifications_queue).
- Acción: por cada mensaje, publica una notificación en el SNS topic.

El mensaje SQS viene de EventBridge, así que tiene este formato:
  {
    "version": "0",
    "id": "...",
    "detail-type": "OrderEvent",
    "source": "orderflow.orders",
    "detail": { "orderId": "...", "status": "Recibido", ... }
  }
"""
import json
import os

import boto3

ADMIN_ALERTS_TOPIC_ARN = os.environ["ADMIN_ALERTS_TOPIC_ARN"]

sns = boto3.client("sns")


def construir_mensaje_humano(evento_eventbridge):
    """Convierte el evento crudo en un texto legible para el admin."""
    detalle = evento_eventbridge.get("detail", {}) or {}
    detail_type = evento_eventbridge.get("detail-type", "EventoDesconocido")
    order_id = detalle.get("orderId", "?")
    estado = detalle.get("status", "?")
    cliente = detalle.get("customer", "?")

    if detail_type == "OrderCreated":
        return (
            f"📥 Nuevo pedido recibido\n"
            f"ID: {order_id}\n"
            f"Cliente: {cliente}\n"
            f"Estado: {estado}"
        )

    if detail_type == "OrderStatusChanged":
        return (
            f"🔄 Estado de pedido actualizado\n"
            f"ID: {order_id}\n"
            f"Cliente: {cliente}\n"
            f"Nuevo estado: {estado}"
        )

    return f"Evento: {detail_type}\nDetalle: {json.dumps(detalle)}"


def lambda_handler(event, _context):
    print("EVENT", json.dumps(event))

    # SQS event source manda los registros en event["Records"]
    for registro in event.get("Records", []):
        # El body es el evento de EventBridge serializado como string
        evento_eventbridge = json.loads(registro["body"])
        mensaje = construir_mensaje_humano(evento_eventbridge)
        asunto = f"OrderFlow · {evento_eventbridge.get('detail-type', 'Evento')}"

        sns.publish(
            TopicArn=ADMIN_ALERTS_TOPIC_ARN,
            Subject=asunto[:100],  # SNS limita el subject a 100 chars
            Message=mensaje,
        )
        print(f"Publicado a SNS: {asunto}")

    return {"procesados": len(event.get("Records", []))}
