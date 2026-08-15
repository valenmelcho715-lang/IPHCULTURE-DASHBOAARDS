import { createClient } from '@libsql/client';
const url = process.env.TURSO_DATABASE_URL || 'file:./iphone-culture.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
const isLocal = !url.startsWith('libsql://') && !url.startsWith('https://');
const client = createClient({
    url,
    authToken: isLocal ? undefined : authToken
});
// Helper para convertir BigInt a Number (Turso devuelve BigInt para IDs)
function serializeValue(v) {
    if (typeof v === 'bigint')
        return Number(v);
    if (v instanceof Date)
        return v.toISOString();
    return v;
}
function serializeRow(row) {
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, serializeValue(v)]));
}
// Wrapper compatible con better-sqlite3 (async)
class TursoStatement {
    sql;
    constructor(sql) {
        // Convertir placeholders de better-sqlite3 (?) a libsql (?1, ?2, ...)
        let idx = 0;
        this.sql = sql.replace(/\?/g, () => `?${++idx}`);
    }
    async run(...args) {
        const result = await client.execute({ sql: this.sql, args });
        return {
            lastInsertRowid: Number(result.lastInsertRowid) || 0,
            changes: result.rowsAffected
        };
    }
    async get(...args) {
        const result = await client.execute({ sql: this.sql, args });
        return result.rows[0] ? serializeRow(result.rows[0]) : null;
    }
    async all(...args) {
        const result = await client.execute({ sql: this.sql, args });
        return result.rows.map(row => serializeRow(row));
    }
}
class TursoDB {
    prepare(sql) {
        return new TursoStatement(sql);
    }
    async exec(sql) {
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
