// ============================================================
// routes/turnos.ts — Backend_Turnos
// CRUD de turnos con permisos por rol:
//   - admin:  todo
//   - oficina: solo lectura (mutaciones → 403)
//   - closer: solo sus propios turnos
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, isReadOnly, AuthRequest } from '../auth';
import {checkSlot} from '../automation/commerce';
import {BusinessError} from '../automation/repository';

const router = Router();

router.use(authRequired);

// Campos editables del schema de turnos (closer_id se maneja aparte)
const CAMPOS_EDITABLES = [
  'cliente_nombre',
  'telefono',
  'fecha_hora',
  'motivo',
  'producto_objetivo',
  'modelo_detalle',
  'que_busca',
  'presupuesto_estimado',
  'moneda',
  'forma_pago',
  'senia',
  'monto_senia',
  'cliente_id',
  'venta_id',
  'confirmado',
  'canal_contacto',
  'ultimo_contacto',
  'estado_recordatorio',
  'tipo',
  'estado',
  'notas',
  'notificar_whatsapp',
] as const;

// Normaliza 'YYYY-MM-DDTHH:MM' (datetime-local) a formato SQLite
// NOTA timezone: fecha_hora se guarda en HORA LOCAL (naive, desde datetime-local del frontend),
// Se compara con hora de Neuquén (UTC-3), independientemente de la zona del servidor.
const FH = "datetime(replace(t.fecha_hora, 'T', ' '))";

const val = <T>(v: T | undefined | null, def: T): T =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? def : v;

// ------------------------------------------------------------
// GET /proximos — turnos desde ahora hasta +48h con flag alerta
// (urgente <=15min, pronto <=30min, sin mutar la DB)
// IMPORTANTE: declarado antes de cualquier ruta con :id
// ------------------------------------------------------------
router.get('/proximos', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const esStaff = user.rol === 'admin' || user.rol === 'oficina';

    const sql = `
      SELECT t.*, u.nombre AS closer_nombre,
        CASE
          WHEN (julianday(${FH}) - julianday(datetime('now','-3 hours'))) * 1440.0 <= 15 THEN 'urgente'
          WHEN (julianday(${FH}) - julianday(datetime('now','-3 hours'))) * 1440.0 <= 30 THEN 'pronto'
          ELSE NULL
        END AS alerta
      FROM turnos t
      LEFT JOIN users u ON u.id = t.closer_id
      WHERE ${FH} >= datetime('now','-3 hours')
        AND ${FH} <= datetime('now','-3 hours','+48 hours')
        ${esStaff ? '' : 'AND t.closer_id = ?'}
      ORDER BY t.fecha_hora ASC
    `;
    const args: Array<number | string> = esStaff ? [] : [user.id];
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    console.error('GET /turnos/proximos error:', err);
    res.status(500).json({ error: 'Error al obtener los próximos turnos' });
  }
});

// ------------------------------------------------------------
// GET / — closer solo sus turnos; admin/oficina todos
// Filtros: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por fecha_hora)
// Orden ascendente por fecha_hora
// ------------------------------------------------------------
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const esStaff = user.rol === 'admin' || user.rol === 'oficina';
    const { desde, hasta } = req.query as { desde?: string; hasta?: string };

    let sql = `
      SELECT t.*, u.nombre AS closer_nombre
      FROM turnos t
      LEFT JOIN users u ON u.id = t.closer_id
      WHERE 1=1
    `;
    const args: Array<number | string> = [];

    if (!esStaff) {
      sql += ' AND t.closer_id = ?';
      args.push(user.id);
    }
    if (desde) {
      sql += ` AND date(${FH}) >= date(?)`;
      args.push(desde);
    }
    if (hasta) {
      sql += ` AND date(${FH}) <= date(?)`;
      args.push(hasta);
    }
    sql += ' ORDER BY t.fecha_hora ASC';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    console.error('GET /turnos error:', err);
    res.status(500).json({ error: 'Error al obtener los turnos' });
  }
});

