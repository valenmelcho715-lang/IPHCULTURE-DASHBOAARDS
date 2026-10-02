// ============================================================
// extras.ts — Bonos, Canjes, Postventa, Clientes (Backend_Extras)
// Montado en /api: /api/bonos /api/canjes /api/postventa /api/clientes
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, isReadOnly, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

function readOnlyGuard(req: AuthRequest, res: Response): boolean {
  if (isReadOnly(req.user)) {
    res.status(403).json({ error: 'Modo solo lectura: oficina no puede modificar datos' });
    return true;
  }
  return false;
}

// ------------------------------------------------------------
// /bonos
// GET: closer los suyos; admin/oficina todos (join nombre closer)
// POST/PUT/DELETE: solo admin (PUT incluye marcar pagado=1)
// ------------------------------------------------------------
router.get('/bonos', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      r = await db.execute({
        sql: `SELECT b.*, u.nombre AS closer_nombre, ua.nombre AS creador_nombre
              FROM bonos b
              LEFT JOIN users u ON u.id = b.closer_id
              LEFT JOIN users ua ON ua.id = b.creado_por
              WHERE b.closer_id = ?
              ORDER BY b.fecha DESC, b.id DESC`,
        args: [user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT b.*, u.nombre AS closer_nombre, ua.nombre AS creador_nombre
              FROM bonos b
              LEFT JOIN users u ON u.id = b.closer_id
              LEFT JOIN users ua ON ua.id = b.creado_por
              ORDER BY b.fecha DESC, b.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /bonos', err);
    res.status(500).json({ error: 'Error obteniendo bonos' });
  }
});

router.post('/bonos', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const { closer_id, tipo_bono, monto_usd, descripcion, fecha } = req.body || {};
    if (!closer_id || !tipo_bono || monto_usd === undefined) {
      res.status(400).json({ error: 'closer_id, tipo_bono y monto_usd son requeridos' });
      return;
    }
    const r = await db.execute({
      sql: `INSERT INTO bonos (closer_id, tipo_bono, monto_usd, descripcion, fecha, creado_por)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        Number(closer_id),
        tipo_bono,
        Number(monto_usd),
        descripcion ?? null,
        fecha || new Date().toISOString().slice(0, 10),
        req.user!.id,
      ],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /bonos', err);
    res.status(500).json({ error: 'Error creando bono' });
  }
});

router.put('/bonos/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const cur = await db.execute({ sql: `SELECT * FROM bonos WHERE id = ?`, args: [id] });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Bono no encontrado' });
      return;
    }
    const bono = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};
    await db.execute({
      sql: `UPDATE bonos SET closer_id = ?, tipo_bono = ?, monto_usd = ?, descripcion = ?, fecha = ?, pagado = ?
            WHERE id = ?`,
      args: [
        body.closer_id === undefined ? bono.closer_id : Number(body.closer_id),
        body.tipo_bono ?? bono.tipo_bono,
        body.monto_usd === undefined ? bono.monto_usd : Number(body.monto_usd),
        body.descripcion ?? bono.descripcion,
        body.fecha ?? bono.fecha,
        body.pagado === undefined ? bono.pagado : body.pagado ? 1 : 0,
        id,
      ],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /bonos/:id', err);
    res.status(500).json({ error: 'Error actualizando bono' });
  }
});

router.delete('/bonos/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    await db.execute({ sql: `DELETE FROM bonos WHERE id = ?`, args: [Number(req.params.id)] });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /bonos/:id', err);
    res.status(500).json({ error: 'Error eliminando bono' });
  }
});

// ------------------------------------------------------------
// /bonos/campanias — campañas de bonos publicadas por admin
// GET: closers ven activas + su propio estado; admin/oficina ven todas
//      con el detalle de quién marcó "Cumplí".
// ------------------------------------------------------------
router.get('/bonos/campanias', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.rol === 'closer') {
      const r = await db.execute({
        sql: `SELECT c.*, mc.estado AS mi_estado, mc.id AS mi_cumplimiento_id
              FROM bono_campanias c
              LEFT JOIN bono_cumplimientos mc ON mc.campania_id = c.id AND mc.closer_id = ?
              WHERE c.activa = 1
              ORDER BY c.id DESC`,
        args: [user.id],
      });
      res.json(r.rows);
      return;
    }
    const r = await db.execute({
      sql: `SELECT c.*,
              (SELECT COUNT(*) FROM bono_cumplimientos bc WHERE bc.campania_id = c.id AND bc.estado = 'pendiente') AS pendientes,
              (SELECT COUNT(*) FROM bono_cumplimientos bc WHERE bc.campania_id = c.id) AS total_marcados
            FROM bono_campanias c
            ORDER BY c.activa DESC, c.id DESC`,
      args: [],
    });
    res.json(r.rows);
  } catch (err) {
    console.error('GET /bonos/campanias', err);
    res.status(500).json({ error: 'Error obteniendo campañas de bonos' });
  }
});

router.post('/bonos/campanias', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const { titulo, que_hay_que_hacer, premio_usd, fecha_inicio, fecha_fin } = req.body || {};
    if (!titulo || !String(titulo).trim()) {
      res.status(400).json({ error: 'El título del bono es requerido' });
      return;
    }
    const r = await db.execute({
      sql: `INSERT INTO bono_campanias (titulo, que_hay_que_hacer, premio_usd, fecha_inicio, fecha_fin, activa, creado_por)
            VALUES (?, ?, ?, ?, ?, 1, ?)`,
      args: [String(titulo).trim(), que_hay_que_hacer ?? null, Number(premio_usd) || 0, fecha_inicio || null, fecha_fin || null, req.user!.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /bonos/campanias', err);
    res.status(500).json({ error: 'Error creando campaña de bono' });
  }
});

router.put('/bonos/campanias/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const cur = await db.execute({ sql: `SELECT * FROM bono_campanias WHERE id = ?`, args: [id] });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Campaña no encontrada' });
      return;
    }
    const c = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};
    await db.execute({
      sql: `UPDATE bono_campanias SET titulo = ?, que_hay_que_hacer = ?, premio_usd = ?, fecha_inicio = ?, fecha_fin = ?, activa = ?
            WHERE id = ?`,
      args: [
        body.titulo ?? c.titulo,
        body.que_hay_que_hacer ?? c.que_hay_que_hacer,
        body.premio_usd === undefined ? c.premio_usd : Number(body.premio_usd),
        body.fecha_inicio === undefined ? c.fecha_inicio : body.fecha_inicio || null,
        body.fecha_fin === undefined ? c.fecha_fin : body.fecha_fin || null,
        body.activa === undefined ? c.activa : body.activa ? 1 : 0,
        id,
      ],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /bonos/campanias/:id', err);
    res.status(500).json({ error: 'Error actualizando campaña' });
  }
});

router.delete('/bonos/campanias/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    await db.execute({ sql: `DELETE FROM bono_cumplimientos WHERE campania_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM bono_campanias WHERE id = ?`, args: [id] });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /bonos/campanias/:id', err);
    res.status(500).json({ error: 'Error eliminando campaña' });
  }
});

// POST /bonos/campanias/:id/cumplo — el vendedor marca que cumplió el objetivo
router.post('/bonos/campanias/:id/cumplo', requireRole('closer'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const camp = await db.execute({ sql: `SELECT * FROM bono_campanias WHERE id = ? AND activa = 1`, args: [id] });
    if (camp.rows.length === 0) {
      res.status(404).json({ error: 'Campaña no encontrada o ya no está activa' });
      return;
    }
    const ya = await db.execute({
      sql: `SELECT id, estado FROM bono_cumplimientos WHERE campania_id = ? AND closer_id = ?`,
      args: [id, req.user!.id],
    });
    if (ya.rows.length > 0) {
      res.status(409).json({ error: 'Ya marcaste "Cumplí" en este bono', estado: ya.rows[0].estado });
      return;
    }
    const r = await db.execute({
      sql: `INSERT INTO bono_cumplimientos (campania_id, closer_id, estado) VALUES (?, ?, 'pendiente')`,
      args: [id, req.user!.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true, estado: 'pendiente' });
  } catch (err) {
    console.error('POST /bonos/campanias/:id/cumplo', err);
    res.status(500).json({ error: 'Error marcando cumplimiento' });
  }
});

// GET /bonos/cumplimientos — admin/oficina: todos; closer: los propios
router.get('/bonos/cumplimientos', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const base = `SELECT bc.*, c.titulo AS campania_titulo, c.premio_usd, u.nombre AS closer_nombre
                  FROM bono_cumplimientos bc
                  LEFT JOIN bono_campanias c ON c.id = bc.campania_id
                  LEFT JOIN users u ON u.id = bc.closer_id`;
    const r =
      user.rol === 'closer'
        ? await db.execute({ sql: `${base} WHERE bc.closer_id = ? ORDER BY bc.id DESC`, args: [user.id] })
        : await db.execute({
            sql: `${base} ORDER BY CASE bc.estado WHEN 'pendiente' THEN 0 ELSE 1 END, bc.id DESC`,
            args: [],
          });
    res.json(r.rows);
  } catch (err) {
    console.error('GET /bonos/cumplimientos', err);
    res.status(500).json({ error: 'Error obteniendo cumplimientos' });
  }
});

// PUT /bonos/cumplimientos/:id — admin aprueba o rechaza.
// Al aprobar se genera el bono en la tabla clásica (queda pendiente de pago).
router.put('/bonos/cumplimientos/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    if (estado !== 'aprobado' && estado !== 'rechazado') {
      res.status(400).json({ error: "estado debe ser 'aprobado' o 'rechazado'" });
      return;
    }
    const cur = await db.execute({
      sql: `SELECT bc.*, c.titulo, c.premio_usd FROM bono_cumplimientos bc
            LEFT JOIN bono_campanias c ON c.id = bc.campania_id WHERE bc.id = ?`,
      args: [id],
    });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Cumplimiento no encontrado' });
      return;
    }
    const bc = cur.rows[0] as unknown as Record<string, unknown>;
    if (bc.estado !== 'pendiente') {
      res.status(409).json({ error: `Este cumplimiento ya fue ${bc.estado}` });
      return;
    }
    await db.execute({ sql: `UPDATE bono_cumplimientos SET estado = ? WHERE id = ?`, args: [estado, id] });
    if (estado === 'aprobado') {
      await db.execute({
        sql: `INSERT INTO bonos (closer_id, tipo_bono, monto_usd, descripcion, fecha, pagado, creado_por)
              VALUES (?, ?, ?, ?, ?, 0, ?)`,
        args: [
          Number(bc.closer_id),
          'Campaña',
          Number(bc.premio_usd) || 0,
          `Bono ganado: ${bc.titulo || 'campaña'}`,
          new Date().toISOString().slice(0, 10),
          req.user!.id,
        ],
      });
    }
    res.json({ ok: true, estado });
  } catch (err) {
    console.error('PUT /bonos/cumplimientos/:id', err);
    res.status(500).json({ error: 'Error actualizando cumplimiento' });
  }
});

// ------------------------------------------------------------
// /canjes
// GET: closer suyos; admin/oficina todos
// POST: closer o admin | PUT/DELETE: solo admin
// ------------------------------------------------------------
router.get('/canjes', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      r = await db.execute({
        sql: `SELECT c.*, cl.nombre AS cliente_nombre, u.nombre AS closer_nombre
              FROM canjes c
              LEFT JOIN clientes cl ON cl.id = c.cliente_id
              LEFT JOIN users u ON u.id = c.closer_id
              WHERE c.closer_id = ?
              ORDER BY c.id DESC`,
        args: [user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT c.*, cl.nombre AS cliente_nombre, u.nombre AS closer_nombre
              FROM canjes c
              LEFT JOIN clientes cl ON cl.id = c.cliente_id
              LEFT JOIN users u ON u.id = c.closer_id
              ORDER BY c.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /canjes', err);
    res.status(500).json({ error: 'Error obteniendo canjes' });
  }
});

router.post('/canjes', requireRole('admin', 'closer'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const { cliente_id, producto_entregado, producto_recibido, diferencia_usd, estado, closer_id, notas } =
      req.body || {};
    if (!producto_entregado || !producto_recibido) {
      res.status(400).json({ error: 'producto_entregado y producto_recibido son requeridos' });
      return;
    }
    // Closer siempre queda como responsable de su propio canje
    const responsable = req.user!.rol === 'closer' ? req.user!.id : closer_id ? Number(closer_id) : req.user!.id;
    const r = await db.execute({
      sql: `INSERT INTO canjes (cliente_id, producto_entregado, producto_recibido, diferencia_usd, estado, closer_id, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        cliente_id ? Number(cliente_id) : null,
        producto_entregado,
        producto_recibido,
        diferencia_usd === undefined ? null : Number(diferencia_usd),
        estado || 'Pendiente',
        responsable,
        notas ?? null,
      ],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /canjes', err);
    res.status(500).json({ error: 'Error creando canje' });
  }
});

router.put('/canjes/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const cur = await db.execute({ sql: `SELECT * FROM canjes WHERE id = ?`, args: [id] });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Canje no encontrado' });
      return;
    }
    const canje = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};
    await db.execute({
      sql: `UPDATE canjes SET cliente_id = ?, producto_entregado = ?, producto_recibido = ?,
            diferencia_usd = ?, estado = ?, closer_id = ?, notas = ? WHERE id = ?`,
      args: [
        body.cliente_id === undefined ? canje.cliente_id : body.cliente_id ? Number(body.cliente_id) : null,
        body.producto_entregado ?? canje.producto_entregado,
        body.producto_recibido ?? canje.producto_recibido,
        body.diferencia_usd === undefined ? canje.diferencia_usd : Number(body.diferencia_usd),
        body.estado ?? canje.estado,
        body.closer_id === undefined ? canje.closer_id : Number(body.closer_id),
        body.notas ?? canje.notas,
        id,
      ],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /canjes/:id', err);
    res.status(500).json({ error: 'Error actualizando canje' });
  }
});

