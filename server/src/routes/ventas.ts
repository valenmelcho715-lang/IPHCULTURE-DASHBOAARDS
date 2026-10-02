// ============================================================
// ventas.ts — Rutas de ventas (Backend_Ventas_Facturas)
// Reglas críticas (SPEC sección 8):
//  - Closer NUNCA setea costo_usd / ganancia_usd (forzados a 0)
//  - es_canje=1 → comision_usd = 15 fija; si no, 0 hasta que admin cargue ganancia
//  - Admin al cambiar ganancia_usd → comision = ganancia * 0.20 (canje queda 15)
//  - Al crear venta → factura automática FX-${Date.now().toString(36).toUpperCase()}
//  - Upsert en clientes (cantidad_compras, total_comprado_usd, cliente_recurrente)
//  - Oficina PUEDE crear ventas indicando closer_id (un closer o ella misma)
//    y PUEDE EDITAR cualquier venta (pago/señas/estado/comprador), pero NUNCA
//    costo/ganancia ni reasignar closer_id; sigue 403 en DELETE
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, isReadOnly, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

const COMISION_CANJE_USD = 15;

function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Un closer nunca debe ver el margen del negocio (costo/ganancia) — se omiten en sus respuestas
function sanitizeVenta<T extends Record<string, unknown>>(row: T, rol: string): T {
  if (rol === 'admin') return row;
  const clean = { ...row } as Record<string, unknown>;
  delete clean.costo_usd;
  delete clean.ganancia_usd;
  return clean as T;
}

// Sincroniza los agregados del cliente (delta=+1 suma una compra, -1 la revierte)
async function syncCliente(nombre: string | null, closerId: number, precio: number, delta: 1 | -1): Promise<void> {
  if (!nombre) return;
  const ex = await db.execute({
    sql: 'SELECT id, cantidad_compras, total_comprado_usd FROM clientes WHERE nombre = ? AND closer_id = ?',
    args: [nombre, closerId],
  });
  if (ex.rows.length > 0) {
    const c = ex.rows[0] as any;
    const cant = Math.max(0, Number(c.cantidad_compras || 0) + delta);
    const tot = Math.max(0, Math.round((Number(c.total_comprado_usd || 0) + delta * precio) * 100) / 100);
    await db.execute({
      sql: 'UPDATE clientes SET cantidad_compras = ?, total_comprado_usd = ?, cliente_recurrente = ? WHERE id = ?',
      args: [cant, tot, cant > 1 ? 1 : 0, c.id],
    });
  } else if (delta === 1) {
    await db.execute({
      sql: `INSERT INTO clientes (nombre, canal_origen, cantidad_compras, cliente_recurrente, total_comprado_usd, closer_id)
            VALUES (?,?,?,?,?,?)`,
      args: [nombre, 'Venta directa', 1, 0, precio, closerId],
    });
  }
}

// GET /api/ventas — closer solo las suyas; admin/oficina todas. Siempre con closer_nombre.
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const baseSql = `
      SELECT v.*, u.nombre AS closer_nombre
      FROM ventas v
      LEFT JOIN users u ON u.id = v.closer_id
    `;
    const result =
      user.rol === 'closer'
        ? await db.execute({ sql: `${baseSql} WHERE v.closer_id = ? ORDER BY v.created_at DESC`, args: [user.id] })
        : await db.execute(`${baseSql} ORDER BY v.created_at DESC`);
    // El listado NO viaja con el comprobante (base64 pesado): se pide por GET /:id al editar
    res.json(result.rows.map((r) => {
      const row = sanitizeVenta(r as Record<string, unknown>, user.rol);
      row.comprobante_pdf = null;
      return row;
    }));
  } catch (err) {
    console.error('[ventas] GET / error', err);
    res.status(500).json({ error: 'Error obteniendo ventas' });
  }
});

// GET /api/ventas/:id — detalle completo (incluye comprobante_pdf). Closer solo las suyas.
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = num(req.params.id);
    const result = await db.execute({
      sql: `SELECT v.*, u.nombre AS closer_nombre FROM ventas v LEFT JOIN users u ON u.id = v.closer_id WHERE v.id = ?`,
      args: [id],
    });
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Venta no encontrada' });
      return;
    }
    const venta = result.rows[0] as Record<string, unknown>;
    if (user.rol === 'closer' && Number(venta.closer_id) !== user.id) {
      res.status(403).json({ error: 'Solo podés ver tus propias ventas' });
      return;
    }
    res.json({ venta: sanitizeVenta(venta, user.rol) });
  } catch (err) {
    console.error('[ventas] GET /:id error', err);
    res.status(500).json({ error: 'Error obteniendo venta' });
  }
});

