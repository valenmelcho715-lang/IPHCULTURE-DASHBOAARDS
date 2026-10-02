// ============================================================
// mensajes.ts — Mensajería interna (Backend_Extras)
// GET: closer ve los suyos + broadcast (closer_id NULL); admin/oficina ven todos
// POST: admin → cualquiera/broadcast; oficina → closer o broadcast;
//       closer → SOLO a Oficina (para_oficina: true o closer_id = id de oficina)
// PUT /:id/leido: el destinatario (cualquier rol); broadcast → solo closers
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// GET /api/mensajes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let r;
    if (user.rol === 'closer') {
      // Broadcasts (closer_id NULL): el flag leido es POR USUARIO via mensajes_lecturas
      r = await db.execute({
        sql: `SELECT m.id, m.closer_id, m.titulo, m.contenido,
                     CASE WHEN m.closer_id IS NULL THEN COALESCE(ml.user_id IS NOT NULL, 0) ELSE m.leido END AS leido,
                     m.creado_por, m.created_at,
                     uc.nombre AS closer_nombre, ua.nombre AS autor_nombre
              FROM mensajes m
              LEFT JOIN users uc ON uc.id = m.closer_id
              LEFT JOIN users ua ON ua.id = m.creado_por
              LEFT JOIN mensajes_lecturas ml ON ml.mensaje_id = m.id AND ml.user_id = ?
              WHERE m.closer_id = ? OR m.closer_id IS NULL
              ORDER BY m.created_at DESC, m.id DESC`,
        args: [user.id, user.id],
      });
    } else {
      r = await db.execute({
        sql: `SELECT m.id, m.closer_id, m.titulo, m.contenido, m.leido, m.creado_por, m.created_at,
                     uc.nombre AS closer_nombre, ua.nombre AS autor_nombre
              FROM mensajes m
              LEFT JOIN users uc ON uc.id = m.closer_id
              LEFT JOIN users ua ON ua.id = m.creado_por
              ORDER BY m.created_at DESC, m.id DESC`,
        args: [],
      });
    }
    res.json(r.rows);
  } catch (err) {
    console.error('GET /mensajes', err);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
});

// POST /api/mensajes — admin/oficina/closer con validación por rol.
// body: { closer_id?, titulo?, contenido, para_oficina? }
router.post('/', requireRole('admin', 'oficina', 'closer'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { closer_id, titulo, contenido, para_oficina } = req.body || {};
    if (!contenido) {
      res.status(400).json({ error: 'contenido es requerido' });
      return;
    }
    const tituloFinal = (titulo ?? '').toString().trim() || (user.rol === 'closer' ? 'Respuesta a Oficina' : 'Mensaje');
    let destino = closer_id === undefined || closer_id === null || closer_id === '' ? null : Number(closer_id);

    if (user.rol === 'closer') {
      // El closer solo puede responder a Oficina
      const of = await db.execute({ sql: `SELECT id FROM users WHERE rol = 'oficina' ORDER BY id LIMIT 1`, args: [] });
      if (of.rows.length === 0) {
        res.status(400).json({ error: 'No hay ningún usuario de Oficina registrado' });
        return;
      }
      const oficinaId = Number((of.rows[0] as unknown as { id: number }).id);
      if (para_oficina === true || destino === oficinaId) {
        destino = oficinaId;
      } else {
        res.status(403).json({ error: 'Los closers solo pueden enviar mensajes a Oficina' });
        return;
      }
    } else if (user.rol === 'oficina') {
      // Oficina: a un closer o broadcast (null)
      if (destino !== null) {
        const c = await db.execute({ sql: `SELECT id, rol FROM users WHERE id = ?`, args: [destino] });
        if (c.rows.length === 0 || (c.rows[0] as unknown as { rol: string }).rol !== 'closer') {
          res.status(400).json({ error: 'Oficina solo puede enviar a un closer o a todos (broadcast)' });
          return;
        }
      }
    } else {
      // admin: destino debe existir
      if (destino !== null) {
        const c = await db.execute({ sql: `SELECT id FROM users WHERE id = ?`, args: [destino] });
        if (c.rows.length === 0) {
          res.status(400).json({ error: 'El destinatario no existe' });
          return;
        }
      }
    }
    const r = await db.execute({
      sql: `INSERT INTO mensajes (closer_id, titulo, contenido, creado_por)
            VALUES (?, ?, ?, ?)`,
      args: [destino, tituloFinal, contenido, user.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /mensajes', err);
    res.status(500).json({ error: 'Error creando mensaje' });
  }
});

// PUT /api/mensajes/:id/leido — el destinatario directo (cualquier rol); broadcast → solo closers
router.put('/:id/leido', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = Number(req.params.id);
    const m = await db.execute({
      sql: `SELECT id, closer_id FROM mensajes WHERE id = ?`,
      args: [id],
    });
    if (m.rows.length === 0) {
      res.status(404).json({ error: 'Mensaje no encontrado' });
      return;
    }
    const msg = m.rows[0] as unknown as { id: number; closer_id: number | null };
    // Broadcast: cualquier closer puede marcarlo; directo: solo el destinatario
    if (msg.closer_id !== null && msg.closer_id !== user.id) {
      res.status(403).json({ error: 'Solo el closer destinatario puede marcarlo como leído' });
      return;
    }
    if (msg.closer_id === null && user.rol !== 'closer') {
      res.status(403).json({ error: 'Solo los closers marcan mensajes como leídos' });
      return;
    }
    await db.execute(
      msg.closer_id === null
        ? { sql: `INSERT INTO mensajes_lecturas (mensaje_id, user_id) VALUES (?, ?) ON CONFLICT(mensaje_id, user_id) DO NOTHING`, args: [id, user.id] }
        : { sql: `UPDATE mensajes SET leido = 1 WHERE id = ?`, args: [id] }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /mensajes/:id/leido', err);
    res.status(500).json({ error: 'Error marcando mensaje' });
  }
});

export default router;
