#!/usr/bin/env python3
"""
seed_dynamo.py
Carga los productos y riders demo en DynamoDB.

Se llama desde el workflow de GitHub Actions tras `terraform apply`.

Uso:
    python3 seed_dynamo.py \
        --products-table orderflow-g2p4-personal-products \
        --riders-table   orderflow-g2p4-personal-riders \
        --region         us-east-1

Es idempotente: cada PutRequest sobreescribe el item si ya existe.
"""
from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

import boto3

SCRIPT_DIR = Path(__file__).resolve().parent


def cargar_json(ruta: Path) -> list[dict]:
    with open(ruta, "r", encoding="utf-8") as f:
        return json.load(f, parse_float=Decimal)


def chunked(lista: list, tamano: int):
    for i in range(0, len(lista), tamano):
        yield lista[i : i + tamano]


def poblar_tabla(dynamodb, nombre_tabla: str, items: list[dict]) -> int:
    """
    Pobla la tabla en chunks de 25 (límite de batch_write_item).
    Devuelve el número de items escritos.
    """
    tabla = dynamodb.Table(nombre_tabla)
    total = 0
    for chunk in chunked(items, 25):
        with tabla.batch_writer() as writer:
            for item in chunk:
                writer.put_item(Item=item)
                total += 1
    return total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--products-table", required=True)
    parser.add_argument("--riders-table", required=True)
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument(
        "--products-file",
        default=str(SCRIPT_DIR / "products.json"),
    )
    parser.add_argument(
        "--riders-file",
        default=str(SCRIPT_DIR / "riders.json"),
    )
    args = parser.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=args.region)

    # Productos
    products = cargar_json(Path(args.products_file))
    print(f"→ Poblando tabla {args.products_table} con {len(products)} productos…")
    n_products = poblar_tabla(dynamodb, args.products_table, products)
    print(f"✅ {n_products} productos cargados")

    # Riders
    riders = cargar_json(Path(args.riders_file))
    print(f"→ Poblando tabla {args.riders_table} con {len(riders)} riders…")
    n_riders = poblar_tabla(dynamodb, args.riders_table, riders)
    print(f"✅ {n_riders} riders cargados")

    return 0


if __name__ == "__main__":
    sys.exit(main())