// POST /api/ventas — closer crea con su id; admin puede indicar closer_id;
// oficina DEBE indicar closer_id (un closer o su propio id = venta propia).
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const body = req.body || {};

    // closer_id: el closer siempre vende a su nombre; admin puede indicar otro closer;
    // oficina elige el dueño de la venta (closer existente o ella misma)
    let closerId = user.id;
    if (user.rol === 'admin' && body.closer_id != null) {
      closerId = num(body.closer_id, user.id);
    } else if (user.rol === 'oficina') {
      if (body.closer_id == null || body.closer_id === '') {
        res.status(400).json({ error: 'Oficina debe indicar de quién es la venta (closer_id)' });
        return;
      }
      closerId = num(body.closer_id);
      if (closerId !== user.id) {
        const c = await db.execute({ sql: `SELECT id, rol FROM users WHERE id = ?`, args: [closerId] });
        if (c.rows.length === 0 || (c.rows[0] as unknown as { rol: string }).rol !== 'closer') {
          res.status(400).json({ error: 'closer_id debe ser un usuario con rol closer o tu propio id (venta propia)' });
          return;
        }
      }
    }

    // REGLA 1: closer NUNCA puede setear costo/ganancia/comision — forzados
    const esAdmin = user.rol === 'admin';
    const costoUsd = esAdmin ? num(body.costo_usd) : 0;
    const gananciaUsd = esAdmin ? num(body.ganancia_usd) : 0;

    const esCanje = num(body.es_canje) ? 1 : 0;
    // REGLA 2: canje → comisión fija 15; si no, 0 hasta que admin cargue ganancia;
    // si admin ya carga ganancia al crear, comisión = ganancia * 0.20
    let comisionUsd = 0;
    if (esCanje) comisionUsd = COMISION_CANJE_USD;
    else if (esAdmin && gananciaUsd > 0) comisionUsd = Math.round(gananciaUsd * 0.2 * 100) / 100;

    if (user.rol !== 'admin' && (num(body.pago_completo) || num(body.monto_senado_usd) > 0 || (body.falta_pagar_usd != null && num(body.falta_pagar_usd) !== num(body.precio_venta_usd)))) {
      res.status(403).json({error:'Solo administración confirma dinero recibido'}); return;
    }
    if (num(body.precio_venta_usd) <= 0 || !body.producto) { res.status(400).json({error:'Producto y precio positivo requeridos'}); return; }
    const precioVenta = num(body.precio_venta_usd);
    const montoSenado = num(body.monto_senado_usd);
    // REGLA 3: falta_pagar = precio - seña si no viene
    const faltaPagar =
      body.falta_pagar_usd != null ? num(body.falta_pagar_usd) : Math.max(0, Math.round((precioVenta - montoSenado) * 100) / 100);
    const pagoCompleto = body.pago_completo != null ? (num(body.pago_completo) ? 1 : 0) : faltaPagar <= 0 ? 1 : 0;

    if (precioVenta < 0 || montoSenado < 0 || faltaPagar < 0 || Math.abs(precioVenta-montoSenado-faltaPagar) > 0.01 || (pagoCompleto && faltaPagar > 0)) {res.status(400).json({error:'Los importes de precio, seña y saldo no coinciden'});return;}
    const insert = await db.execute({
      sql: `INSERT INTO ventas
        (closer_id, nombre_comprador, apellido_comprador, dni, producto, precio_venta_usd,
         costo_usd, ganancia_usd, comision_usd, pago_completo, monto_senado_usd, falta_pagar_usd,
         metodo_pago, es_canje, estado, notas, comprobante_pdf)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        closerId,
        body.nombre_comprador ?? null,
        body.apellido_comprador ?? null,
        body.dni ?? null,
        body.producto ?? null,
        precioVenta,
        costoUsd,
        gananciaUsd,
        comisionUsd,
        pagoCompleto,
        montoSenado,
        faltaPagar,
        body.metodo_pago ?? 'Efectivo USD',
        esCanje,
        body.estado ?? 'Completada',
        body.notas ?? null,
        body.comprobante_pdf ?? null,
      ],
    });
    const ventaId = Number(insert.lastInsertRowid);

    // REGLA 4: factura automática (número único anti-colisión: incluye el id de la venta)
    const numero = `FX-${ventaId.toString(36).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const clienteNombre = [body.nombre_comprador, body.apellido_comprador].filter(Boolean).join(' ').trim() || null;
    const facturaInsert = await db.execute({
      sql: `INSERT INTO facturas
        (venta_id, closer_id, numero, cliente_nombre, cliente_dni, producto, precio_usd, monto_senado, falta_pagar, es_canje, estado)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'Emitida')`,
      args: [ventaId, closerId, numero, clienteNombre, body.dni ?? null, body.producto ?? null, precioVenta, montoSenado, faltaPagar, esCanje],
    });
    const facturaId = Number(facturaInsert.lastInsertRowid);

    // REGLA 5: upsert en clientes
    await syncCliente(clienteNombre, closerId, precioVenta, 1);

    const venta = await db.execute({
      sql: `SELECT v.*, u.nombre AS closer_nombre FROM ventas v LEFT JOIN users u ON u.id = v.closer_id WHERE v.id = ?`,
      args: [ventaId],
    });
    const factura = await db.execute({ sql: 'SELECT * FROM facturas WHERE id = ?', args: [facturaId] });

    res.status(201).json({ venta: sanitizeVenta(venta.rows[0] as Record<string, unknown>, user.rol), factura: factura.rows[0] });
  } catch (err) {
    console.error('[ventas] POST / error', err);
    res.status(500).json({ error: 'Error creando venta' });
  }
});

