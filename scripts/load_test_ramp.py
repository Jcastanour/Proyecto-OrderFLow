#!/usr/bin/env python3
"""
load_test_ramp.py — Stress test con rampa de carga gradual.

Empieza enviando pocos requests por segundo y va subiendo linealmente
hasta el máximo durante --duration segundos. Útil para ver en CloudWatch
cómo Lambda escala (cold starts) mientras la carga crece.

Por defecto: arranca con 5 req/s, termina con 50 req/s, en 60 segundos.
Eso son ~1650 requests en total con rampa.

Uso:
    pip install requests
    python3 scripts/load_test_ramp.py \\
        --api-url https://xxxxx.execute-api.us-east-1.amazonaws.com \\
        --duration 60 \\
        --start-rps 5 \\
        --end-rps 50

Imprime stats cada 5s para que veas la evolución en vivo.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor

import requests

PRODUCT_IDS = [f"p{str(i).zfill(3)}" for i in range(1, 25)]
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


# ─── Resultado por request ───
class Result:
    __slots__ = ("kind", "status", "latency_ms", "error", "started_at")

    def __init__(self, kind, status, latency_ms, error, started_at):
        self.kind = kind
        self.status = status
        self.latency_ms = latency_ms
        self.error = error
        self.started_at = started_at  # segundos desde inicio


def pick_request_kind() -> str:
    """Mismo mix que load_test.py: 70% list · 20% by-id · 10% post-order."""
    r = random.random()
    if r < 0.70:
        return "GET /products"
    if r < 0.90:
        return "GET /products/{id}"
    return "POST /orders"


def hacer_request(api_url: str, kind: str, t0_test: float, sink: deque) -> None:
    started_at = time.perf_counter() - t0_test
    try:
        t0 = time.perf_counter()
        if kind == "GET /products":
            r = requests.get(f"{api_url}/products", timeout=15)
        elif kind == "GET /products/{id}":
            pid = random.choice(PRODUCT_IDS)
            r = requests.get(f"{api_url}/products/{pid}", timeout=15)
        else:
            body = {
                "customer": random.choice(CUSTOMERS),
                "items": random.sample(ITEMS_DEMO, k=random.randint(1, 3)),
                "total": random.randint(15000, 80000),
                "direccion": random.choice(DIRECCIONES),
            }
            r = requests.post(
                f"{api_url}/orders",
                headers={"Content-Type": "application/json"},
                data=json.dumps(body),
                timeout=15,
            )
        latency = (time.perf_counter() - t0) * 1000
        sink.append(Result(kind, r.status_code, latency, None, started_at))
    except Exception as err:
        sink.append(Result(kind, 0, 0.0, repr(err), started_at))


def rps_en_segundo(t_segundo: int, duracion: int, start_rps: float, end_rps: float) -> int:
    """Cuántos requests disparar en el segundo t (rampa lineal)."""
    if duracion <= 1:
        return int(end_rps)
    progreso = t_segundo / (duracion - 1)
    rps_actual = start_rps + (end_rps - start_rps) * progreso
    return max(1, int(round(rps_actual)))


def percentil(valores: list[float], p: float) -> float:
    if not valores:
        return 0.0
    s = sorted(valores)
    idx = int(round(p / 100.0 * (len(s) - 1)))
    return s[idx]


def imprimir_stats_parcial(resultados: deque, ventana_seg: tuple[float, float]) -> None:
    t_from, t_to = ventana_seg
    en_ventana = [r for r in resultados if t_from <= r.started_at < t_to]
    ok = [r for r in en_ventana if 200 <= r.status < 300]
    fallidos = [r for r in en_ventana if not (200 <= r.status < 300)]
    lats = [r.latency_ms for r in ok]
    p95 = percentil(lats, 95) if lats else 0
    print(
        f"[t={t_to:5.0f}s]  enviados={len(en_ventana):4d}  "
        f"ok={len(ok):4d}  fallos={len(fallidos):3d}  "
        f"p95={p95:.0f}ms"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--duration", type=int, default=60, help="duración en segundos")
    parser.add_argument("--start-rps", type=float, default=5, help="RPS al inicio")
    parser.add_argument("--end-rps", type=float, default=50, help="RPS al final")
    parser.add_argument("--max-threads", type=int, default=200, help="threads concurrentes")
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    api_url = args.api_url.rstrip("/")

    # Estimar total para info
    estimado = sum(
        rps_en_segundo(s, args.duration, args.start_rps, args.end_rps)
        for s in range(args.duration)
    )

    print(f"🚀 Stress test con rampa contra {api_url}")
    print(f"   Duración: {args.duration}s  ·  Rampa: {args.start_rps:.0f} → {args.end_rps:.0f} req/s")
    print(f"   Total estimado: ~{estimado} requests")
    print(f"   Mix: 70% GET /products · 20% GET /products/{{id}} · 10% POST /orders")
    print()
    print("Evolución:")

    resultados: deque[Result] = deque()
    t0 = time.perf_counter()
    ultimo_print = 0

    with ThreadPoolExecutor(max_workers=args.max_threads) as pool:
        for s in range(args.duration):
            target_t = t0 + s
            rps = rps_en_segundo(s, args.duration, args.start_rps, args.end_rps)

            # Disparar rps requests "spread" dentro del segundo (cada 1/rps seg)
            spacing = 1.0 / rps
            for i in range(rps):
                kind = pick_request_kind()
                # Esperar hasta el slot correspondiente
                slot = target_t + i * spacing
                ahora = time.perf_counter()
                if slot > ahora:
                    time.sleep(slot - ahora)
                pool.submit(hacer_request, api_url, kind, t0, resultados)

            # Imprimir stats parcial cada 5 segundos (al borde)
            t_actual = (s + 1)
            if t_actual % 5 == 0 and t_actual != ultimo_print:
                # Pequeña pausa para que se acumulen respuestas en vuelo
                time.sleep(0.4)
                imprimir_stats_parcial(resultados, (t_actual - 5, t_actual))
                ultimo_print = t_actual

        # Esperar a que todos los requests pendientes terminen
        print()
        print("⏳ Esperando que terminen requests en vuelo…")

    t_total = time.perf_counter() - t0

    # ─── Stats globales ───
    todos = list(resultados)
    ok = [r for r in todos if 200 <= r.status < 300]
    fallidos = [r for r in todos if not (200 <= r.status < 300)]
    lats = [r.latency_ms for r in ok]

    print()
    print("=" * 60)
    print(f"⏱️  Duración real:    {t_total:.2f} s")
    print(f"📊 Total enviados:    {len(todos)}")
    print(f"📊 Throughput avg:    {len(todos)/t_total:.1f} req/s")
    print(f"✅ Exitosos:          {len(ok)} ({100*len(ok)/max(1,len(todos)):.1f}%)")
    print(f"❌ Fallidos:          {len(fallidos)} ({100*len(fallidos)/max(1,len(todos)):.1f}%)")
    print()

    if lats:
        print("Latencia global (ms) sobre exitosos:")
        print(f"  min:  {min(lats):.0f}")
        print(f"  p50:  {percentil(lats, 50):.0f}")
        print(f"  p95:  {percentil(lats, 95):.0f}")
        print(f"  p99:  {percentil(lats, 99):.0f}")
        print(f"  max:  {max(lats):.0f}")
        print(f"  avg:  {statistics.mean(lats):.0f}")
    print()

    # ─── Latencia por mitad del test (inicio vs final, para ver mejora) ───
    if lats:
        mitad = t_total / 2
        lats_inicio = [r.latency_ms for r in ok if r.started_at < mitad]
        lats_final = [r.latency_ms for r in ok if r.started_at >= mitad]
        if lats_inicio and lats_final:
            print("Comparación primera mitad vs segunda mitad:")
            print(f"  Primera mitad  → p95: {percentil(lats_inicio, 95):.0f}ms (cold starts ahí)")
            print(f"  Segunda mitad  → p95: {percentil(lats_final, 95):.0f}ms (warm)")
            print()

    # ─── Por endpoint ───
    print("Por endpoint:")
    for kind in ["GET /products", "GET /products/{id}", "POST /orders"]:
        del_kind = [r for r in todos if r.kind == kind]
        ok_kind = [r for r in del_kind if 200 <= r.status < 300]
        if not del_kind:
            continue
        lats_k = [r.latency_ms for r in ok_kind]
        p95_k = percentil(lats_k, 95) if lats_k else 0
        print(f"  {kind:25s} → {len(del_kind):4d} reqs · {len(ok_kind)} ok · p95 {p95_k:.0f}ms")
    print()

    # ─── Errores agrupados ───
    if fallidos:
        from collections import Counter
        codes = Counter((r.status, (r.error or "?")[:60]) for r in fallidos)
        print("Errores agrupados:")
        for (status, err), count in codes.most_common():
            label = f"HTTP {status}" if status else err
            print(f"  [{label}] × {count}")
        print()

    print("👉 Andá al dashboard CloudWatch ahora —")
    print("   Lambda invocations debería mostrar la rampa subiendo,")
    print("   y los cold starts visibles en duration p99 al principio.")
    return 0 if not fallidos else 1


if __name__ == "__main__":
    sys.exit(main())
