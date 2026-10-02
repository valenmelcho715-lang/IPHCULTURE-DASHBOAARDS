// ============================================================
// cuotero.ts — Calculadora de cuotas (SPEC sección 7, fórmula oficial PDF)
// GET  /fees      → planes de cuotas_fees
// POST /calcular  → { precio_usd, tipo_cambio, plan }
//   precio_ars       = precio_usd * tipo_cambio
//   total_add        = fee_cobro_pct + iibb_pct + fee_cuotas_pct
//   factor_neto      = (1 - total_add/100) * (1 - posnet_pct/100)  ← posnet en cascada
//   total_cobrar_ars = round(precio_ars / factor_neto * 1.02, 2)   ← colchón 2%
//   valor_cuota_ars  = round(total_cobrar_ars / cuotas, 2)
//   neto_final_ars   = round(total_cobrar_ars * factor_neto, 2)
//   neto_final_usd   = round(neto_final_ars / tipo_cambio, 2)
// Ejemplo verificado: 1000 USD a TC 1000 →
//   1 cuota:  factor 0.820608, total 1,242,980.81, cuota 1,242,980.81
//   12 cuotas: factor 0.613536, total 1,662,494.13, cuota 138,541.18
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, AuthRequest } from '../auth';

const round2 = (x: number): number => Math.round(x * 100) / 100;

const router = Router();

// ---- GET /fees — planes disponibles ----
router.get('/fees', authRequired, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute('SELECT * FROM cuotas_fees ORDER BY cuotas ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /cuotero/fees:', err);
    res.status(500).json({ error: 'Error al obtener los planes de cuotas' });
  }
});

// ---- POST /calcular — cálculo exacto del cuotero ----
router.post('/calcular', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const { precio_usd, tipo_cambio, plan } = req.body || {};

    const precioUsd = Number(precio_usd);
    const tipoCambio = Number(tipo_cambio);
    if (!Number.isFinite(precioUsd) || precioUsd <= 0) {
      res.status(400).json({ error: 'precio_usd inválido' });
      return;
    }
    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      res.status(400).json({ error: 'tipo_cambio inválido' });
      return;
    }
    if (typeof plan !== 'string' || plan.trim() === '') {
      res.status(400).json({ error: 'plan requerido' });
      return;
    }

    const feeResult = await db.execute({
      sql: 'SELECT * FROM cuotas_fees WHERE plan = ?',
      args: [plan.trim()],
    });
    if (feeResult.rows.length === 0) {
      res.status(400).json({ error: 'Plan inválido' });
      return;
    }
    const fee = feeResult.rows[0];

    const cuotas = Number(fee.cuotas);
    const fee_cobro_pct = Number(fee.fee_cobro_pct) || 0;
    const fee_cuotas_pct = Number(fee.fee_cuotas_pct) || 0;
    const iibb_pct = Number(fee.iibb_pct) || 0;
    const posnet_pct = Number(fee.posnet_pct) || 0;

    const precio_ars = precioUsd * tipoCambio;
    const total_add_pct = fee_cobro_pct + iibb_pct + fee_cuotas_pct;
    const factor_neto = (1 - total_add_pct / 100) * (1 - posnet_pct / 100);
    if (factor_neto <= 0) {
      res.status(400).json({ error: 'Plan inválido: factor neto no positivo' });
      return;
    }
    const total_cobrar_ars = round2((precio_ars / factor_neto) * 1.02);
    const valor_cuota_ars = round2(total_cobrar_ars / cuotas);
    const neto_final_ars = round2(total_cobrar_ars * factor_neto);
    const neto_final_usd = round2(neto_final_ars / tipoCambio);

    res.json({
      plan: fee.plan,
      cuotas,
      precio_ars,
      total_add_pct,
      factor_neto,
      total_cobrar_ars,
      valor_cuota_ars,
      neto_final_ars,
      neto_final_usd,
    });
  } catch (err) {
    console.error('Error POST /cuotero/calcular:', err);
    res.status(500).json({ error: 'Error al calcular las cuotas' });
  }
});

export default router;
