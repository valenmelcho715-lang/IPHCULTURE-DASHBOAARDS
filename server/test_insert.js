import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://hhhhhh-valen.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3Mzg5NTYsImlkIjoiMDFhMDAxZWUtYzkwMS03NGQ1LTk2MTUtMWQ5MmJlNDAxZjQ5Iiwia2lkIjoiR3duZ2U2djZzTmd5SVhERXlQUXAzR05xYTFob1NrOTNaelF0MUtacGtZOCIsInJpZCI6IjdiMzBhM2I1LWM4MmYtNDY1OS04MWRjLWQ2NjBkZmFlZDVhZSJ9.uZxiUycIoi1KHJs6jEPmUVMEIAbBQ1GdbmFvrtBzjwZc_mq6AQLx76Fw7SqCXSxQnVUL08OWvayPK_kw-_1mDg';

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function test() {
  try {
    const result = await client.execute({
      sql: 'INSERT INTO turnos (cliente_nombre, telefono, fecha_hora, tipo, estado, closer_id, notas, notificar_whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['Test Cliente', '123456789', '2026-08-20T15:00:00', 'Venta', 'Pendiente', 1, '', 0]
    });
    console.log('✅ Insert exitoso:', result);
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test();
