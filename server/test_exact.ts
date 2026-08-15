import db from './db.ts';

async function test() {
  const data = {
    cliente_nombre: 'Test Cliente',
    telefono: '123456789',
    fecha_hora: '2026-08-20T15:00:00',
    tipo: undefined,
    estado: undefined,
    notas: undefined,
    notificar_whatsapp: undefined
  };
  const closerId = 1;
  
  try {
    const result = await db.prepare('INSERT INTO turnos (cliente_nombre, telefono, fecha_hora, tipo, estado, closer_id, notas, notificar_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      data.cliente_nombre, data.telefono, data.fecha_hora, data.tipo || 'Venta', data.estado || 'Pendiente', closerId, data.notas || '', data.notificar_whatsapp ? 1 : 0
    );
    console.log('✅ Insert exitoso:', result);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  }
}

test();
