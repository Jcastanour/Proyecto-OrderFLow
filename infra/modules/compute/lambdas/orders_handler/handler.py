"""
Lambda: orders_handler
Maneja todas las rutas de /orders del API Gateway HTTP.

Eventos: API Gateway HTTP API v2 (payload format 2.0).
SDK: boto3 (incluido en runtime python3.12, no hay que instalar nada).

Tras crear o actualizar un pedido, publica un evento en EventBridge
para que la Lambda notifier (vía SQS) pueda mandar email al admin.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

ORDERS_TABLE_NAME = os.environ["ORDERS_TABLE_NAME"]
EVENT_BUS_NAME = os.environ["EVENT_BUS_NAME"]

dynamodb = boto3.resource("dynamodb")
orders_table = dynamodb.Table(ORDERS_TABLE_NAME)
events = boto3.client("events")


# ---------------------------------------------------------------
# Helpers de respuesta HTTP
# ---------------------------------------------------------------
def _json_default(value):
    """boto3 devuelve números como Decimal, pero json no los serializa."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"No serializable: {type(value)}")


def respuesta_ok(body, status_code=200):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=_json_default),
    }


def respuesta_error(mensaje, status_code=400):
    return respuesta_ok({"error": mensaje}, status_code)


# ---------------------------------------------------------------
# Publicar evento en EventBridge
# ---------------------------------------------------------------
def publicar_evento(detail_type, detalle):
    """
    Publica un evento en el bus custom.
    detail_type → tipo del evento (ej: 'OrderCreated', 'OrderStatusChanged')
    detalle     → diccionario con los datos del pedido
    """
    try:
        events.put_events(
            Entries=[
                {
                    "Source": "orderflow.orders",
                    "DetailType": detail_type,
                    "Detail": json.dumps(detalle, default=_json_default),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )
        print(f"Evento publicado: {detail_type}")
    except ClientError as err:
        # No fallamos toda la request si el evento no se publica:
        # el pedido SÍ se guardó en DynamoDB, así que devolvemos OK.
        print(f"WARN: no se pudo publicar evento {detail_type}: {err}")


# ---------------------------------------------------------------
# Handlers por ruta
# ---------------------------------------------------------------
def crear_pedido(body):
    if not body.get("customer") or not isinstance(body.get("items"), list):
        return respuesta_error("customer e items son requeridos")

    pedido = {
        "orderId": str(uuid.uuid4()),
        "customer": body["customer"],
        "items": body["items"],
        "total": Decimal(str(body.get("total", 0))),
        "status": "Recibido",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        # Campo nuevo (Etapa A): el cliente puede indicar dirección de entrega.
        # Si no la manda, dejamos un texto descriptivo (no None) para que
        # el frontend pueda mostrar algo en todos los casos.
        "direccion": body.get("direccion") or "Sin dirección registrada",
    }
    orders_table.put_item(Item=pedido)
    publicar_evento("OrderCreated", pedido)
    return respuesta_ok(pedido, status_code=201)


def listar_pedidos():
    resultado = orders_table.scan()
    return respuesta_ok(resultado.get("Items", []))


def obtener_pedido(order_id):
    resultado = orders_table.get_item(Key={"orderId": order_id})
    pedido = resultado.get("Item")
    if not pedido:
        return respuesta_error("pedido no encontrado", status_code=404)
    return respuesta_ok(pedido)


def actualizar_estado_pedido(order_id, body):
    """
    PATCH /orders/{orderId}

    Cuerpo soportado:
      { "status": "En Camino" }                  → solo cambia estado
      { "status": "En Camino", "riderId": "r1" } → estado + asignación de repartidor

    Construimos la UpdateExpression de forma dinámica para incluir solo
    los campos que el cliente envió.
    """
    nuevo_estado = body.get("status")
    if not nuevo_estado:
        return respuesta_error("status es requerido")

    # Campos opcionales que la API acepta actualizar junto con status.
    # Cada uno se traduce a una asignación SET dinámica en DynamoDB.
    campos_opcionales = {
        "riderId": body.get("riderId"),
        "direccion": body.get("direccion"),
    }

    set_exprs = ["#s = :s"]
    expr_names = {"#s": "status"}
    expr_values = {":s": nuevo_estado}

    for nombre_campo, valor in campos_opcionales.items():
        if valor is None:
            continue
        # Usamos placeholders #campo / :campo para evitar conflictos con palabras reservadas
        placeholder_name = f"#{nombre_campo}"
        placeholder_value = f":{nombre_campo}"
        set_exprs.append(f"{placeholder_name} = {placeholder_value}")
        expr_names[placeholder_name] = nombre_campo
        expr_values[placeholder_value] = valor

    try:
        resultado = orders_table.update_item(
            Key={"orderId": order_id},
            UpdateExpression="SET " + ", ".join(set_exprs),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
            ConditionExpression="attribute_exists(orderId)",
        )
        pedido_actualizado = resultado["Attributes"]
        publicar_evento("OrderStatusChanged", pedido_actualizado)
        return respuesta_ok(pedido_actualizado)
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respuesta_error("pedido no encontrado", status_code=404)
        raise


# ---------------------------------------------------------------
# Punto de entrada (lo que invoca AWS Lambda)
# ---------------------------------------------------------------
def lambda_handler(event, _context):
    print("EVENT", json.dumps(event))

    metodo_http = event.get("requestContext", {}).get("http", {}).get("method")
    ruta = event.get("requestContext", {}).get("http", {}).get("path", "")
    order_id = (event.get("pathParameters") or {}).get("orderId")
    body = json.loads(event["body"]) if event.get("body") else {}

    try:
        if metodo_http == "POST" and ruta == "/orders":
            return crear_pedido(body)
        if metodo_http == "GET" and ruta == "/orders":
            return listar_pedidos()
        if metodo_http == "GET" and order_id:
            return obtener_pedido(order_id)
        if metodo_http == "PATCH" and order_id:
            return actualizar_estado_pedido(order_id, body)

        return respuesta_error("ruta no soportada", status_code=404)
    except Exception as err:
        print("ERROR", repr(err))
        return respuesta_error(str(err), status_code=500)
