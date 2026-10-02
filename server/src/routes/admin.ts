// ============================================================
// routes/admin.ts — Backend_Auth_Admin
// GET /stats (admin/oficina) · GET /closers (admin/oficina)
// GET /metricas?closer_id= (admin/oficina cualquiera; closer solo el propio)
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';

const router = Router();

// GET /api/admin/stats — panel global (admin/oficina)
router.get('/stats', authRequired, requireRole('admin', 'oficina'), async (req: AuthRequest, res: Response) => {
  try {
    const ventasMes = await db.execute(`
      SELECT COALESCE(SUM(precio_venta_usd), 0) AS total_usd,
             COUNT(*) AS cantidad,
             COALESCE(SUM(ganancia_usd), 0) AS ganancia_usd,
             COALESCE(SUM(comision_usd), 0) AS comisiones_usd
      FROM ventas
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `);
    const vm = ventasMes.rows[0] as any;

    const turnosHoy = await db.execute(`
      SELECT COUNT(*) AS c FROM turnos
      WHERE date(replace(fecha_hora, 'T', ' ')) = date('now', 'localtime')
    `);

    const leadsNuevos = await db.execute(`
      SELECT COUNT(*) AS c FROM leads WHERE estado = 'Nuevo'
    `);

    const stockBajo = await db.execute(`
      SELECT COUNT(*) AS c FROM stock WHERE cantidad <= 1
    `);

    const topClosers = await db.execute(`
      SELECT u.id, u.nombre,
             COALESCE(SUM(v.precio_venta_usd), 0) AS total_usd,
             COUNT(v.id) AS ventas
      FROM users u
      JOIN ventas v ON v.closer_id = u.id
      WHERE u.rol = 'closer'
        AND strftime('%Y-%m', v.created_at) = strftime('%Y-%m', 'now')
      GROUP BY u.id, u.nombre
      ORDER BY total_usd DESC
      LIMIT 5
    `);

    const totalHistorico = await db.execute(`
      SELECT COALESCE(SUM(precio_venta_usd), 0) AS total_usd, COUNT(*) AS cantidad FROM ventas
    `);
    const th = totalHistorico.rows[0] as any;

    res.json({
      ventas_mes_total_usd: Number(vm.total_usd),
      ventas_mes_cantidad: Number(vm.cantidad),
      ventas_mes: Number(vm.cantidad),
      total_vendido_usd: Number(th.total_usd),
      total_ventas: Number(th.cantidad),
      ...(req.user!.rol==='admin'?{ganancia_mes_usd:Number(vm.ganancia_usd)}:{}),
      comisiones_mes_usd: Number(vm.comisiones_usd),
      turnos_hoy: Number((turnosHoy.rows[0] as any).c),
      leads_nuevos: Number((leadsNuevos.rows[0] as any).c),
      stock_bajo: Number((stockBajo.rows[0] as any).c),
      top_closers: topClosers.rows.map((r: any) => ({
        id: Number(r.id),
        nombre: r.nombre,
        total_usd: Number(r.total_usd),
        ventas: Number(r.ventas),
      })),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/admin/closers — lista de usuarios con rol closer (admin/oficina)
router.get('/closers', authRequired, requireRole('admin', 'oficina'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute(`
      SELECT id, nombre, email, rol, telefono, created_at
      FROM users
      WHERE rol = 'closer'
      ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/closers]', err);
    res.status(500).json({ error: 'Error al obtener vendedores' });
  }
});

// GET /api/admin/metricas?closer_id= — métricas de un closer
// admin/oficina: cualquier closer_id · closer: solo su propio id (si pide otro → 403)
router.get('/metricas', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let closerId = Number(req.query.closer_id);

    if (user.rol === 'closer') {
      if (!closerId) closerId = user.id;
      if (closerId !== user.id) {
        res.status(403).json({ error: 'Solo podés ver tus propias métricas' });
        return;
      }
    } else if (user.rol === 'admin' || user.rol === 'oficina') {
      if (!closerId) {
        res.status(400).json({ error: 'Falta el parámetro closer_id' });
        return;
      }
    } else {
      res.status(403).json({ error: 'Sin permisos para esta acción' });
      return;
    }

    // Ventas por mes (últimos 6 meses)
    const ventasPorMes = await db.execute({
      sql: `
        SELECT strftime('%Y-%m', created_at) AS mes,
               COALESCE(SUM(precio_venta_usd), 0) AS total_usd,
               COUNT(*) AS cantidad
        FROM ventas
        WHERE closer_id = ?
          AND created_at >= date('now', 'start of month', '-5 months')
        GROUP BY mes
        ORDER BY mes ASC
      `,
      args: [closerId],
    });

    // Totales históricos
    const totales = await db.execute({
      sql: `
        SELECT COALESCE(SUM(precio_venta_usd), 0) AS total_vendido_usd,
               COALESCE(SUM(comision_usd), 0) AS comisiones_total_usd
        FROM ventas
        WHERE closer_id = ?
      `,
      args: [closerId],
    });
    const t = totales.rows[0] as any;

    // Canjes
    const canjes = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM canjes WHERE closer_id = ?',
      args: [closerId],
    });

    // Turnos por estado
    const turnos = await db.execute({
      sql: `
        SELECT
          SUM(CASE WHEN LOWER(estado) = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN LOWER(estado) = 'confirmado' THEN 1 ELSE 0 END) AS confirmados,
          SUM(CASE WHEN LOWER(estado) = 'cumplido' THEN 1 ELSE 0 END) AS cumplidos
        FROM turnos
        WHERE closer_id = ?
      `,
      args: [closerId],
    });
    const tu = turnos.rows[0] as any;

    // Bonos pendientes de pago
    const bonos = await db.execute({
      sql: 'SELECT COALESCE(SUM(monto_usd), 0) AS pendiente FROM bonos WHERE closer_id = ? AND pagado = 0',
      args: [closerId],
    });

    res.json({
      ventas_por_mes: ventasPorMes.rows.map((r: any) => ({
        mes: r.mes,
        total_usd: Number(r.total_usd),
        cantidad: Number(r.cantidad),
      })),
      total_vendido_usd: Number(t.total_vendido_usd),
      comisiones_total_usd: Number(t.comisiones_total_usd),
      canjes_cantidad: Number((canjes.rows[0] as any).c),
      turnos: {
        pendientes: Number(tu?.pendientes ?? 0),
        confirmados: Number(tu?.confirmados ?? 0),
        cumplidos: Number(tu?.cumplidos ?? 0),
      },
      bonos_pendientes_usd: Number((bonos.rows[0] as any).pendiente),
    });
  } catch (err) {
    console.error('[admin/metricas]', err);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

export default router;
