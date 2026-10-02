# Reporte QA — QA_Ventas_Masivo (Dominio: Ventas, carga masiva)

**Rol:** QA_Ventas_Masivo (agente 6/10 del swarm)
**Fecha de ejecución:** contra server en http://localhost:8080 (Express + SQLite local)
**Marca de datos:** todas las ventas/clientes creados llevan `apellido_comprador = "QA-VentasMasivo"`

---

## 1. Datos cargados

- **15 ventas** vía `POST /api/ventas` (8 con token de Ian/closer_id=2, 7 con Maria/closer_id=3). IDs: 9–23.
- **1 venta sacrificial** adicional de Ian (AirTag 1 Pack, id=29) creada solo para probar DELETE y **eliminada** (neto persistente: 15).
- **15 facturas FX-...** generadas automáticamente (1 por venta, todas únicas).
- **15 clientes** en tabla `clientes` (14 únicos + 1 recurrente con 2 compras).
- Variedad cubierta: 3 canjes (ids 14, 18, 22), 6 con seña, 1 con `comprobante_pdf` base64 (id=19), 6 métodos de pago distintos (Efectivo USD, Transferencia, Efectivo ARS, Tarjeta credito, USDT, Mixto), montos USD 165–2140, productos de 6 categorías del catálogo.

| # | Closer | Producto | Precio | Seña | Falta | Canje | Comisión |
|---|--------|----------|-------:|-----:|------:|:-----:|---------:|
| 1 | Ian | iPhone 17 Pro Max 256GB | 1316 | 0 | 1316 | – | 0 |
| 2 | Ian | iPhone 16 128GB | 852 | 200→852* | 652→0* | – | 0 |
| 3 | Ian | AirPods 4 (Recurrente) | 165 | 0 | 165 | – | 0 |
| 4 | Ian | Apple Watch SE 3 44mm (Recurrente) | 360 | 0 | 360 | – | 0 |
| 5 | Ian | iPhone 17 Pro 256GB | 1214 | 500 | 714 | – | 0 |
| 6 | Ian | iPhone 17 256GB | 1000 | 0 | 1000 | SÍ | 15 |
| 7 | Ian | MacBook Neo A18 Pro 13" 8/256 | 765 | 65 | 700 | – | 0 |
| 8 | Ian | AirPods Pro 3rd Gen | 305 | 0 | 305 | – | 0 |
| 9 | Maria | iPhone 17 Pro Max 2TB | 2140 | 1000 | 1140 | – | 0 |
| 10 | Maria | Apple Watch Ultra 3 + CELL 49mm | 835 | 0 | 835 | SÍ | 15 |
| 11 | Maria | MacBook Air M5 13.6" 16/512 (+PDF) | 1380 | 0 | 1380 | – | 0 |
| 12 | Maria | iPad Pro 11" M5 256GB | 1090 | 90 | 1000 | – | 0 |
| 13 | Maria | Apple TV 4K 128GB | 290 | 0 | 290 | – | 0 |
| 14 | Maria | iPhone 17 Pro 512GB | 1438 | 438 | 1000 | SÍ | 15 |
| 15 | Maria | AirPods Max USB-C | 585 | 0 | 585 | – | 0 |

\* Venta 2 editada por PUT en la prueba (f).

## 2. Verificaciones (19/19 OK)