// PUT /api/ventas/:id — closer solo las suyas y sin tocar costo/ganancia/comision;
// admin todo (incl. closer_id y campos financieros); oficina puede editar CUALQUIER
// venta (caso típico: cliente termina de pagar una seña) pero NUNCA costo/ganancia
// ni reasignar closer_id (quedan forzados/ignorados abajo).
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = num(req.params.id);
    const actual = await db.execute({ sql: 'SELECT * FROM ventas WHERE id = ?', args: [id] });
    if (actual.rows.length === 0) {
      res.status(404).json({ error: 'Venta no encontrada' });
      return;
    }
    const venta = actual.rows[0] as any;
    if (user.rol === 'closer' && Number(venta.closer_id) !== user.id) {
      res.status(403).json({ error: 'Solo podés editar tus propias ventas' });
      return;
    }

    const body = req.body || {};
    const esAdmin = user.rol === 'admin';
    if (!esAdmin && ['pago_completo','monto_senado_usd','falta_pagar_usd'].some(k => body[k] != null && num(body[k]) !== num(venta[k]))) {
      res.status(403).json({error:'Solo administración confirma o modifica pagos'}); return;
    }
    if (venta.crm_conversation_id) { res.status(409).json({error:'Esta venta está vinculada a Atención IA; gestioná la operación desde su conversación'}); return; }

    // Campos editables por cualquiera (closer dueño o admin)
    const nombre = body.nombre_comprador ?? venta.nombre_comprador;
    const apellido = body.apellido_comprador ?? venta.apellido_comprador;
    const dni = body.dni ?? venta.dni;
    const producto = body.producto ?? venta.producto;
    const precioVenta = body.precio_venta_usd != null ? num(body.precio_venta_usd) : Number(venta.precio_venta_usd || 0);
    const montoSenado = body.monto_senado_usd != null ? num(body.monto_senado_usd) : Number(venta.monto_senado_usd || 0);
    const faltaPagar =
      body.falta_pagar_usd != null ? num(body.falta_pagar_usd) : Math.max(0, Math.round((precioVenta - montoSenado) * 100) / 100);
    const pagoCompleto =
      body.pago_completo != null ? (num(body.pago_completo) ? 1 : 0) : faltaPagar <= 0 ? 1 : 0;
    if (precioVenta < 0 || montoSenado < 0 || faltaPagar < 0 || Math.abs(precioVenta-montoSenado-faltaPagar) > 0.01 || (pagoCompleto && faltaPagar > 0)) {res.status(400).json({error:'Los importes de precio, seña y saldo no coinciden'});return;}
    const metodoPago = body.metodo_pago ?? venta.metodo_pago;
    const esCanje = body.es_canje != null ? (num(body.es_canje) ? 1 : 0) : Number(venta.es_canje || 0);
    const estado = body.estado ?? venta.estado;
    const notas = body.notas ?? venta.notas;
    const comprobantePdf = body.comprobante_pdf ?? venta.comprobante_pdf;
    const closerId = esAdmin && body.closer_id != null ? num(body.closer_id, Number(venta.closer_id)) : Number(venta.closer_id);

    // Campos financieros: SOLO admin
    let costoUsd = Number(venta.costo_usd || 0);
    let gananciaUsd = Number(venta.ganancia_usd || 0);
    let comisionUsd = Number(venta.comision_usd || 0);
    if (esAdmin) {
      costoUsd = body.costo_usd != null ? num(body.costo_usd) : costoUsd;
      const gananciaCambio = body.ganancia_usd != null && num(body.ganancia_usd) !== gananciaUsd;
      gananciaUsd = body.ganancia_usd != null ? num(body.ganancia_usd) : gananciaUsd;
      // Si cambia la ganancia → recalcular comisión (canje queda fija en 15)
      if (esCanje) comisionUsd = COMISION_CANJE_USD;
      else if (gananciaCambio) comisionUsd = Math.round(gananciaUsd * 0.2 * 100) / 100;
    } else if (esCanje) {
      comisionUsd = COMISION_CANJE_USD;
    }

    await db.execute({
      sql: `UPDATE ventas SET
        closer_id = ?, nombre_comprador = ?, apellido_comprador = ?, dni = ?, producto = ?,
        precio_venta_usd = ?, costo_usd = ?, ganancia_usd = ?, comision_usd = ?, pago_completo = ?,
        monto_senado_usd = ?, falta_pagar_usd = ?, metodo_pago = ?, es_canje = ?, estado = ?, notas = ?, comprobante_pdf = ?
        WHERE id = ?`,
      args: [
        closerId, nombre, apellido, dni, producto, precioVenta, costoUsd, gananciaUsd, comisionUsd,
        pagoCompleto, montoSenado, faltaPagar, metodoPago, esCanje, estado, notas, comprobantePdf, id,
      ],
    });

    // Mantener la factura asociada sincronizada con los datos visibles de la venta
    const clienteNombre = [nombre, apellido].filter(Boolean).join(' ').trim() || null;
    await db.execute({
      sql: `UPDATE facturas SET cliente_nombre = ?, cliente_dni = ?, producto = ?, precio_usd = ?, monto_senado = ?, falta_pagar = ?, es_canje = ?
            WHERE venta_id = ?`,
      args: [clienteNombre, dni, producto, precioVenta, montoSenado, faltaPagar, esCanje, id],
    });

    // Sincronizar agregados de clientes: revertir el aporte anterior y aplicar el nuevo
    const clienteAnterior = [venta.nombre_comprador, venta.apellido_comprador].filter(Boolean).join(' ').trim() || null;
    await syncCliente(clienteAnterior, Number(venta.closer_id), Number(venta.precio_venta_usd || 0), -1);
    await syncCliente(clienteNombre, closerId, precioVenta, 1);

    const updated = await db.execute({
      sql: `SELECT v.*, u.nombre AS closer_nombre FROM ventas v LEFT JOIN users u ON u.id = v.closer_id WHERE v.id = ?`,
      args: [id],
    });
    const factura = await db.execute({ sql: 'SELECT * FROM facturas WHERE venta_id = ?', args: [id] });
    res.json({ venta: sanitizeVenta(updated.rows[0] as Record<string, unknown>, user.rol), factura: factura.rows[0] ?? null });
  } catch (err) {
    console.error('[ventas] PUT /:id error', err);
    res.status(500).json({ error: 'Error actualizando venta' });
  }
});

