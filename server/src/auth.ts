import crypto from 'node:crypto';
import { db } from './db';
// ============================================================
// auth.ts — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// JWT auth + middlewares de rol. Las rutas usan:
//   import { authRequired, requireRole, signToken, AuthRequest } from '../auth';
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Configurar JWT_SECRET de al menos 32 caracteres');

export interface JwtUser {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'oficina' | 'closer';
}

export interface AuthRequest extends Request {
  user?: JwtUser;
}

export const META_REVIEWER_EMAIL = 'meta-review@iphoneculture.com';

export function signToken(user: JwtUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export async function authRequired(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }
  try {
    const claimed = jwt.verify(token, JWT_SECRET) as JwtUser;
    const row = (await db.execute({sql: 'SELECT id,nombre,email,rol FROM users WHERE id=?',args:[claimed.id]})).rows[0];
    if (!row) { res.status(401).json({error:'Usuario no disponible'}); return; }
    req.user = row as unknown as JwtUser;
    if (req.user.email === META_REVIEWER_EMAIL) {
      const allowed = req.originalUrl === '/api/auth/me'
        || req.originalUrl.startsWith('/api/admin/meta-onboarding/instagram');
      if (!allowed) {
        res.status(403).json({ error: 'La cuenta de revisión solo puede acceder a la conexión de Instagram' });
        return;
      }
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(...roles: Array<'admin' | 'oficina' | 'closer'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'Sin permisos para esta acción' });
      return;
    }
    next();
  };
}

// Helper: oficina es solo-lectura. Úsalo en mutaciones: if (readOnly(req.user)) return 403
export function isReadOnly(user?: JwtUser): boolean {
  return user?.rol === 'oficina';
}
