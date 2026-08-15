import pool from './db_postgres';
// Wrapper compatible con better-sqlite3 para facilitar la migración
class PGStatement {
    text;
    constructor(text) {
        // Convertir placeholders de SQLite (?) a PostgreSQL ($1, $2, ...)
        let paramIndex = 0;
        this.text = text.replace(/\?/g, () => `$${++paramIndex}`);
    }
    async run(...params) {
        const client = await pool.connect();
        try {
            const result = await client.query(this.text, params);
            return { lastInsertRowid: result.rows[0]?.id || 0, changes: result.rowCount };
        }
        finally {
            client.release();
        }
    }
    async get(...params) {
        const client = await pool.connect();
        try {
            const result = await client.query(this.text, params);
            return result.rows[0] || null;
        }
        finally {
            client.release();
        }
    }
    async all(...params) {
        const client = await pool.connect();
        try {
            const result = await client.query(this.text, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
}
class PGDatabase {
    prepare(text) {
        return new PGStatement(text);
    }
    async exec(text) {
        const client = await pool.connect();
        try {
            await client.query(text);
        }
        finally {
            client.release();
        }
    }
}
// Adaptador síncrono que cachea resultados para compatibilidad
// NOTA: Esto es un hack para no tener que reescribir todo index.ts
// Las funciones que usan .get(), .all(), .run() deben volverse async
export const db = new PGDatabase();
export default db;
