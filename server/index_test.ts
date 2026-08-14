import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'iphone-culture-secret-2026';

app.use(cors());
app.use(express.json());

// ===== AUTH MIDDLEWARE =====
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req: any, res: any, next: any) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
};
app.listen(PORT, () => { console.log(`OK`); });