// ------------------------------------------------------------
// POST / — crear turno
// closer_id = usuario actual (admin puede asignar otro closer_id)
// oficina → 403
// ------------------------------------------------------------
router.post('/', async (req: AuthRequest, res: Response) => {
  let tx:Awaited<ReturnType<typeof db.transaction>>|undefined;
  try {
    const user = req.user!;
    if (isReadOnly(user)) {
      res.status(403).json({ error: 'Oficina tiene acceso de solo lectura' });
      return;
    }

    const b = req.body || {};
    if (!b.cliente_nombre || String(b.cliente_nombre).trim() === '') {
      res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
      return;
    }
    if (!b.fecha_hora || String(b.fecha_hora).trim() === '') {
      res.status(400).json({ error: 'La fecha y hora del turno son obligatorias' });
      return;
    }

    // Admin puede asignar el turno a otro closer; el resto se auto-asigna
    let closerId = user.id;
    if (user.rol === 'admin' && b.closer_id !== undefined && b.closer_id !== null) {
      const existe = await db.execute({
        sql: 'SELECT id FROM users WHERE id = ?',
        args: [Number(b.closer_id)],
      });
      if (existe.rows.length === 0) {
        res.status(400).json({ error: 'El closer asignado no existe' });
        return;
      }
      closerId = Number(b.closer_id);
    }

    tx=await db.transaction('write');
    const stamp=await checkSlot(closerId,String(b.fecha_hora),tx);
    const result = await tx.execute({
      sql: `INSERT INTO turnos (
              closer_id, cliente_nombre, telefono, fecha_hora, motivo,
              producto_objetivo, modelo_detalle, que_busca, presupuesto_estimado,
              moneda, forma_pago, senia, monto_senia, cliente_id, venta_id,
              confirmado, canal_contacto, ultimo_contacto, estado_recordatorio,
              tipo, estado, notas, notificar_whatsapp
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        closerId,
        String(b.cliente_nombre).trim(),
        val(b.telefono, null),
        stamp,
        val(b.motivo, 'Consulta'),
        val(b.producto_objetivo, 'Otro'),
        val(b.modelo_detalle, null),
        val(b.que_busca, null),
        val(b.presupuesto_estimado !== undefined ? Number(b.presupuesto_estimado) : undefined, 0),
        val(b.moneda, 'USD'),
        val(b.forma_pago, 'Efectivo'),
        val(b.senia, 'No aplica'),
        val(b.monto_senia !== undefined ? Number(b.monto_senia) : undefined, 0),
        val(b.cliente_id !== undefined ? Number(b.cliente_id) : undefined, null),
        val(b.venta_id !== undefined ? Number(b.venta_id) : undefined, null),
        val(b.confirmado, 'Sin confirmar'),
        val(b.canal_contacto, 'WhatsApp'),
        val(b.ultimo_contacto, null),
        val(b.estado_recordatorio, 'Pendiente'),
        val(b.tipo, 'Consulta'),
        val(b.estado, 'Pendiente'),
        val(b.notas, null),
        b.notificar_whatsapp ? 1 : 0,
      ],
    });

    await tx.commit();tx.close();tx=undefined;
    const nuevo = await db.execute({
      sql: `SELECT t.*, u.nombre AS closer_nombre
            FROM turnos t LEFT JOIN users u ON u.id = t.closer_id
            WHERE t.id = ?`,
      args: [Number(result.lastInsertRowid)],
    });
    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    if(tx){await tx.rollback();tx.close();}
    if(err instanceof BusinessError){res.status(err.status).json({error:err.message});return;}
    console.error('POST /turnos error:', err);
    res.status(500).json({ error: 'Error al crear el turno' });
  }
});

// ------------------------------------------------------------
// PUT /:id — actualizar turno
// closer solo sus turnos, admin todos, oficina 403
// ------------------------------------------------------------
router.put('/:id', async (req: AuthRequest, res: Response) => {
  let tx:Awaited<ReturnType<typeof db.transaction>>|undefined;
  try {
    const user = req.user!;
    if (isReadOnly(user)) {
      res.status(403).json({ error: 'Oficina tiene acceso de solo lectura' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID de turno inválido' });
      return;
    }

    const actual = await db.execute({ sql: 'SELECT * FROM turnos WHERE id = ?', args: [id] });
    if (actual.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }
    const turno = actual.rows[0];

    if (user.rol === 'closer' && Number(turno.closer_id) !== user.id) {
      res.status(403).json({ error: 'Solo podés editar tus propios turnos' });
      return;
    }

    const b = req.body || {};

    // Validaciones de valores permitidos
    if (b.confirmado !== undefined && !['Confirmado', 'Sin confirmar'].includes(b.confirmado)) {
      res.status(400).json({ error: "El campo 'confirmado' debe ser 'Confirmado' o 'Sin confirmar'" });
      return;
    }
    if (b.estado !== undefined && !['Pendiente', 'Cumplido', 'Cancelado'].includes(b.estado)) {
      res.status(400).json({ error: "El campo 'estado' debe ser 'Pendiente', 'Cumplido' o 'Cancelado'" });
      return;
    }

    // Admin puede reasignar closer_id
    if (user.rol === 'admin' && b.closer_id !== undefined) {
      const existe = await db.execute({
        sql: 'SELECT id FROM users WHERE id = ?',
        args: [Number(b.closer_id)],
      });
      if (existe.rows.length === 0) {
        res.status(400).json({ error: 'El closer asignado no existe' });
        return;
      }
    }

    // Construcción dinámica del UPDATE con los campos presentes
    const sets: string[] = [];
    const args: Array<number | string | null> = [];

    for (const campo of CAMPOS_EDITABLES) {
      if (b[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        if (campo === 'presupuesto_estimado' || campo === 'monto_senia') {
          args.push(Number(b[campo]) || 0);
        } else if (campo === 'cliente_id' || campo === 'venta_id') {
          args.push(b[campo] === null ? null : Number(b[campo]));
        } else if (campo === 'notificar_whatsapp') {
          args.push(b[campo] ? 1 : 0);
        } else {
          args.push(b[campo]);
        }
      }
    }
    if (user.rol === 'admin' && b.closer_id !== undefined) {
      sets.push('closer_id = ?');
      args.push(Number(b.closer_id));
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'No se enviaron campos para actualizar' });
      return;
    }

    args.push(id);
    tx=await db.transaction('write');
    const current=(await tx.execute({sql:'SELECT * FROM turnos WHERE id=?',args:[id]})).rows[0];
    if(!current)throw new BusinessError('Turno no encontrado',404);
    if(user.rol==='closer'&&Number(current.closer_id)!==user.id)throw new BusinessError('Solo podés editar tus propios turnos',403);
    const owner=user.rol==='admin'&&b.closer_id!==undefined?Number(b.closer_id):Number(current.closer_id);
    const changed=b.fecha_hora!==undefined||owner!==Number(current.closer_id)||(b.estado==='Pendiente'&&current.estado==='Cancelado');
    let stamp:string|undefined;
    if(changed&&(b.estado??current.estado)!=='Cancelado')stamp=await checkSlot(owner,String(b.fecha_hora??current.fecha_hora),tx,id);
    await tx.execute({sql:`UPDATE turnos SET ${sets.join(', ')} WHERE id=?`,args});
    if(stamp)await tx.execute({sql:'UPDATE turnos SET fecha_hora=? WHERE id=?',args:[stamp,id]});
    if(changed||b.estado==='Cancelado')await tx.execute({sql:'DELETE FROM crm_appointment_slots WHERE turno_id=?',args:[id]});
    await tx.commit();tx.close();tx=undefined;

    const actualizado = await db.execute({
      sql: `SELECT t.*, u.nombre AS closer_nombre
            FROM turnos t LEFT JOIN users u ON u.id = t.closer_id
            WHERE t.id = ?`,
      args: [id],
    });
    res.json(actualizado.rows[0]);
  } catch (err) {
    if(tx){await tx.rollback();tx.close();}
    if(err instanceof BusinessError){res.status(err.status).json({error:err.message});return;}
    console.error('PUT /turnos/:id error:', err);
    res.status(500).json({ error: 'Error al actualizar el turno' });
  }
});

// ------------------------------------------------------------
// DELETE /:id — eliminar turno
// closer solo suyos, admin todos, oficina 403
// ------------------------------------------------------------
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isReadOnly(user)) {
      res.status(403).json({ error: 'Oficina tiene acceso de solo lectura' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'ID de turno inválido' });
      return;
    }

    const actual = await db.execute({ sql: 'SELECT closer_id FROM turnos WHERE id = ?', args: [id] });
    if (actual.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado' });
      return;
    }

    if (user.rol === 'closer' && Number(actual.rows[0].closer_id) !== user.id) {
      res.status(403).json({ error: 'Solo podés eliminar tus propios turnos' });
      return;
    }

    await db.batch([{sql:'DELETE FROM crm_appointment_slots WHERE turno_id=?',args:[id]},{sql:'DELETE FROM turnos WHERE id=?',args:[id]}],'write');
    res.json({ ok: true, mensaje: 'Turno eliminado correctamente' });
  } catch (err) {
    console.error('DELETE /turnos/:id error:', err);
    res.status(500).json({ error: 'Error al eliminar el turno' });
  }
});

export default router;
