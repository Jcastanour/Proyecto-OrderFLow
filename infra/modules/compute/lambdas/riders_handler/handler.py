"""
Lambda: riders_handler
Ruta: GET /riders/{riderId}

Devuelve el perfil del repartidor desde la tabla DynamoDB `riders`.
"""
import json
import os
from decimal import Decimal

import boto3

RIDERS_TABLE_NAME = os.environ["RIDERS_TABLE_NAME"]

dynamodb = boto3.resource("dynamodb")
riders_table = dynamodb.Table(RIDERS_TABLE_NAME)


def _json_default(value):
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


def obtener_rider(rider_id):
    resultado = riders_table.get_item(Key={"riderId": rider_id})
    rider = resultado.get("Item")
    if not rider:
        return respuesta_error("repartidor no encontrado", status_code=404)
    return respuesta_ok(rider)


def lambda_handler(event, _context):
    print("EVENT", json.dumps(event))

    metodo_http = event.get("requestContext", {}).get("http", {}).get("method")
    rider_id = (event.get("pathParameters") or {}).get("riderId")

    try:
        if metodo_http == "GET" and rider_id:
            return obtener_rider(rider_id)
        return respuesta_error("ruta no soportada", status_code=404)
    except Exception as err:
        print("ERROR", repr(err))
        return respuesta_error(str(err), status_code=500)
