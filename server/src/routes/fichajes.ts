// ============================================================
// fichajes.ts — Fichaje de entrada/salida (oficina/admin)
// POST /api/fichajes/marcar {tipo: 'entrada'|'salida'} (oficina/admin)
//   → no permite dos marcas idénticas consecutivas
// GET /api/fichajes → todos los fichajes con nombre (admin/oficina; closer 403)
// GET /api/fichajes/estado → última marca del usuario actual
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// GET /api/fichajes/estado — última marca del usuario actual (para estado del botón)
router.get('/estado', async (req: AuthRequest, res: Response) => {
  try {
    const r = await db.execute({
      sql: `SELECT id, tipo, created_at FROM fichajes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      args: [req.user!.id],
    });
    res.json({ ultimo: r.rows[0] ?? null });
  } catch (err) {
    console.error('[fichajes] GET /estado', err);
    res.status(500).json({ error: 'Error obteniendo estado de fichaje' });
  }
});

// GET /api/fichajes — admin/oficina ven todos con nombre de usuario
router.get('/', requireRole('admin', 'oficina'), async (_req: AuthRequest, res: Response) => {
  try {
    const r = await db.execute(
      `SELECT f.id, f.user_id, f.tipo, f.created_at, u.nombre AS user_nombre
       FROM fichajes f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC, f.id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[fichajes] GET /', err);
    res.status(500).json({ error: 'Error obteniendo fichajes' });
  }
});

// POST /api/fichajes/marcar — oficina/admin. tipo: 'entrada' | 'salida'.
router.post('/marcar', requireRole('oficina', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tipo = String(req.body?.tipo ?? '').toLowerCase();
    if (tipo !== 'entrada' && tipo !== 'salida') {
      res.status(400).json({ error: "tipo debe ser 'entrada' o 'salida'" });
      return;
    }
    const ultimo = await db.execute({
      sql: `SELECT tipo FROM fichajes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      args: [req.user!.id],
    });
    if (ultimo.rows.length > 0 && (ultimo.rows[0] as unknown as { tipo: string }).tipo === tipo) {
      res.status(400).json({ error: tipo === 'entrada' ? 'Ya fichaste la entrada' : 'Ya fichaste la salida' });
      return;
    }
    const r = await db.execute({
      sql: `INSERT INTO fichajes (user_id, tipo) VALUES (?, ?)`,
      args: [req.user!.id, tipo],
    });
    const row = await db.execute({ sql: `SELECT * FROM fichajes WHERE id = ?`, args: [Number(r.lastInsertRowid)] });
    res.status(201).json(row.rows[0]);
  } catch (err) {
    console.error('[fichajes] POST /marcar', err);
    res.status(500).json({ error: 'Error registrando fichaje' });
  }
});

export default router;
