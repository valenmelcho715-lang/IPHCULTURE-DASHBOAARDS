// ============================================================
// noticias.ts — Noticias del equipo (Backend_Extras)
// GET / todos los roles (join nombre autor) | POST/DELETE solo admin
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, isReadOnly, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// GET /api/noticias — todas, orden desc, con nombre del autor
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await db.execute({
      sql: `SELECT n.id, n.titulo, n.contenido, n.tipo, n.creado_por, n.created_at,
                   u.nombre AS autor_nombre
            FROM noticias n
            LEFT JOIN users u ON u.id = n.creado_por
            ORDER BY n.created_at DESC, n.id DESC`,
      args: [],
    });
    res.json(r.rows);
  } catch (err) {
    console.error('GET /noticias', err);
    res.status(500).json({ error: 'Error obteniendo noticias' });
  }
});

// POST /api/noticias — solo admin
router.post('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (isReadOnly(req.user)) {
      res.status(403).json({ error: 'Modo solo lectura' });
      return;
    }
    const { titulo, contenido, tipo } = req.body || {};
    if (!titulo || !contenido) {
      res.status(400).json({ error: 'titulo y contenido son requeridos' });
      return;
    }
    const r = await db.execute({
      sql: `INSERT INTO noticias (titulo, contenido, tipo, creado_por)
            VALUES (?, ?, ?, ?)`,
      args: [titulo, contenido, tipo || 'general', req.user!.id],
    });
    res.status(201).json({ id: Number(r.lastInsertRowid), ok: true });
  } catch (err) {
    console.error('POST /noticias', err);
    res.status(500).json({ error: 'Error creando noticia' });
  }
});

// DELETE /api/noticias/:id — solo admin
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (isReadOnly(req.user)) {
      res.status(403).json({ error: 'Modo solo lectura' });
      return;
    }
    await db.execute({
      sql: `DELETE FROM noticias WHERE id = ?`,
      args: [Number(req.params.id)],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /noticias/:id', err);
    res.status(500).json({ error: 'Error eliminando noticia' });
  }
});

export default router;
