import { createClient } from '@libsql/client';
const url = process.env.TURSO_DATABASE_URL || 'file:./iphone-culture.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
// Si no hay URL de Turso, usamos SQLite local como fallback
const isLocal = !url.startsWith('libsql://') && !url.startsWith('https://');
const client = createClient({ url, authToken: isLocal ? undefined : authToken });
export default client;
