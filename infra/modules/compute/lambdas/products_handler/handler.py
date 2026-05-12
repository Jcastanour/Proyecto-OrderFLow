"""
Lambda: products_handler
Rutas:
  GET /products
  GET /products/{productId}

Lógica:
  1. Hace scan/get_item a la tabla `products` (sin campo imageKey).
  2. Lista el bucket S3 de imágenes y construye un cache {slug: url}.
  3. Para cada producto, calcula slug(name) y resuelve imageUrl
     buscando un archivo cuyo nombre arranque con ese slug.

El cache de imágenes se refresca cada IMAGE_CACHE_TTL segundos.
Lambda mantiene este cache vivo entre invocaciones (warm container)
así que en la práctica solo se lista el bucket una vez por instancia.
"""
import json
import os
import re
import time
import unicodedata
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

PRODUCTS_TABLE_NAME = os.environ["PRODUCTS_TABLE_NAME"]
IMAGES_BUCKET_NAME = os.environ["IMAGES_BUCKET_NAME"]
IMAGES_BUCKET_URL = os.environ["IMAGES_BUCKET_URL"]  # ej: https://orderflow-...-images.s3.us-east-1.amazonaws.com

IMAGE_CACHE_TTL = 60  # segundos antes de re-listar el bucket

dynamodb = boto3.resource("dynamodb")
products_table = dynamodb.Table(PRODUCTS_TABLE_NAME)
s3 = boto3.client("s3")

# Cache global del proceso (sobrevive entre invocaciones del mismo container)
_image_cache = {"data": {}, "updated_at": 0.0}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
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


def slugify(nombre):
    """
    Convierte 'Ajiaco Santafereño' → 'ajiaco-santafereno'.
    Quita tildes, ñ→n, espacios→guiones, lowercase.
    Misma lógica que el frontend para que el matching coincida.
    """
    if not nombre:
        return ""
    # Normalizar acentos (descomposición + filtrar marcas)
    sin_tildes = unicodedata.normalize("NFKD", nombre)
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    # ñ → n (la normalización Unicode no la convierte sola)
    sin_tildes = sin_tildes.replace("ñ", "n").replace("Ñ", "N")
    # A minúsculas y limpiar
    s = sin_tildes.lower().strip()
    # Reemplazar cualquier cosa no alfanumérica por guion
    s = re.sub(r"[^a-z0-9]+", "-", s)
    # Quitar guiones al principio/final
    return s.strip("-")


# ---------------------------------------------------------------
# Resolver de imágenes — lista bucket y matchea por slug
# ---------------------------------------------------------------
def refrescar_cache_imagenes():
    """
    Lista el bucket de imágenes y construye dict {slug: imageUrl}.
    Slug = nombre del archivo sin extensión.
    Ejemplo: 'ajiaco-santafereno.png' → slug 'ajiaco-santafereno'.
    """
    nuevo_cache = {}
    paginador = s3.get_paginator("list_objects_v2")
    try:
        for pagina in paginador.paginate(Bucket=IMAGES_BUCKET_NAME):
            for obj in pagina.get("Contents", []) or []:
                key = obj["Key"]
                # Nombre del archivo sin extensión
                nombre = key.rsplit("/", 1)[-1]
                slug, _, _ = nombre.rpartition(".")
                if not slug:
                    slug = nombre
                # Si hay dos imágenes con el mismo slug (ej .png y .svg)
                # nos quedamos con la primera que aparezca
                nuevo_cache.setdefault(slug.lower(), f"{IMAGES_BUCKET_URL}/{key}")
        _image_cache["data"] = nuevo_cache
        _image_cache["updated_at"] = time.time()
        print(f"Cache imágenes refrescado: {len(nuevo_cache)} archivos")
    except ClientError as err:
        print(f"WARN: no se pudo listar bucket: {err}")


def resolver_image_url(nombre_producto):
    """Devuelve la URL pública si hay imagen para el slug, None si no."""
    # Refrescar cache si está vencido (o vacío en el primer call)
    if time.time() - _image_cache["updated_at"] > IMAGE_CACHE_TTL:
        refrescar_cache_imagenes()
    slug = slugify(nombre_producto)
    return _image_cache["data"].get(slug)


def enriquecer_producto(producto):
    """Agrega el campo imageUrl al producto. None si no hay imagen."""
    if not producto:
        return producto
    producto["imageUrl"] = resolver_image_url(producto.get("name", ""))
    return producto


# ---------------------------------------------------------------
# Handlers por ruta
# ---------------------------------------------------------------
def listar_productos():
    resultado = products_table.scan()
    productos = resultado.get("Items", [])
    enriquecidos = [enriquecer_producto(p) for p in productos]
    return respuesta_ok(enriquecidos)


def obtener_producto(product_id):
    resultado = products_table.get_item(Key={"productId": product_id})
    producto = resultado.get("Item")
    if not producto:
        return respuesta_error("producto no encontrado", status_code=404)
    return respuesta_ok(enriquecer_producto(producto))


# ---------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------
def lambda_handler(event, _context):
    print("EVENT", json.dumps(event))

    metodo_http = event.get("requestContext", {}).get("http", {}).get("method")
    ruta = event.get("requestContext", {}).get("http", {}).get("path", "")
    product_id = (event.get("pathParameters") or {}).get("productId")

    try:
        if metodo_http == "GET" and ruta == "/products":
            return listar_productos()
        if metodo_http == "GET" and product_id:
            return obtener_producto(product_id)
        return respuesta_error("ruta no soportada", status_code=404)
    except Exception as err:
        print("ERROR", repr(err))
        return respuesta_error(str(err), status_code=500)
