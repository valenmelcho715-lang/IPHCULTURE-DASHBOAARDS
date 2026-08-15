#!/usr/bin/env node
/**
 * Script para actualizar los fees de cuotero en Turso
 */

import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://hhhhhh-valen.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3Mzg5NTYsImlkIjoiMDFhMDAxZWUtYzkwMS03NGQ1LTk2MTUtMWQ5MmJlNDAxZjQ5Iiwia2lkIjoiR3duZ2U2djZzTmd5SVhERXlQUXAzR05xYTFob1NrOTNaelF0MUtacGtZOCIsInJpZCI6IjdiMzBhM2I1LWM4MmYtNDY1OS04MWRjLWQ2NjBkZmFlZDVhZSJ9.uZxiUycIoi1KHJs6jEPmUVMEIAbBQ1GdbmFvrtBzjwZc_mq6AQLx76Fw7SqCXSxQnVUL08OWvayPK_kw-_1mDg';

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const fees = [
  { plan: '1 cuota', cuotas: 1, fee_cobro_pct: 14.52, fee_cuotas_pct: 0.00, iibb_pct: 0.0, posnet_pct: 4 },
  { plan: '2 cuotas', cuotas: 2, fee_cobro_pct: 8.47, fee_cuotas_pct: 5.81, iibb_pct: 1.5, posnet_pct: 4 },
  { plan: '3 cuotas', cuotas: 3, fee_cobro_pct: 7.61, fee_cuotas_pct: 8.35, iibb_pct: 1.5, posnet_pct: 4 },
  { plan: '6 cuotas', cuotas: 6, fee_cobro_pct: 7.61, fee_cuotas_pct: 20.69, iibb_pct: 1.5, posnet_pct: 4 },
  { plan: '9 cuotas', cuotas: 9, fee_cobro_pct: 7.61, fee_cuotas_pct: 14.52, iibb_pct: 1.5, posnet_pct: 4 },
  { plan: '12 cuotas', cuotas: 12, fee_cobro_pct: 7.61, fee_cuotas_pct: 26.98, iibb_pct: 1.5, posnet_pct: 4 },
];

async function updateFees() {
  // Limpiar tabla
  await client.execute('DELETE FROM cuotas_fees');
  
  for (const f of fees) {
    await client.execute({
      sql: 'INSERT INTO cuotas_fees (plan, cuotas, fee_cobro_pct, fee_cuotas_pct, iibb_pct, posnet_pct) VALUES (?, ?, ?, ?, ?, ?)',
      args: [f.plan, f.cuotas, f.fee_cobro_pct, f.fee_cuotas_pct, f.iibb_pct, f.posnet_pct]
    });
    console.log(`✅ ${f.plan}: fee_cobro=${f.fee_cobro_pct}%, fee_cuotas=${f.fee_cuotas_pct}%, iibb=${f.iibb_pct}%, posnet=${f.posnet_pct}%`);
  }
  
  console.log('\n🎉 Fees actualizados correctamente');
}

updateFees().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
