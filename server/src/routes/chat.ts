// ============================================================
// chat.ts — Chat interno (canal general "Equipo" + DMs 1-a-1)
// Todos los roles pueden chatear. authRequired para todo.
// - GET /usuarios   → lista de usuarios para la lista de conversaciones
// - GET /general    → últimos 100 mensajes del canal general (ascendente)
// - GET /dm/:otroId → últimos 100 mensajes entre yo y :otroId (ascendente)
// - POST /          → {para_id|null, texto} (texto 1..2000 chars)
// - POST /leer      → {conversacion: 'general'|'dm:X'} marca como leído
// - GET /unread     → {general: N, dms: {"2": N, ...}}
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

const MAX_TEXTO = 2000;

// GET /api/chat/usuarios — todos los usuarios (id, nombre, rol)
router.get('/usuarios', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await db.execute({
      sql: `SELECT id, nombre, rol FROM users ORDER BY id`,
      args: [],
    });
    res.json(r.rows);
  } catch (err) {
    console.error('GET /chat/usuarios', err);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// GET /api/chat/general — últimos 100 del canal general, ascendente para mostrar
router.get('/general', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await db.execute({
      sql: `SELECT m.*, u.nombre AS de_nombre
            FROM chat_mensajes m LEFT JOIN users u ON u.id = m.de_id
            WHERE m.para_id IS NULL
            ORDER BY m.id DESC LIMIT 100`,
      args: [],
    });
    res.json([...r.rows].reverse());
  } catch (err) {
    console.error('GET /chat/general', err);
    res.status(500).json({ error: 'Error obteniendo mensajes del canal' });
  }
});

// GET /api/chat/dm/:otroId — últimos 100 entre yo y :otroId, ascendente
router.get('/dm/:otroId', async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id;
    const otro = Number(req.params.otroId);
    if (!Number.isInteger(otro) || otro <= 0) {
      res.status(400).json({ error: 'otroId inválido' });
      return;
    }
    const r = await db.execute({
      sql: `SELECT m.*, u.nombre AS de_nombre
            FROM chat_mensajes m LEFT JOIN users u ON u.id = m.de_id
            WHERE (m.de_id = ? AND m.para_id = ?) OR (m.de_id = ? AND m.para_id = ?)
            ORDER BY m.id DESC LIMIT 100`,
      args: [me, otro, otro, me],
    });
    res.json([...r.rows].reverse());
  } catch (err) {
    console.error('GET /chat/dm/:otroId', err);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
});

// POST /api/chat — {para_id: number|null, texto: string}
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id;
    const { para_id, texto } = req.body || {};
    const t = typeof texto === 'string' ? texto.trim() : '';
    if (!t) {
      res.status(400).json({ error: 'texto es requerido' });
      return;
    }
    if (t.length > MAX_TEXTO) {
      res.status(400).json({ error: `texto supera el máximo de ${MAX_TEXTO} caracteres` });
      return;
    }
    let destino: number | null = null;
    if (para_id !== null && para_id !== undefined && para_id !== '') {
      destino = Number(para_id);
      if (!Number.isInteger(destino) || destino <= 0) {
        res.status(400).json({ error: 'para_id inválido' });
        return;
      }
      if (destino === me) {
        res.status(400).json({ error: 'No podés enviarte mensajes a vos mismo' });
        return;
      }
      const u = await db.execute({ sql: `SELECT id FROM users WHERE id = ?`, args: [destino] });
      if (u.rows.length === 0) {
        res.status(400).json({ error: 'El destinatario no existe' });
        return;
      }
    }
    const r = await db.execute({
      sql: `INSERT INTO chat_mensajes (de_id, para_id, texto) VALUES (?, ?, ?)`,
      args: [me, destino, t],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /chat', err);
    res.status(500).json({ error: 'Error enviando mensaje' });
  }
});

// POST /api/chat/leer — {conversacion: 'general' | 'dm:<id>'}
router.post('/leer', async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id;
    const { conversacion } = req.body || {};
    if (typeof conversacion !== 'string' || !conversacion) {
      res.status(400).json({ error: 'conversacion es requerida' });
      return;
    }
    let maxId = 0;
    if (conversacion === 'general') {
      const r = await db.execute({
        sql: `SELECT COALESCE(MAX(id), 0) AS max_id FROM chat_mensajes WHERE para_id IS NULL`,
        args: [],
      });
      maxId = Number((r.rows[0] as unknown as { max_id: number }).max_id);
    } else if (conversacion.startsWith('dm:')) {
      const otro = Number(conversacion.slice(3));
      if (!Number.isInteger(otro) || otro <= 0) {
        res.status(400).json({ error: 'conversacion inválida' });
        return;
      }
      const r = await db.execute({
        sql: `SELECT COALESCE(MAX(id), 0) AS max_id FROM chat_mensajes
              WHERE (de_id = ? AND para_id = ?) OR (de_id = ? AND para_id = ?)`,
        args: [me, otro, otro, me],
      });
      maxId = Number((r.rows[0] as unknown as { max_id: number }).max_id);
    } else {
      res.status(400).json({ error: 'conversacion inválida' });
      return;
    }
    await db.execute({
      sql: `INSERT INTO chat_lecturas (user_id, conversacion, ultimo_leido_id)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, conversacion) DO UPDATE SET ultimo_leido_id = excluded.ultimo_leido_id`,
      args: [me, conversacion, maxId],
    });
    res.json({ ok: true, ultimo_leido_id: maxId });
  } catch (err) {
    console.error('POST /chat/leer', err);
    res.status(500).json({ error: 'Error marcando como leído' });
  }
});

// GET /api/chat/unread — {general: N, dms: {"2": N, ...}}
router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!.id;
    // General
    const g = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM chat_mensajes m
            WHERE m.para_id IS NULL
              AND m.id > COALESCE(
                (SELECT ultimo_leido_id FROM chat_lecturas WHERE user_id = ? AND conversacion = 'general'), 0)`,
      args: [me],
    });
    const general = Number((g.rows[0] as unknown as { c: number }).c);
    // DMs que me llegaron, agrupados por remitente (los nunca abiertos cuentan en su totalidad)
    const d = await db.execute({
      sql: `SELECT m.de_id, COUNT(*) AS c FROM chat_mensajes m
            WHERE m.para_id = ?
              AND m.id > COALESCE(
                (SELECT ultimo_leido_id FROM chat_lecturas
                 WHERE user_id = ? AND conversacion = 'dm:' || m.de_id), 0)
            GROUP BY m.de_id`,
      args: [me, me],
    });
    const dms: Record<string, number> = {};
    for (const row of d.rows) {
      const r = row as unknown as { de_id: number; c: number };
      dms[String(r.de_id)] = Number(r.c);
    }
    res.json({ general, dms });
  } catch (err) {
    console.error('GET /chat/unread', err);
    res.status(500).json({ error: 'Error obteniendo no leídos' });
  }
});

export default router;
