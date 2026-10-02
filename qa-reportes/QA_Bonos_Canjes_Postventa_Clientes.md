# Reporte QA — Bonos / Canjes / Postventa / Clientes

**Rol:** QA_Bonos_Canjes_Postventa_Clientes
**Fecha:** 2026-08-16 · Server: http://localhost:8080 (SQLite `iphone-culture.db`)
**Prefijo de datos propios:** `QA-Bonos`, `QA-Canjes`, `QA-Postventa`

## Datos cargados

| Entidad | Cantidad | Detalle |
|---|---|---|
| Bonos | 4 | ids 1-4: 2 para Ian (closer_id=2: "Bono por objetivo" $500, "Bono ticket alto" $250), 2 para Maria (closer_id=3: "Bono por objetivo" $400, "Bono canje destacado" $150). Bono id=1 marcado `pagado=1` vía PUT |
| Canjes | 3 | id=1 (Ian, cliente Juan Perez, Completado), id=2 (Maria, cliente Ana Lopez, Pendiente), id=3 (admin→asignado Maria, cliente Recurrente QA-VentasMasivo, En revision) |
| Postventas | 2 | id=1 (Ian, Garantia, Abierto), id=2 (Maria, Consulta, Resuelto con resolución) |

## Verificaciones

| # | Check | Esperado | Obtenido | Estado |
|---|---|---|---|---|
| a1 | GET /api/bonos como Ian | solo closer_id=2 | 2 bonos, ambos closer_id=2 (ids 1,2) | ✅ OK |
| a2 | GET /api/bonos como Maria | solo closer_id=3 | 2 bonos, ambos closer_id=3 (ids 3,4) | ✅ OK |
| a3 | GET /api/bonos como admin/oficina | todos | 4 bonos en ambos roles | ✅ OK |
| b | POST /api/bonos como closer (Ian) | 403 | HTTP 403 | ✅ OK |
| c | PUT /api/bonos/1 `{pagado:1}` persiste | pagado=1 al re-leer | `pagado: 1` confirmado en GET admin e Ian | ✅ OK |
| d1 | POST canje/postventa como closer | crea con su propio closer_id (ignora closer_id enviado) | canje Ian → closer_id=2; admin con closer_id=3 → quedó 3 | ✅ OK |
| d2 | GET canjes: closer solo suyos | Ian 1, Maria 2 | Ian: 1 (id=1) · Maria: 2 (ids 2,3) | ✅ OK |
| d3 | GET postventa: closer solo suyos | Ian 1, Maria 1 | Ian: 1 (id=1) · Maria: 1 (id=2) | ✅ OK |
| d4 | GET canjes/postventa admin/oficina | todos | canjes: 3 · postventa: 2 (oficina incluida) | ✅ OK |
| d5 | Oficina (solo lectura) POST canje | 403 | HTTP 403 | ✅ OK |
| e1 | Clientes = compradores de ventas | todos los compradores únicos (25) existen en clientes | 0 ventas huérfanas | ✅ OK |
| e2 | cantidad_compras y total_comprado_usd coherentes con SUM/COUNT de /api/ventas | match exacto por (nombre, closer_id) | 25/27 coherentes · 2 excepciones → ver bugs | ⚠️ PARCIAL |
| e3 | cliente_recurrente=1 si >1 compra | flag correcto | OK en todos los casos con ventas (ids 2, 10 recurrentes=1; el resto 0) | ✅ OK |

**Resultado: 12 OK / 1 parcial (con causa identificada) de 13 checks.**

## Bugs encontrados (NO corregidos — sin tocar código)

### BUG-1 (severidad media): DELETE /api/ventas/:id no revierte el upsert de clientes
- **Archivo:** `server/dist/routes/ventas.js`, líneas 246-247 (fuente: `server/src/routes/ventas.ts`, handler DELETE)
- **Síntoma:** el cliente "Sacrificial QA-VentasMasivo" tiene `cantidad_compras=1, total_comprado_usd=75` pero ya no existe ninguna venta suya (otro agente la borró como prueba). El agregado quedó inflado y nunca se revierte.
- **Fix sugerido:** antes de borrar, capturar `nombre_comprador/apellido_comprador/closer_id/precio_venta_usd` y hacer decremento en `clientes` (`cantidad_compras-1`, `total_comprado_usd - precio`, recalcular `cliente_recurrente = cantidad_compras-1 > 1`), eliminando el registro de cliente si queda en 0 compras.

### BUG-2 (severidad media): PUT /api/ventas/:id no sincroniza clientes
- **Archivo:** `server/dist/routes/ventas.js`, líneas ~197-213 (fuente: `server/src/routes/ventas.ts`, handler PUT)
- **Síntoma:** si se edita `precio_venta_usd` o el nombre del comprador, los agregados de `clientes` (cantidad_compras / total_comprado_usd) quedan desactualizados. Solo se sincroniza `facturas`.
- **Fix sugerido:** en el PUT, revertir el aporte de la venta anterior al cliente viejo y aplicar el nuevo (misma lógica de upsert del POST, líneas 110-128).

### Nota (no bug del código): cliente "QATest QA-Comisiones RAW"
Tiene `cantidad_compras=1, total=1150` sin venta visible en la API. Probablemente otro agente lo insertó directo en la DB o su venta fue borrada (mismo mecanismo del BUG-1). No atribuible a un defecto adicional del código.

## Puntaje del dominio: **9 / 10**

Todo el comportamiento de roles, permisos (403 closer/oficina), filtrado por closer, persistencia de `pagado` y lógica de `cliente_recurrente` funciona exactamente según SPEC. Se descuenta 1 punto por la inconsistencia de agregados en `clientes` ante DELETE/PUT de ventas (BUG-1/BUG-2), que deja datos huérfanos detectables por cualquier cross-check.
