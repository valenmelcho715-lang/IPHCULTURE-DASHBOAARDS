// ============================================================
// routes/auth.ts — Backend_Auth_Admin
// POST /login · GET /me · PUT /me/telefono
// ============================================================
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { authRequired, signToken, AuthRequest } from '../auth';

const router = Router();

interface UserRow {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'oficina' | 'closer';
  telefono: string | null;
  password_hash?: string;
}

function publicUser(u: UserRow) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, telefono: u.telefono };
}

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son obligatorios' });
      return;
    }
    const result = await db.execute({
      sql: 'SELECT id, nombre, email, rol, telefono, password_hash FROM users WHERE email = ?',
      args: [String(email).trim().toLowerCase()],
    });
    const user = result.rows[0] as unknown as UserRow | undefined;
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Email o contraseña incorrectos' });
      return;
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Email o contraseña incorrectos' });
      return;
    }
    const token = signToken({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

// GET /api/auth/me — usuario fresco desde la DB
router.get('/me', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, nombre, email, rol, telefono FROM users WHERE id = ?',
      args: [req.user!.id],
    });
    const user = result.rows[0] as unknown as UserRow | undefined;
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json(publicUser(user));
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/auth/me/telefono — actualiza el teléfono del usuario logueado
router.put('/me/telefono', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const { telefono } = req.body || {};
    if (typeof telefono !== 'string') {
      res.status(400).json({ error: 'Teléfono inválido' });
      return;
    }
    await db.execute({
      sql: 'UPDATE users SET telefono = ? WHERE id = ?',
      args: [telefono.trim() || null, req.user!.id],
    });
    const result = await db.execute({
      sql: 'SELECT id, nombre, email, rol, telefono FROM users WHERE id = ?',
      args: [req.user!.id],
    });
    const user = result.rows[0] as unknown as UserRow | undefined;
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    res.json(publicUser(user));
  } catch (err) {
    console.error('[auth/me/telefono]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
