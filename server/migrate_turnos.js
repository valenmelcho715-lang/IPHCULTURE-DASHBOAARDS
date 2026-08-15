import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://hhhhhh-valen.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3Mzg5NTYsImlkIjoiMDFhMDAxZWUtYzkwMS03NGQ1LTk2MTUtMWQ5MmJlNDAxZjQ5Iiwia2lkIjoiR3duZ2U2djZzTmd5SVhERXlQUXAzR05xYTFob1NrOTNaelF0MUtacGtZOCIsInJpZCI6IjdiMzBhM2I1LWM4MmYtNDY1OS04MWRjLWQ2NjBkZmFlZDVhZSJ9.uZxiUycIoi1KHJs6jEPmUVMEIAbBQ1GdbmFvrtBzjwZc_mq6AQLx76Fw7SqCXSxQnVUL08OWvayPK_kw-_1mDg';

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function migrate() {
  try {
    await client.execute('ALTER TABLE turnos ADD COLUMN notificar_whatsapp INTEGER DEFAULT 0');
    console.log('✅ Columna notificar_whatsapp agregada');
  } catch (e) {
    if (e.message?.includes('duplicate column')) {
      console.log('ℹ️ Columna notificar_whatsapp ya existe');
    } else {
      console.error('Error agregando notificar_whatsapp:', e.message);
    }
  }

  try {
    await client.execute('ALTER TABLE turnos ADD COLUMN alerta_enviada INTEGER DEFAULT 0');
    console.log('✅ Columna alerta_enviada agregada');
  } catch (e) {
    if (e.message?.includes('duplicate column')) {
      console.log('ℹ️ Columna alerta_enviada ya existe');
    } else {
      console.error('Error agregando alerta_enviada:', e.message);
    }
  }

  console.log('\n🎉 Migración completada');
}

migrate().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
