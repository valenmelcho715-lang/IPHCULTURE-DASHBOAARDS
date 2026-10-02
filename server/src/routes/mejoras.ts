// ============================================================
// routes/mejoras.ts — Funciones nuevas (27/9/2026)
// GET  /api/reportes/resumen  (admin/oficina) — estadísticas del negocio
// GET  /api/metas             (todos) — metas del mes con progreso
// PUT  /api/metas             (admin) — definir/actualizar meta de un usuario
// GET  /api/actividad         (admin/oficina) — auditoría de movimientos
// GET  /api/backup            (admin) — descarga la base de datos completa
// Exporta logActividad() para registrar movimientos desde otros routers.
// ============================================================
import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';

const router = Router();
router.use(authRequired);

// ---------- Helper de auditoría (usado por middleware global en index.ts) ----------
export async function logActividad(
  userId: number | null,
  userNombre: string | null,
  accion: string,
  detalle: string
): Promise<void> {
  try {
    await db.execute({
      sql: 'INSERT INTO actividad (user_id, user_nombre, accion, detalle) VALUES (?,?,?,?)',
      args: [userId, userNombre, accion, detalle.slice(0, 300)],
    });
  } catch (err) {
    console.error('[actividad] no se pudo registrar', err);
  }
}

// ---------- Ruta real del archivo de base de datos ----------
function dbFilePath(): string {
  const url = process.env.TURSO_DATABASE_URL || 'file:./iphone-culture.db';
  if (!url.startsWith('file:')) return '';
  return path.resolve(process.cwd(), url.slice(5));
}

// ============================================================
// GET /api/reportes/resumen — estadísticas generales (admin/oficina)
// ============================================================
router.get('/reportes/resumen', requireRole('admin', 'oficina'), async (req: AuthRequest, res: Response) => {
  try {
    const ventasPorVendedor = await db.execute(`
      SELECT u.nombre, COALESCE(SUM(v.precio_venta_usd),0) AS total_usd, COUNT(v.id) AS cantidad
      FROM users u
      LEFT JOIN ventas v ON v.closer_id = u.id AND strftime('%Y-%m', v.created_at) = strftime('%Y-%m','now','localtime')
      WHERE u.rol IN ('closer','oficina','admin')
      GROUP BY u.id, u.nombre
      HAVING cantidad > 0
      ORDER BY total_usd DESC
    `);

    const ventasPorDia = await db.execute(`
      SELECT date(created_at) AS dia,
             COALESCE(SUM(precio_venta_usd),0) AS total_usd,
             COUNT(*) AS cantidad
      FROM ventas
      WHERE created_at >= date('now','-29 days')
      GROUP BY dia
      ORDER BY dia ASC
    `);

    const leadsPorEstado = await db.execute(`
      SELECT COALESCE(estado,'Nuevo') AS estado, COUNT(*) AS cantidad
      FROM leads GROUP BY estado
    `);

    const leadsPorFuente = await db.execute(`
      SELECT COALESCE(fuente,'Otro') AS fuente, COUNT(*) AS cantidad
      FROM leads GROUP BY fuente ORDER BY cantidad DESC
    `);

    const topProductos = await db.execute(`
      SELECT COALESCE(producto,'Sin nombre') AS producto, COUNT(*) AS cantidad,
             COALESCE(SUM(precio_venta_usd),0) AS total_usd
      FROM ventas
      GROUP BY producto
      ORDER BY cantidad DESC
      LIMIT 10
    `);

    const ticket = await db.execute(`
      SELECT COALESCE(AVG(precio_venta_usd),0) AS ticket_promedio,
             COALESCE(SUM(precio_venta_usd),0) AS total_usd,
             COUNT(*) AS cantidad,
             COALESCE(SUM(ganancia_usd),0) AS ganancia_usd
      FROM ventas
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now','localtime')
    `);
    const t = ticket.rows[0] as any;

    const conversion = await db.execute(`
      SELECT
        SUM(CASE WHEN o.status = 'won' THEN 1 ELSE 0 END) AS ganados,
        COUNT(*) AS total
      FROM crm_opportunities o JOIN crm_conversations c ON c.id=o.conversation_id WHERE c.sandbox=0
    `);
    const c = conversion.rows[0] as any;

    const cobrosPendientes = await db.execute(`
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(falta_pagar_usd),0) AS total_usd
      FROM ventas
      WHERE pago_completo = 0 AND falta_pagar_usd > 0
    `);
    const cp = cobrosPendientes.rows[0] as any;

    res.json({
      ventas_por_vendedor: ventasPorVendedor.rows.map((r: any) => ({
        nombre: r.nombre,
        total_usd: Number(r.total_usd),
        cantidad: Number(r.cantidad),
      })),
      ventas_por_dia: ventasPorDia.rows.map((r: any) => ({
        dia: r.dia,
        total_usd: Number(r.total_usd),
        cantidad: Number(r.cantidad),
      })),
      leads_por_estado: leadsPorEstado.rows.map((r: any) => ({ estado: r.estado, cantidad: Number(r.cantidad) })),
      leads_por_fuente: leadsPorFuente.rows.map((r: any) => ({ fuente: r.fuente, cantidad: Number(r.cantidad) })),
      top_productos: topProductos.rows.map((r: any) => ({
        producto: r.producto,
        cantidad: Number(r.cantidad),
        total_usd: Number(r.total_usd),
      })),
      mes_actual: {
        ticket_promedio_usd: Number(t.ticket_promedio),
        total_usd: Number(t.total_usd),
        cantidad: Number(t.cantidad),
        ...(req.user!.rol==='admin'?{ganancia_usd:Number(t.ganancia_usd)}:{}),
      },
      conversion_leads: {
        ganados: Number(c?.ganados ?? 0),
        total: Number(c?.total ?? 0),
        pct: Number(c?.total) > 0 ? Math.round((Number(c.ganados) / Number(c.total)) * 100) : 0,
      },
      cobros_pendientes: { cantidad: Number(cp.cantidad), total_usd: Number(cp.total_usd) },
    });
  } catch (err) {
    console.error('[reportes/resumen]', err);
    res.status(500).json({ error: 'Error generando reporte' });
  }
});

