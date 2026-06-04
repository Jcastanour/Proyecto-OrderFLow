#!/usr/bin/env python3
"""
watch_orderflow.py — Dashboard EN VIVO en terminal.

Muestra refrescando cada 2 segundos:
  - Total pedidos en DynamoDB (orders)
  - Pedidos por estado (Recibido / En Cocina / Listo / En Camino / Entregado)
  - Invocaciones Lambda últimos 5 min (por función)
  - Errores Lambda últimos 5 min
  - Mensajes en SQS notifications
  - Productos y riders cargados
  - Últimos 5 pedidos creados (con timestamps)

Perfecto para demo: lo dejás corriendo en una pantalla y en otra abrís
el sitio o lanzás un load test. Ves los números subir en vivo.

Uso:
    pip install rich boto3
    python3 scripts/watch_orderflow.py --prefix orderflow-g2p4-personal

Si no le pasás --prefix, intenta leerlo de tu tfvars.
"""
from __future__ import annotations

import argparse
import time
from collections import Counter
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError
from rich.console import Console, Group
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

console = Console()


# ─── Cliente AWS ────────────────────────────────────────────────
def crear_clientes(region: str):
    return {
        "dynamodb": boto3.resource("dynamodb", region_name=region),
        "cloudwatch": boto3.client("cloudwatch", region_name=region),
        "sqs": boto3.client("sqs", region_name=region),
    }


# ─── Datos ──────────────────────────────────────────────────────
def contar_pedidos(dynamodb, table_name: str) -> tuple[int, Counter, list]:
    """Devuelve (total, conteo por estado, últimos 5 pedidos)."""
    try:
        tabla = dynamodb.Table(table_name)
        items = tabla.scan().get("Items", [])
        estados = Counter(p.get("status", "?") for p in items)
        # Últimos 5 por createdAt
        ordenados = sorted(items, key=lambda p: p.get("createdAt", ""), reverse=True)[:5]
        return len(items), estados, ordenados
    except ClientError:
        return 0, Counter(), []


def contar_items(dynamodb, table_name: str) -> int:
    try:
        # describe_table tiene un counter aproximado (más barato que Scan)
        client = boto3.client("dynamodb", region_name=dynamodb.meta.client.meta.region_name)
        resp = client.describe_table(TableName=table_name)
        return resp["Table"].get("ItemCount", 0)
    except ClientError:
        return 0


