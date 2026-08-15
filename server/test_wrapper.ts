import db from './db.ts';

async function test() {
  try {
    const result = await db.prepare('INSERT INTO turnos (cliente_nombre, telefono, fecha_hora, tipo, estado, closer_id, notas, notificar_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      'Test Cliente', '123456789', '2026-08-20T15:00:00', 'Venta', 'Pendiente', 1, '', 0
    );
    console.log('✅ Insert con wrapper exitoso:', result);
  } catch (e) {
    console.error('❌ Error con wrapper:', e.message);
    console.error(e.stack);
  }
}

test();
