// ============================================================
// catalogo.ts — Catálogo de productos (solo lectura para todos los roles)
// GET / ?categoria=&destacado=1
// Incluye precio_promo_contado_usd:
//   SIEMPRE = precio_contado_usd (el contado ES la promo — el precio más barato)
//   Regla del dueño: el precio promo contado SIEMPRE es el más barato.
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, AuthRequest } from '../auth';

const router = Router();

router.get('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const { categoria, destacado } = req.query;

    const where: string[] = [];
    const args: Array<string | number> = [];

    if (typeof categoria === 'string' && categoria.trim() !== '') {
      where.push('categoria = ?');
      args.push(categoria.trim());
    }
    if (destacado === '1') {
      where.push('destacado = 1');
    }

    const sql =
      'SELECT * FROM catalogo' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY destacado DESC, categoria ASC, precio_contado_usd ASC';

    const result = await db.execute({ sql, args });

    const items = result.rows.map((row) => {
      // REGLA (dueño): la promo contado SIEMPRE es el precio más barato.
      // El contado ES la promo: precio_promo_contado_usd = precio_contado_usd.
      const contado = Number(row.precio_contado_usd ?? 0);
      const precio_promo_contado_usd = contado;
      return { ...row, precio_promo_contado_usd };
    });

    res.json(items);
  } catch (err) {
    console.error('Error GET /catalogo:', err);
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
});

export default router;
