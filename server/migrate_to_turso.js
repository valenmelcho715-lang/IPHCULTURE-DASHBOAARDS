#!/usr/bin/env node
/**
 * Script de migración de SQLite local a Turso
 * Uso: TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node migrate_to_turso.js
 */

import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';

const LOCAL_DB = './iphone-culture.db';
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Faltan variables de entorno: TURSO_DATABASE_URL y TURSO_AUTH_TOKEN');
  process.exit(1);
}

const localDb = new Database(LOCAL_DB);
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const tables = [
  'users', 'noticias', 'mensajes', 'clientes', 'ventas', 'facturas',
  'stock', 'turnos', 'canjes', 'postventa', 'casos', 'bonos', 'leads',
  'catalogo', 'cuotas_fees'
];

async function migrate() {
  for (const table of tables) {
    console.log(`\nMigrando tabla: ${table}`);
    
    // Leer datos locales
    const rows = localDb.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      console.log(`  ${table}: sin datos`);
      continue;
    }

    // Obtener columnas
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => `?${i + 1}`).join(', ');
    
    // Limpiar tabla en Turso
    try {
      await turso.execute(`DELETE FROM ${table}`);
    } catch (e) {
      // Tabla puede no existir aún
    }

    // Insertar datos
    const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const args = rows.map(row => columns.map(col => row[col] ?? null));
    
    // Turso soporta batch inserts
    await turso.batch(args.map(a => ({ sql: insertSql, args: a })));
    console.log(`  ${table}: ${rows.length} filas migradas`);
  }

  localDb.close();
  console.log('\n✅ Migración completada');
}

migrate().catch(e => {
  console.error('Error en migración:', e);
  process.exit(1);
});