| # | Verificación | Esperado | Obtenido | Estado |
|---|--------------|----------|----------|:------:|
| a1 | Cada POST devuelve venta + factura `FX-...` única | 15 facturas únicas con prefijo FX- | 15/15 únicas, todas `FX-` (ej. FX-MSV42QRG) | OK |
| b | Closer manda `costo_usd=900, ganancia_usd=416` → quedan en 0 | 0 / 0 | 0 / 0 (venta id=9) | OK |
| c | `falta_pagar_usd = precio - seña` cuando no se manda | 652, 714, 700, 1140, 1000, 1000 | exactamente esos valores | OK |
| d1 | GET /api/ventas (Ian) no muestra las de Maria | solo closer_id=2 | 16 ventas, 0 ajenas | OK |
| d2 | GET /api/ventas (Maria) no muestra las de Ian | solo closer_id=3 | 11 ventas, 0 ajenas | OK |
| d3 | Ian ve sus 8 ventas QA | ids 9–16 | ids 9–16 | OK |
| d4 | Maria ve sus 7 ventas QA | ids 17–23 | ids 17–23 | OK |
| e1 | Admin ve las 15 QA | 15/15 | 15/15 (lista total 27, incluye datos de otros agentes) | OK |
| e2 | Oficina ve las 15 QA | 15/15 | 15/15 | OK |
| e3 | Admin y oficina mismo alcance | igual count | 27 = 27 | OK |
| f1 | PUT Ian edita su venta (seña→852, falta→0, pago_completo→1) | 200 + valores | 200, falta=0, pago_completo=1 | OK |
| f1b | Factura sincronizada tras PUT | falta_pagar=0 | 0 | OK |
| f2 | PUT Ian con `ganancia_usd=999, costo_usd=500` → quedan 0 | 0 / 0 | 0 / 0 | OK |
| f3 | PUT Ian sobre venta de Maria | 403 | 403 "Solo podés editar tus propias ventas" | OK |
| f4 | PUT oficina | 403 | 403 "Oficina es solo lectura" | OK |
| g1 | DELETE Ian sobre venta de Maria | 403 | 403 | OK |
| g2 | DELETE Ian su propia venta | 200 + ya no existe (ni su factura) | 200 `{"ok":true,"deleted":29}`, ausente en GET admin | OK |
| g3 | DELETE oficina | 403 | 403 | OK |
| h1 | Clientes QA creados en tabla clientes | ≥14 | 15 | OK |
| h2 | Recurrente: 2 compras, total 525 USD, `cliente_recurrente=1` | (2, 525, 1) | (2, 525, 1) | OK |
| h3 | Clientes con `closer_id` correcto | 2 o 3 | {2, 3} | OK |

## 3. Bugs / observaciones encontrados

### BUG-1 (potencial, concurrencia) — Número de factura por `Date.now()`
- **Archivo:** `server/src/routes/ventas.ts:109`
- **Código:** `const numero = \`FX-${Date.now().toString(36).toUpperCase()}\`;`
- **Problema:** resolución de 1 ms. Dos POST /api/ventas en el mismo milisegswundo generan el mismo `numero` → viola el `UNIQUE` de `facturas.numero` → el catch devuelve 500 **pero la venta ya quedó insertada sin factura** (no hay transacción). En mis pruebas no se reprodujo porque espacié los POST 60 ms.
- **Fix sugerido:** envolver venta+factura+cliente en una transacción y hacer el número único de forma robusta, ej. `FX-${ventaId.toString(36).toUpperCase()}-${Date.now().toString(36).toUpperCase()}` o retry ante `SQLITE_CONSTRAINT`.

### OBS-2 (semántica, no rompe spec) — `pago_completo` por defecto
- **Archivo:** `server/src/routes/ventas.ts:78` (y espejo en PUT, línea 186-187)
- **Observación:** una venta **sin seña** queda con `pago_completo=0` y `falta_pagar=precio` (el sistema interpreta "sin seña" como "debe todo"). Cumple la regla (c) de la spec (`falta = precio - seña`), pero de cara al negocio una venta en efectivo sin seña suele estar pagada. Considerar flag explícito `pago_completo` desde el frontend o default por `metodo_pago`. No modifiqué código.

## 4. Puntaje del dominio

**10 / 10** — Las 15 ventas quedaron cargadas con datos realistas y variados, las 8 verificaciones pedidas (a–h) pasan con evidencia, y los únicos hallazgos son un riesgo de concurrencia no bloqueante (BUG-1, documentado con fix) y una observación semántica menor (OBS-2). No se modificó código fuente ni datos ajenos.