// DELETE /api/ventas/:id — closer solo las suyas (+ borra su factura); admin todas; oficina 403.
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isReadOnly(user)) {
      res.status(403).json({ error: 'Oficina es solo lectura' });
      return;
    }
    const id = num(req.params.id);
    const actual = await db.execute({ sql: 'SELECT * FROM ventas WHERE id = ?', args: [id] });
    if (actual.rows.length === 0) {
      res.status(404).json({ error: 'Venta no encontrada' });
      return;
    }
    const venta = actual.rows[0] as any;
    if (user.rol === 'closer' && Number(venta.closer_id) !== user.id) {
      res.status(403).json({ error: 'Solo podés eliminar tus propias ventas' });
      return;
    }
    if (venta.crm_conversation_id) { res.status(409).json({error:'No se puede borrar una venta vinculada a una reserva'}); return; }
    // Revertir el aporte de esta venta en los agregados del cliente antes de borrar
    const clienteAnterior = [venta.nombre_comprador, venta.apellido_comprador].filter(Boolean).join(' ').trim() || null;
    await syncCliente(clienteAnterior, Number(venta.closer_id), Number(venta.precio_venta_usd || 0), -1);
    await db.execute({ sql: 'DELETE FROM facturas WHERE venta_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM ventas WHERE id = ?', args: [id] });
    res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error('[ventas] DELETE /:id error', err);
    res.status(500).json({ error: 'Error eliminando venta' });
  }
});

export default router;
