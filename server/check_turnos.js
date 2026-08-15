import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://hhhhhh-valen.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3Mzg5NTYsImlkIjoiMDFhMDAxZWUtYzkwMS03NGQ1LTk2MTUtMWQ5MmJlNDAxZjQ5Iiwia2lkIjoiR3duZ2U2djZzTmd5SVhERXlQUXAzR05xYTFob1NrOTNaelF0MUtacGtZOCIsInJpZCI6IjdiMzBhM2I1LWM4MmYtNDY1OS04MWRjLWQ2NjBkZmFlZDVhZSJ9.uZxiUycIoi1KHJs6jEPmUVMEIAbBQ1GdbmFvrtBzjwZc_mq6AQLx76Fw7SqCXSxQnVUL08OWvayPK_kw-_1mDg';

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function check() {
  const rows = await client.execute("PRAGMA table_info(turnos)");
  console.log('Columnas en tabla turnos:');
  for (const row of rows.rows) {
    console.log(' -', row.name, row.type);
  }
}

check().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