def metrica_lambda(cloudwatch, function_name: str, metric: str, minutos: int = 5) -> int:
    """Suma de la métrica en los últimos N minutos."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutos)
    try:
        resp = cloudwatch.get_metric_statistics(
            Namespace="AWS/Lambda",
            MetricName=metric,
            Dimensions=[{"Name": "FunctionName", "Value": function_name}],
            StartTime=start,
            EndTime=end,
            Period=60,
            Statistics=["Sum"],
        )
        return int(sum(d["Sum"] for d in resp.get("Datapoints", [])))
    except ClientError:
        return 0


def sqs_metricas(sqs, queue_url: str) -> tuple[int, int]:
    """Devuelve (mensajes_visibles, mensajes_en_vuelo)."""
    try:
        attrs = sqs.get_queue_attributes(
            QueueUrl=queue_url,
            AttributeNames=["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
        )["Attributes"]
        return int(attrs["ApproximateNumberOfMessages"]), int(attrs["ApproximateNumberOfMessagesNotVisible"])
    except ClientError:
        return 0, 0


# ─── Renderizado ────────────────────────────────────────────────
def render_header(prefix: str) -> Panel:
    ahora = datetime.now().strftime("%H:%M:%S")
    t = Text()
    t.append("🛵 OrderFlow ", style="bold orange3")
    t.append("· dashboard en vivo · ", style="dim")
    t.append(prefix, style="bold cyan")
    t.append(f"  ·  {ahora}", style="dim")
    return Panel(t, box=box.MINIMAL, padding=(0, 1))


def render_pedidos(total: int, estados: Counter, ultimos: list) -> Panel:
    tabla = Table.grid(padding=(0, 2))
    tabla.add_column(justify="right", style="bold")
    tabla.add_column()

    # Pedidos por estado con colores
    color_map = {
        "Recibido": "cyan",
        "En Cocina": "yellow",
        "Listo": "green",
        "En Camino": "orange3",
        "Entregado": "bright_green",
    }
    for estado in ["Recibido", "En Cocina", "Listo", "En Camino", "Entregado"]:
        n = estados.get(estado, 0)
        bar = "█" * min(n, 30)
        tabla.add_row(
            f"{n:3d}",
            Text(f"{estado:12s} ", style=color_map.get(estado, "white")) + Text(bar, style=color_map.get(estado, "white"))
        )
    tabla.add_row("", "")
    tabla.add_row(Text(f"{total}", style="bold white"), Text("TOTAL pedidos", style="bold"))

    # Últimos 5
    ultimos_tabla = Table(box=box.SIMPLE_HEAD, padding=(0, 1), show_edge=False)
    ultimos_tabla.add_column("Hora", style="dim")
    ultimos_tabla.add_column("Cliente", style="cyan")
    ultimos_tabla.add_column("Estado")
    ultimos_tabla.add_column("$", justify="right", style="green")
    for p in ultimos:
        hora = (p.get("createdAt", "")[:19] or "").replace("T", " ")[-8:]
        cliente = (p.get("customer") or "?")[:15]
        estado = p.get("status", "?")
        total_p = int(p.get("total", 0) or 0)
        color = color_map.get(estado, "white")
        ultimos_tabla.add_row(hora, cliente, Text(estado, style=color), f"${total_p:,}")

    grupo = Group(tabla, Text(""), Text("Últimos pedidos:", style="bold dim"), ultimos_tabla)
    return Panel(grupo, title="📦 Pedidos en DynamoDB", border_style="orange3", box=box.ROUNDED)


def render_lambdas(stats: dict) -> Panel:
    tabla = Table(box=box.SIMPLE, padding=(0, 1), show_edge=False)
    tabla.add_column("Lambda", style="cyan")
    tabla.add_column("Invocaciones", justify="right")
    tabla.add_column("Errores", justify="right")

    for label, data in stats.items():
        inv_color = "green" if data["invocations"] > 0 else "dim"
        err_color = "red bold" if data["errors"] > 0 else "dim"
        tabla.add_row(
            label,
            Text(str(data["invocations"]), style=inv_color),
            Text(str(data["errors"]), style=err_color),
        )

    return Panel(
        Group(
            Text("Últimos 5 minutos:", style="dim"),
            tabla,
        ),
        title="⚡ Lambda activity",
        border_style="yellow",
        box=box.ROUNDED,
    )


def render_sqs(visibles: int, en_vuelo: int) -> Panel:
    tabla = Table.grid(padding=(0, 2))
    tabla.add_column(justify="right", style="bold")
    tabla.add_column()

    bar_visibles = "█" * min(visibles, 25)
    bar_vuelo = "▒" * min(en_vuelo, 25)

    tabla.add_row(str(visibles), Text(f"en cola      {bar_visibles}", style="cyan"))
    tabla.add_row(str(en_vuelo), Text(f"procesándose {bar_vuelo}", style="yellow"))

    estado = "🟢 calmo" if visibles < 5 else "🟡 con tráfico" if visibles < 20 else "🔴 saturado"
    return Panel(
        Group(tabla, Text(""), Text(estado, style="bold")),
        title="📨 SQS notifications-queue",
        border_style="cyan",
        box=box.ROUNDED,
    )


def render_catalogo(products: int, riders: int) -> Panel:
    txt = Text()
    txt.append(f"📚 {products} productos\n", style="bold green")
    txt.append(f"🛵 {riders} riders", style="bold cyan")
    return Panel(txt, title="🗄️ Catálogo", border_style="green", box=box.ROUNDED)


def construir_layout(
    prefix: str,
    total: int,
    estados: Counter,
    ultimos: list,
    lambda_stats: dict,
    sqs_visibles: int,
    sqs_vuelo: int,
    products_count: int,
    riders_count: int,
) -> Layout:
    layout = Layout()
    layout.split(
        Layout(render_header(prefix), name="header", size=3),
        Layout(name="body"),
    )
    layout["body"].split_row(
        Layout(render_pedidos(total, estados, ultimos), name="left", ratio=2),
        Layout(name="right", ratio=1),
    )
    layout["right"].split(
        Layout(render_lambdas(lambda_stats), name="lambda"),
        Layout(render_sqs(sqs_visibles, sqs_vuelo), name="sqs"),
        Layout(render_catalogo(products_count, riders_count), name="catalogo"),
    )
    return layout


# ─── Main loop ──────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--prefix",
        default="orderflow-g2p4-personal",
        help="Prefijo de los recursos. Default: orderflow-g2p4-personal",
    )
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--interval", type=int, default=2, help="Segundos entre refreshes")
    args = parser.parse_args()

    cli = crear_clientes(args.region)

    # Nombres derivados del prefijo (coinciden con Terraform)
    orders_table = f"{args.prefix}-orders"
    products_table = f"{args.prefix}-products"
    riders_table = f"{args.prefix}-riders"
    queue_name = f"{args.prefix}-notifications"

    lambda_names = {
        "orders":   f"{args.prefix}-orders",
        "products": f"{args.prefix}-products",
        "riders":   f"{args.prefix}-riders",
        "notifier": f"{args.prefix}-notifier",
    }

    # Construir queue URL
    sts = boto3.client("sts", region_name=args.region)
    account_id = sts.get_caller_identity()["Account"]
    queue_url = f"https://sqs.{args.region}.amazonaws.com/{account_id}/{queue_name}"

    console.print("[bold green]🚀 OrderFlow live dashboard[/bold green]")
    console.print(f"   Prefix: [cyan]{args.prefix}[/cyan]  ·  Region: [cyan]{args.region}[/cyan]")
    console.print(f"   Refrescando cada {args.interval}s. Ctrl+C para salir.\n")
    time.sleep(1)

    try:
        with Live(refresh_per_second=4, screen=True) as live:
            while True:
                # Recolectar datos
                total, estados, ultimos = contar_pedidos(cli["dynamodb"], orders_table)
                products_count = contar_items(cli["dynamodb"], products_table)
                riders_count = contar_items(cli["dynamodb"], riders_table)
                sqs_visibles, sqs_vuelo = sqs_metricas(cli["sqs"], queue_url)

                lambda_stats = {}
                for label, fname in lambda_names.items():
                    lambda_stats[label] = {
                        "invocations": metrica_lambda(cli["cloudwatch"], fname, "Invocations"),
                        "errors": metrica_lambda(cli["cloudwatch"], fname, "Errors"),
                    }

                # Renderizar
                live.update(construir_layout(
                    args.prefix, total, estados, ultimos,
                    lambda_stats, sqs_visibles, sqs_vuelo,
                    products_count, riders_count,
                ))
                time.sleep(args.interval)
    except KeyboardInterrupt:
        console.print("\n[dim]👋 Bye.[/dim]")
        return 0


if __name__ == "__main__":
    main()