router.delete('/canjes/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    await db.execute({ sql: `DELETE FROM canjes WHERE id = ?`, args: [Number(req.params.id)] });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /canjes/:id', err);
    res.status(500).json({ error: 'Error eliminando canje' });
  }
});

// ------------------------------------------------------------
// /postventa — mismo patrón que canjes
// ------------------------------------------------------------
router.get('/postventa', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      r = await db.execute({
        sql: `SELECT p.*, cl.nombre AS cliente_nombre, u.nombre AS closer_nombre
              FROM postventa p
              LEFT JOIN clientes cl ON cl.id = p.cliente_id
              LEFT JOIN users u ON u.id = p.closer_id
              WHERE p.closer_id = ?
              ORDER BY p.id DESC`,
        args: [user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT p.*, cl.nombre AS cliente_nombre, u.nombre AS closer_nombre
              FROM postventa p
              LEFT JOIN clientes cl ON cl.id = p.cliente_id
              LEFT JOIN users u ON u.id = p.closer_id
              ORDER BY p.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /postventa', err);
    res.status(500).json({ error: 'Error obteniendo postventa' });
  }
});

router.post('/postventa', requireRole('admin', 'closer'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const { cliente_id, producto, tipo_reclamo, estado, closer_id, descripcion, resolucion } = req.body || {};
    if (!producto || !tipo_reclamo) {
      res.status(400).json({ error: 'producto y tipo_reclamo son requeridos' });
      return;
    }
    const responsable = req.user!.rol === 'closer' ? req.user!.id : closer_id ? Number(closer_id) : req.user!.id;
    const r = await db.execute({
      sql: `INSERT INTO postventa (cliente_id, producto, tipo_reclamo, estado, closer_id, descripcion, resolucion)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        cliente_id ? Number(cliente_id) : null,
        producto,
        tipo_reclamo,
        estado || 'Abierto',
        responsable,
        descripcion ?? null,
        resolucion ?? null,
      ],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /postventa', err);
    res.status(500).json({ error: 'Error creando reclamo de postventa' });
  }
});

router.put('/postventa/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const cur = await db.execute({ sql: `SELECT * FROM postventa WHERE id = ?`, args: [id] });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Reclamo no encontrado' });
      return;
    }
    const pv = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};
    await db.execute({
      sql: `UPDATE postventa SET cliente_id = ?, producto = ?, tipo_reclamo = ?, estado = ?,
            closer_id = ?, descripcion = ?, resolucion = ? WHERE id = ?`,
      args: [
        body.cliente_id === undefined ? pv.cliente_id : body.cliente_id ? Number(body.cliente_id) : null,
        body.producto ?? pv.producto,
        body.tipo_reclamo ?? pv.tipo_reclamo,
        body.estado ?? pv.estado,
        body.closer_id === undefined ? pv.closer_id : Number(body.closer_id),
        body.descripcion ?? pv.descripcion,
        body.resolucion ?? pv.resolucion,
        id,
      ],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /postventa/:id', err);
    res.status(500).json({ error: 'Error actualizando postventa' });
  }
});

router.delete('/postventa/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    await db.execute({ sql: `DELETE FROM postventa WHERE id = ?`, args: [Number(req.params.id)] });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /postventa/:id', err);
    res.status(500).json({ error: 'Error eliminando postventa' });
  }
});

// ------------------------------------------------------------
// /clientes
// GET: closer los suyos; admin/oficina todos | PUT /:id solo admin
// ------------------------------------------------------------
router.get('/clientes', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      r = await db.execute({
        sql: `SELECT c.*, u.nombre AS closer_nombre
              FROM clientes c
              LEFT JOIN users u ON u.id = c.closer_id
              WHERE c.closer_id = ?
              ORDER BY c.id DESC`,
        args: [user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT c.*, u.nombre AS closer_nombre
              FROM clientes c
              LEFT JOIN users u ON u.id = c.closer_id
              ORDER BY c.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /clientes', err);
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
});

router.put('/clientes/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (readOnlyGuard(req, res)) return;
    const id = Number(req.params.id);
    const cur = await db.execute({ sql: `SELECT * FROM clientes WHERE id = ?`, args: [id] });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    const c = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};
    await db.execute({
      sql: `UPDATE clientes SET nombre = ?, canal_origen = ?, cantidad_compras = ?, cliente_recurrente = ?,
            email = ?, instagram = ?, telefono = ?, total_comprado_usd = ?, closer_id = ? WHERE id = ?`,
      args: [
        body.nombre ?? c.nombre,
        body.canal_origen ?? c.canal_origen,
        body.cantidad_compras === undefined ? c.cantidad_compras : Number(body.cantidad_compras),
        body.cliente_recurrente === undefined ? c.cliente_recurrente : body.cliente_recurrente ? 1 : 0,
        body.email ?? c.email,
        body.instagram ?? c.instagram,
        body.telefono ?? c.telefono,
        body.total_comprado_usd === undefined ? c.total_comprado_usd : Number(body.total_comprado_usd),
        body.closer_id === undefined ? c.closer_id : body.closer_id ? Number(body.closer_id) : null,
        id,
      ],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /clientes/:id', err);
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
});

export default router;
