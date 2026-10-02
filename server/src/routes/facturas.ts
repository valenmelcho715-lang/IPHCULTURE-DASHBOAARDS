// ============================================================
// facturas.ts — Comprobantes X (Backend_Ventas_Facturas)
//  - default router (autenticado): GET /api/facturas
//      closer → solo las suyas; admin/oficina → todas; join closer_nombre; orden desc
//  - publicRouter (SIN auth): GET /api/comprobante/:numero
//      factura + closer_nombre + venta asociada; 404 si no existe
// ============================================================
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authRequired, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// GET /api/facturas
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const baseSql = `
      SELECT f.*, u.nombre AS closer_nombre
      FROM facturas f
      LEFT JOIN users u ON u.id = f.closer_id
    `;
    const result =
      user.rol === 'closer'
        ? await db.execute({ sql: `${baseSql} WHERE f.closer_id = ? ORDER BY f.fecha DESC`, args: [user.id] })
        : await db.execute(`${baseSql} ORDER BY f.fecha DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('[facturas] GET / error', err);
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
});

// ---------- Router público: verificación de comprobante por número ----------
export const publicRouter = Router();

// GET /api/comprobante/:numero (SIN auth)
publicRouter.get('/:numero', async (req: Request, res: Response) => {
  try {
    const numero = String(req.params.numero || '').trim().toUpperCase();
    const result = await db.execute({
      sql: `
        SELECT f.*, u.nombre AS closer_nombre
        FROM facturas f
        LEFT JOIN users u ON u.id = f.closer_id
        WHERE UPPER(f.numero) = ?
      `,
      args: [numero],
    });
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Comprobante no encontrado' });
      return;
    }
    const factura = result.rows[0] as any;
    const venta = await db.execute({
      sql: 'SELECT metodo_pago FROM ventas WHERE id = ?',
      args: [factura.venta_id],
    });
    res.json({ factura, venta: venta.rows[0] ?? null });
  } catch (err) {
    console.error('[facturas] GET público /:numero error', err);
    res.status(500).json({ error: 'Error obteniendo comprobante' });
  }
});

export default router;
