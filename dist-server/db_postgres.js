import { Pool } from 'pg';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
// Helper para queries preparadas
export async function query(text, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    }
    finally {
        client.release();
    }
}
// Helper para obtener una fila
export async function queryOne(text, params) {
    const result = await query(text, params);
    return result.rows[0] || null;
}
// Helper para obtener todas las filas
export async function queryAll(text, params) {
    const result = await query(text, params);
    return result.rows;
}
export default pool;
