#!/usr/bin/env python3
"""
load_test.py — Generador de carga simple para OrderFlow.

Mete N requests al API mezclando endpoints reales:
  - 70% GET /products              (lectura, lo más común)
  - 20% GET /products/{productId}  (lectura puntual)
  - 10% POST /orders               (escritura, más cara)

Uso:
    pip install requests
    python3 scripts/load_test.py \\
        --api-url https://xxxxx.execute-api.us-east-1.amazonaws.com \\
        --total 500 \\
        --concurrency 50

Reporta: total, OK, errores, p50, p95, p99, throughput (req/s).
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

PRODUCT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 25)]  # p001..p024
CUSTOMERS = ["Juan", "María", "Carlos", "Andrea", "Felipe", "Camila", "Sofía", "Diego"]
DIRECCIONES = [
    "Calle 85 #12-43, Chapinero",
    "Carrera 11 #93-22, Chicó",
    "Calle 72 #8-15, Quinta Camacho",
    "Diagonal 81 #7-20, Rosales",
    "Calle 100 #15-30, Usaquén",
]
ITEMS_DEMO = [
    "Bandeja Paisa", "Ajiaco Santafereño", "Empanadas Vallunas",
    "Salchipapa Salvaje", "Hamburguesa Criolla", "Limonada de Coco",
]


def request_get_products(api_url: str) -> tuple[int, float]:
    t0 = time.perf_counter()
    r = requests.get(f"{api_url}/products", timeout=15)
    return r.status_code, (time.perf_counter() - t0) * 1000


def request_get_product_by_id(api_url: str) -> tuple[int, float]:
    pid = random.choice(PRODUCT_IDS)
    t0 = time.perf_counter()
    r = requests.get(f"{api_url}/products/{pid}", timeout=15)
    return r.status_code, (time.perf_counter() - t0) * 1000


def request_post_order(api_url: str) -> tuple[int, float]:
    body = {
        "customer": random.choice(CUSTOMERS),
        "items": random.sample(ITEMS_DEMO, k=random.randint(1, 3)),
        "total": random.randint(15000, 80000),
        "direccion": random.choice(DIRECCIONES),
    }
    t0 = time.perf_counter()
    r = requests.post(
        f"{api_url}/orders",
        headers={"Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=15,
    )
    return r.status_code, (time.perf_counter() - t0) * 1000


def pick_request_kind() -> str:
    """Distribución: 70% list, 20% get-by-id, 10% post-order."""
    r = random.random()
    if r < 0.70:
        return "GET /products"
    if r < 0.90:
        return "GET /products/{id}"
    return "POST /orders"


def ejecutar_request(api_url: str, kind: str) -> tuple[str, int, float, str | None]:
    try:
        if kind == "GET /products":
            status, latency = request_get_products(api_url)
        elif kind == "GET /products/{id}":
            status, latency = request_get_product_by_id(api_url)
        else:
            status, latency = request_post_order(api_url)
        return kind, status, latency, None
    except Exception as err:
        return kind, 0, 0.0, repr(err)


def percentil(valores: list[float], p: float) -> float:
    if not valores:
        return 0.0
    s = sorted(valores)
    idx = int(round(p / 100.0 * (len(s) - 1)))
    return s[idx]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", required=True, help="https://xxx.execute-api.us-east-1.amazonaws.com")
    parser.add_argument("--total", type=int, default=500, help="número total de requests")
    parser.add_argument("--concurrency", type=int, default=50, help="requests concurrentes")
    parser.add_argument("--seed", type=int, default=None, help="seed para reproducibilidad")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    api_url = args.api_url.rstrip("/")

    print(f"🚀 Load test contra {api_url}")
    print(f"   Total: {args.total} requests · Concurrencia: {args.concurrency}")
    print(f"   Mix: 70% GET /products · 20% GET /products/{{id}} · 10% POST /orders")
    print()

    tareas = [pick_request_kind() for _ in range(args.total)]
    resultados: list[tuple[str, int, float, str | None]] = []

    t_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futs = [pool.submit(ejecutar_request, api_url, k) for k in tareas]
        for i, f in enumerate(as_completed(futs), 1):
            resultados.append(f.result())
            if i % 50 == 0:
                print(f"   …{i}/{args.total}")
    t_total = time.perf_counter() - t_start

    # ─── Stats globales ───
    ok = [r for r in resultados if 200 <= r[1] < 300]
    fallidos = [r for r in resultados if not (200 <= r[1] < 300)]
    latencias_ok = [r[2] for r in ok]

    print()
    print("=" * 60)
    print(f"⏱️  Tiempo total:     {t_total:.2f} s")
    print(f"📊 Throughput:        {args.total / t_total:.1f} req/s")
    print(f"✅ Exitosos:          {len(ok)} ({100*len(ok)/args.total:.1f}%)")
    print(f"❌ Fallidos:          {len(fallidos)} ({100*len(fallidos)/args.total:.1f}%)")
    print()

    if latencias_ok:
        print("Latencia (ms) sobre exitosos:")
        print(f"  min:  {min(latencias_ok):.0f}")
        print(f"  p50:  {percentil(latencias_ok, 50):.0f}")
        print(f"  p95:  {percentil(latencias_ok, 95):.0f}")
        print(f"  p99:  {percentil(latencias_ok, 99):.0f}")
        print(f"  max:  {max(latencias_ok):.0f}")
        print(f"  avg:  {statistics.mean(latencias_ok):.0f}")
    print()

    # ─── Stats por tipo de endpoint ───
    print("Por endpoint:")
    for kind in ["GET /products", "GET /products/{id}", "POST /orders"]:
        del_kind = [r for r in resultados if r[0] == kind]
        ok_kind = [r for r in del_kind if 200 <= r[1] < 300]
        if not del_kind:
            continue
        lats = [r[2] for r in ok_kind]
        p95 = percentil(lats, 95) if lats else 0
        print(f"  {kind:25s} → {len(del_kind):4d} reqs · {len(ok_kind)} ok · p95 {p95:.0f}ms")
    print()

    # ─── Errores agrupados ───
    if fallidos:
        from collections import Counter
        codes = Counter((r[1], r[3] or "?") for r in fallidos)
        print("Errores agrupados:")
        for (status, err), count in codes.most_common():
            label = f"{status}" if status else err[:60]
            print(f"  [{label}] × {count}")
        print()

    print("👉 Mirá el dashboard CloudWatch ahora — deberías ver el pico de tráfico.")
    return 0 if not fallidos else 1


if __name__ == "__main__":
    sys.exit(main())