// ============================================================
// METAS mensuales
// ============================================================

// GET /api/metas?mes=YYYY-MM — closer: solo la suya; admin/oficina: todas
router.get('/metas', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes)
      ? req.query.mes
      : new Date().toISOString().slice(0, 7);

    let sql: string;
    let args: Array<string | number>;
    if (user.rol === 'closer') {
      sql = `
        SELECT u.id AS user_id, u.nombre, m.monto_usd,
          (SELECT COALESCE(SUM(v.precio_venta_usd),0) FROM ventas v
            WHERE v.closer_id = u.id AND strftime('%Y-%m', v.created_at) = ?) AS vendido_usd
        FROM users u
        LEFT JOIN metas m ON m.user_id = u.id AND m.mes = ?
        WHERE u.id = ?
      `;
      args = [mes, mes, user.id];
    } else {
      sql = `
        SELECT u.id AS user_id, u.nombre, u.rol, m.monto_usd,
          (SELECT COALESCE(SUM(v.precio_venta_usd),0) FROM ventas v
            WHERE v.closer_id = u.id AND strftime('%Y-%m', v.created_at) = ?) AS vendido_usd
        FROM users u
        LEFT JOIN metas m ON m.user_id = u.id AND m.mes = ?
        ORDER BY vendido_usd DESC
      `;
      args = [mes, mes];
    }
    const r = await db.execute({ sql, args });
    res.json({
      mes,
      metas: r.rows.map((x: any) => ({
        user_id: Number(x.user_id),
        nombre: x.nombre,
        rol: x.rol ?? null,
        monto_usd: x.monto_usd !== null && x.monto_usd !== undefined ? Number(x.monto_usd) : null,
        vendido_usd: Number(x.vendido_usd),
        cumplida: x.monto_usd !== null && Number(x.monto_usd) > 0 && Number(x.vendido_usd) >= Number(x.monto_usd),
      })),
    });
  } catch (err) {
    console.error('[metas GET]', err);
    res.status(500).json({ error: 'Error obteniendo metas' });
  }
});

// PUT /api/metas — admin define meta: { user_id, mes?, monto_usd }
router.put('/metas', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, mes, monto_usd } = req.body || {};
    const uid = Number(user_id);
    const monto = Number(monto_usd);
    const mesVal = typeof mes === 'string' && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
    if (!uid || Number.isNaN(monto) || monto < 0) {
      res.status(400).json({ error: 'user_id y monto_usd (>= 0) son requeridos' });
      return;
    }
    if (monto === 0) {
      await db.execute({ sql: 'DELETE FROM metas WHERE user_id = ? AND mes = ?', args: [uid, mesVal] });
    } else {
      await db.execute({
        sql: `INSERT INTO metas (user_id, mes, monto_usd) VALUES (?,?,?)
              ON CONFLICT(user_id, mes) DO UPDATE SET monto_usd = excluded.monto_usd`,
        args: [uid, mesVal, monto],
      });
    }
    await logActividad(req.user!.id, req.user!.nombre, 'Meta actualizada', `Usuario #${uid} · ${mesVal} · USD ${monto}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[metas PUT]', err);
    res.status(500).json({ error: 'Error guardando meta' });
  }
});

// ============================================================
// GET /api/actividad?limit=100 — auditoría (admin/oficina)
// ============================================================
router.get('/actividad', requireRole('admin', 'oficina'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const r = await db.execute({
      sql: 'SELECT * FROM actividad ORDER BY id DESC LIMIT ?',
      args: [limit],
    });
    res.json(r.rows);
  } catch (err) {
    console.error('[actividad GET]', err);
    res.status(500).json({ error: 'Error obteniendo actividad' });
  }
});

// ============================================================
// GET /api/backup — descarga la base de datos (solo admin)
// ============================================================
router.get('/backup', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const dbPath = dbFilePath();
    if (!dbPath || !fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Archivo de base de datos no encontrado' });
      return;
    }
    // Checkpoint WAL para que el archivo descargado esté completo y consistente
    try {
      await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      // si no está en WAL no hace falta
    }
    const fecha = new Date().toISOString().slice(0, 10);
    res.download(dbPath, `iphone-culture-backup-${fecha}.db`);
  } catch (err) {
    console.error('[backup]', err);
    res.status(500).json({ error: 'Error generando backup' });
  }
});

export default router;
