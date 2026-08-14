import { createClient, Client } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./iphone-culture.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const isLocal = !url.startsWith('libsql://') && !url.startsWith('https://');

const client: Client = createClient({ 
  url, 
  authToken: isLocal ? undefined : authToken 
});

// Wrapper compatible con better-sqlite3 (async)
class TursoStatement {
  private sql: string;

  constructor(sql: string) {
    // Convertir placeholders de better-sqlite3 (?) a libsql (?1, ?2, ...)
    let idx = 0;
    this.sql = sql.replace(/\?/g, () => `?${++idx}`);
  }

  async run(...args: any[]) {
    const result = await client.execute({ sql: this.sql, args });
    return { 
      lastInsertRowid: result.lastInsertRowid || 0, 
      changes: result.rowsAffected 
    };
  }

  async get(...args: any[]) {
    const result = await client.execute({ sql: this.sql, args });
    return result.rows[0] ? Object.fromEntries(
      Object.entries(result.rows[0]).map(([k, v]) => [k, v as any])
    ) : null;
  }

  async all(...args: any[]) {
    const result = await client.execute({ sql: this.sql, args });
    return result.rows.map(row => Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v as any])
    ));
  }
}

class TursoDB {
  prepare(sql: string) {
    return new TursoStatement(sql);
  }

  async exec(sql: string) {
    // Split múltiples statements para Turso
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }
}

const db = new TursoDB();
export default db;
