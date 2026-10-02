// ============================================================
// leads.ts — Leads / prospectos (Backend_Extras)
// GET: admin/oficina todos; closer solo asignados a él
// POST: cualquier rol excepto oficina
// PUT: admin todo; closer solo estado/notas de leads asignados; oficina 403
// DELETE: solo admin
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, isReadOnly, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// GET /api/leads
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      r = await db.execute({
        sql: `SELECT l.*, u.nombre AS closer_nombre
              FROM leads l
              LEFT JOIN users u ON u.id = l.closer_asignado_id
              WHERE l.closer_asignado_id = ?
              ORDER BY l.created_at DESC, l.id DESC`,
        args: [user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT l.*, u.nombre AS closer_nombre
              FROM leads l
              LEFT JOIN users u ON u.id = l.closer_asignado_id
              ORDER BY l.created_at DESC, l.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /leads', err);
    res.status(500).json({ error: 'Error obteniendo leads' });
  }
});

// POST /api/leads — cualquier rol excepto oficina
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (isReadOnly(req.user)) {
      res.status(403).json({ error: 'Modo solo lectura: oficina no puede crear leads' });
      return;
    }
    const { nombre, telefono, instagram, email, fuente, estado, closer_asignado_id, notas, proximo_contacto } = req.body || {};
    if (!nombre) {
      res.status(400).json({ error: 'nombre es requerido' });
      return;
    }
    // Closer solo puede asignarse leads a sí mismo; admin puede asignar a cualquiera
    let asignado: number | null =
      closer_asignado_id === undefined || closer_asignado_id === null || closer_asignado_id === ''
        ? null
        : Number(closer_asignado_id);
    if (req.user!.rol === 'closer' && asignado !== null && asignado !== req.user!.id) {
      asignado = req.user!.id;
    }
    const r = await db.execute({
      sql: `INSERT INTO leads (nombre, telefono, instagram, email, fuente, estado, closer_asignado_id, notas, proximo_contacto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        nombre,
        telefono ?? null,
        instagram ?? null,
        email ?? null,
        fuente ?? null,
        estado || 'Nuevo',
        asignado,
        notas ?? null,
        proximo_contacto || null,
      ],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /leads', err);
    res.status(500).json({ error: 'Error creando lead' });
  }
});

// PUT /api/leads/:id — admin todo; closer solo estado/notas de leads asignados; oficina 403
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (isReadOnly(user)) {
      res.status(403).json({ error: 'Modo solo lectura: oficina no puede editar leads' });
      return;
    }
    const id = Number(req.params.id);
    const cur = await db.execute({
      sql: `SELECT * FROM leads WHERE id = ?`,
      args: [id],
    });
    if (cur.rows.length === 0) {
      res.status(404).json({ error: 'Lead no encontrado' });
      return;
    }
    const lead = cur.rows[0] as unknown as Record<string, unknown>;
    const body = req.body || {};

    if (user.rol === 'admin') {
      const nombre = body.nombre ?? lead.nombre;
      const telefono = body.telefono ?? lead.telefono;
      const instagram = body.instagram ?? lead.instagram;
      const email = body.email ?? lead.email;
      const fuente = body.fuente ?? lead.fuente;
      const estado = body.estado ?? lead.estado;
      const asignado =
        body.closer_asignado_id === undefined
          ? lead.closer_asignado_id
          : body.closer_asignado_id === null || body.closer_asignado_id === ''
            ? null
            : Number(body.closer_asignado_id);
      const notas = body.notas ?? lead.notas;
      const proximoContacto = body.proximo_contacto !== undefined ? body.proximo_contacto || null : lead.proximo_contacto;
      await db.execute({
        sql: `UPDATE leads SET nombre = ?, telefono = ?, instagram = ?, email = ?, fuente = ?,
              estado = ?, closer_asignado_id = ?, notas = ?, proximo_contacto = ? WHERE id = ?`,
        args: [nombre, telefono, instagram, email, fuente, estado, asignado, notas, proximoContacto, id],
      });
      res.json({ ok: true });
      return;
    }

    // closer: estado, notas y próximo contacto de leads asignados a él
    if (lead.closer_asignado_id !== user.id) {
      res.status(403).json({ error: 'Solo podés editar leads asignados a vos' });
      return;
    }
    const estado = body.estado ?? lead.estado;
    const notas = body.notas ?? lead.notas;
    const proximoContacto = body.proximo_contacto !== undefined ? body.proximo_contacto || null : lead.proximo_contacto;
    await db.execute({
      sql: `UPDATE leads SET estado = ?, notas = ?, proximo_contacto = ? WHERE id = ?`,
      args: [estado, notas, proximoContacto, id],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /leads/:id', err);
    res.status(500).json({ error: 'Error actualizando lead' });
  }
});

// DELETE /api/leads/:id — solo admin
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (isReadOnly(req.user)) {
      res.status(403).json({ error: 'Modo solo lectura' });
      return;
    }
    await db.execute({
      sql: `DELETE FROM leads WHERE id = ?`,
      args: [Number(req.params.id)],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /leads/:id', err);
    res.status(500).json({ error: 'Error eliminando lead' });
  }
});

export default router;
