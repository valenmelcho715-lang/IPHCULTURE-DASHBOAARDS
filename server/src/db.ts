import './config';
// ============================================================
// db.ts — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// Conexión @libsql/client: usa Turso si hay env vars, si no SQLite local.
// Exporta: db (cliente), initDb() (crea tablas + seeds idempotentes)
// ============================================================
import { createClient } from '@libsql/client';
import { serializeDatabase } from './database';
import bcrypt from 'bcryptjs';

const url = process.env.TURSO_DATABASE_URL || 'file:./iphone-culture.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = serializeDatabase(createClient(authToken ? { url, authToken } : { url }));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT CHECK(rol IN ('admin','oficina','closer')) DEFAULT 'closer',
  telefono TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto TEXT NOT NULL,
  modelo TEXT NOT NULL,
  descripcion TEXT,
  precio_contado_usd REAL,
  precio_regular_usd REAL,
  categoria TEXT CHECK(categoria IN ('iPhone','iPad','MacBook','Apple Watch','AirPods','Android','Accesorio','Varios')),
  imagen_url TEXT,
  destacado INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto TEXT,
  modelo TEXT,
  capacidad TEXT,
  color TEXT,
  condicion TEXT,
  precio_costo_usd REAL,
  precio_venta_usd REAL,
  cantidad INTEGER DEFAULT 0,
  categoria TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER NOT NULL,
  nombre_comprador TEXT,
  apellido_comprador TEXT,
  dni TEXT,
  producto TEXT,
  precio_venta_usd REAL,
  costo_usd REAL DEFAULT 0,
  ganancia_usd REAL DEFAULT 0,
  comision_usd REAL DEFAULT 0,
  pago_completo INTEGER DEFAULT 0,
  monto_senado_usd REAL DEFAULT 0,
  falta_pagar_usd REAL DEFAULT 0,
  metodo_pago TEXT DEFAULT 'Efectivo USD',
  es_canje INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'Completada',
  notas TEXT,
  comprobante_pdf TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  closer_id INTEGER NOT NULL,
  numero TEXT UNIQUE NOT NULL,
  cliente_nombre TEXT,
  cliente_dni TEXT,
  producto TEXT,
  precio_usd REAL,
  monto_senado REAL DEFAULT 0,
  falta_pagar REAL DEFAULT 0,
  es_canje INTEGER DEFAULT 0,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado TEXT DEFAULT 'Emitida'
);
CREATE TABLE IF NOT EXISTS turnos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER NOT NULL,
  cliente_nombre TEXT,
  telefono TEXT,
  fecha_hora DATETIME,
  motivo TEXT DEFAULT 'Consulta',
  producto_objetivo TEXT DEFAULT 'Otro',
  modelo_detalle TEXT,
  que_busca TEXT,
  presupuesto_estimado REAL DEFAULT 0,
  moneda TEXT DEFAULT 'USD',
  forma_pago TEXT DEFAULT 'Efectivo',
  senia TEXT DEFAULT 'No aplica',
  monto_senia REAL DEFAULT 0,
  cliente_id INTEGER,
  venta_id INTEGER,
  confirmado TEXT DEFAULT 'Sin confirmar',
  canal_contacto TEXT DEFAULT 'WhatsApp',
  ultimo_contacto DATETIME,
  estado_recordatorio TEXT DEFAULT 'Pendiente',
  tipo TEXT DEFAULT 'Consulta',
  estado TEXT DEFAULT 'Pendiente',
  notas TEXT,
  notificar_whatsapp INTEGER DEFAULT 0,
  alerta_enviada INTEGER DEFAULT 0,
  alerta_15_enviada INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cuotas_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan TEXT,
  cuotas INTEGER,
  fee_cobro_pct REAL DEFAULT 4,
  fee_cuotas_pct REAL,
  iibb_pct REAL DEFAULT 5,
  posnet_pct REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  contenido TEXT,
  tipo TEXT DEFAULT 'general',
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER,
  titulo TEXT,
  contenido TEXT,
  leido INTEGER DEFAULT 0,
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  telefono TEXT,
  instagram TEXT,
  email TEXT,
  fuente TEXT,
  estado TEXT DEFAULT 'Nuevo',
  closer_asignado_id INTEGER,
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER,
  tipo_bono TEXT,
  monto_usd REAL,
  descripcion TEXT,
  fecha TEXT,
  pagado INTEGER DEFAULT 0,
  creado_por INTEGER
);
CREATE TABLE IF NOT EXISTS canjes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto_entregado TEXT,
  producto_recibido TEXT,
  diferencia_usd REAL,
  estado TEXT,
  closer_id INTEGER,
  notas TEXT
);
CREATE TABLE IF NOT EXISTS postventa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto TEXT,
  tipo_reclamo TEXT,
  estado TEXT,
  closer_id INTEGER,
  descripcion TEXT,
  resolucion TEXT
);
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  canal_origen TEXT,
  cantidad_compras INTEGER DEFAULT 0,
  cliente_recurrente INTEGER DEFAULT 0,
  email TEXT,
  instagram TEXT,
  telefono TEXT,
  total_comprado_usd REAL DEFAULT 0,
  closer_id INTEGER
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint)
);
-- Lecturas por usuario de mensajes broadcast (closer_id NULL)
CREATE TABLE IF NOT EXISTS mensajes_lecturas (
  mensaje_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  leido_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mensaje_id, user_id)
);
-- Fichaje de entrada/salida (oficina/admin)
CREATE TABLE IF NOT EXISTS fichajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Chat interno: canal general "Equipo" (para_id NULL) + DMs entre todos
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  de_id INTEGER NOT NULL,
  para_id INTEGER,
  texto TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Último mensaje leído por usuario y conversación ('general' o 'dm:<idDelOtro>')
CREATE TABLE IF NOT EXISTS chat_lecturas (
  user_id INTEGER NOT NULL,
  conversacion TEXT NOT NULL,
  ultimo_leido_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, conversacion)
);
-- Campañas de bonos: admin publica QUÉ es el bono y QUÉ hay que hacer para ganarlo
CREATE TABLE IF NOT EXISTS bono_campanias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  que_hay_que_hacer TEXT,
  premio_usd REAL DEFAULT 0,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  activa INTEGER DEFAULT 1,
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Vendedores marcan "Cumplí" en una campaña y admin aprueba o rechaza
CREATE TABLE IF NOT EXISTS bono_cumplimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campania_id INTEGER NOT NULL,
  closer_id INTEGER NOT NULL,
  estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobado','rechazado')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campania_id, closer_id)
);
-- Metas mensuales de venta por usuario (admin las define)
CREATE TABLE IF NOT EXISTS metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mes TEXT NOT NULL, -- 'YYYY-MM'
  monto_usd REAL DEFAULT 0,
  UNIQUE(user_id, mes)
);
-- Auditoría: quién hizo qué y cuándo (altas, ediciones, borrados)
CREATE TABLE IF NOT EXISTS actividad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_nombre TEXT,
  accion TEXT,
  detalle TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;



// Fees oficiales (PDF del negocio): fee_cobro + iibb + fee_cuotas se suman y se
// descuentan juntos; posnet se aplica DESPUÉS, en cascada. NO existe plan de 18 cuotas.
const CUOTAS: Array<[string, number, number, number, number, number]> = [
  ['1 cuota', 1, 14.52, 0.0, 0.0, 4.0],
  ['2 cuotas', 2, 8.47, 5.81, 1.5, 4.0],
  ['3 cuotas', 3, 7.61, 8.35, 1.5, 4.0],
  ['6 cuotas', 6, 7.61, 20.69, 1.5, 4.0],
  ['9 cuotas', 9, 7.61, 14.52, 1.5, 4.0],
  ['12 cuotas', 12, 7.61, 26.98, 1.5, 4.0],
];

// [modelo, precioBaseUSD, categoria, esIphoneBase]
// iPhones: contado = base*1.02, regular = base+150 (reglas de la SPEC)
const CATALOGO: Array<[string, number, string]> = [
  ['iPhone 16 128GB', 835, 'iPhone'],
  ['iPhone 17 256GB', 980, 'iPhone'],
  ['iPhone Air 256GB', 1020, 'iPhone'],
  ['iPhone 17 Pro 256GB', 1190, 'iPhone'],
  ['iPhone 17 Pro 512GB', 1410, 'iPhone'],
  ['iPhone 17 Pro Max 256GB', 1290, 'iPhone'],
  ['iPhone 17 Pro Max 512GB', 1510, 'iPhone'],
  ['iPhone 17 Pro Max 1TB', 1720, 'iPhone'],
  ['iPhone 17 Pro Max 2TB', 2140, 'iPhone'],
  ['Apple Watch SE 3 40mm', 330, 'Apple Watch'],
  ['Apple Watch SE 3 44mm', 360, 'Apple Watch'],
  ['Apple Watch SE 3 + CELL 40mm', 410, 'Apple Watch'],
  ['Apple Watch SE 3 + CELL 44mm', 440, 'Apple Watch'],
  ['Apple Watch S11 42mm', 435, 'Apple Watch'],
  ['Apple Watch S11 46mm', 465, 'Apple Watch'],
  ['Apple Watch S11 + CELL 42mm', 670, 'Apple Watch'],
  ['Apple Watch S11 + CELL 46mm', 700, 'Apple Watch'],
  ['Apple Watch Ultra 3 + CELL 49mm', 835, 'Apple Watch'],
  ['AirPods 4', 165, 'AirPods'],
  ['AirPods 4 (ANC)', 205, 'AirPods'],
  ['AirPods Pro 3rd Gen', 305, 'AirPods'],
  ['AirPods Max USB-C', 585, 'AirPods'],
  ['20W USB-C Power Adapter', 25, 'Accesorio'],
  ['30W USB-C Power Adapter', 40, 'Accesorio'],
  ['Lightning Cable AAA', 10, 'Accesorio'],
  ['USB-C to Lightning Cable AAA', 10, 'Accesorio'],
  ['AirTag 1 Pack', 75, 'Accesorio'],
  ['AirTag 4 Pack', 170, 'Accesorio'],
  ['Apple TV 4K 128GB', 290, 'Accesorio'],
  ['iPad Mini A17 Pro 128GB', 585, 'iPad'],
  ['iPad Mini A17 Pro 256GB', 685, 'iPad'],
  ['iPad 11" A16 128GB', 450, 'iPad'],
  ['iPad 11" A16 256GB', 560, 'iPad'],
  ['iPad Air 11" M3 128GB', 640, 'iPad'],
  ['iPad Air 11" M4 128GB', 720, 'iPad'],
  ['iPad Air 11" M4 256GB', 820, 'iPad'],
  ['iPad Air 13" M3 128GB', 890, 'iPad'],
  ['iPad Air 13" M3 256GB', 990, 'iPad'],
  ['iPad Air 13" M4 128GB', 960, 'iPad'],
  ['iPad Air 13" M4 256GB', 1060, 'iPad'],
  ['iPad Pro 11" M5 256GB', 1090, 'iPad'],
  ['iPad Pro 11" M5 512GB', 1330, 'iPad'],
  ['iPad Pro 11" M5+CELL 256GB', 1400, 'iPad'],
  ['iPad Pro 11" M5+CELL 512GB', 1615, 'iPad'],
  ['iPad Pro 13" M5 256GB', 1420, 'iPad'],
  ['iPad Pro 13" M5 512GB', 1660, 'iPad'],
  ['iPad Pro 13" M5 1TB', 2235, 'iPad'],
  ['iPad Pro 13" M5 2TB', 2710, 'iPad'],
  ['iPad Pro 13" M5+CELL 256GB', 1760, 'iPad'],
  ['iPad Pro 13" M5+CELL 512GB', 1980, 'iPad'],
  ['MacBook Neo A18 Pro 13" 8/256', 765, 'MacBook'],
  ['MacBook Neo A18 Pro 13" 8/512', 865, 'MacBook'],
  ['MacBook Air M5 13.6" 16/512', 1380, 'MacBook'],
  ['MacBook Air M5 13.6" 16/1TB', 1545, 'MacBook'],
  ['MacBook Air M5 13.6" 24/1TB', 1855, 'MacBook'],
  ['MacBook Air M5 15.3" 16/512', 1430, 'MacBook'],
  ['MacBook Air M5 15.3" 16/1TB', 2010, 'MacBook'],
  ['MacBook Air M5 15.3" 24/1TB', 1895, 'MacBook'],
  ['MacBook Pro M5 14" 16/1TB', 2270, 'MacBook'],
  ['MacBook Pro M5 14" 24/1TB', 2475, 'MacBook'],
  ['MacBook Pro M5 14" 32/1TB', 2735, 'MacBook'],
  ['MacBook Pro M5 Pro 14" 24/1TB', 2460, 'MacBook'],
  ['MacBook Pro M5 Pro 14" 24/2TB', 2945, 'MacBook'],
  ['MacBook Pro M5 Pro 14" 24/2TB 18CPU', 3255, 'MacBook'],
  ['MacBook Pro M5 Pro 14" 48/1TB', 3100, 'MacBook'],
  ['MacBook Pro M5 Pro 14" 48/1TB 18CPU', 3305, 'MacBook'],
  ['MacBook Pro M5 Max 14" 36/2TB', 4025, 'MacBook'],
  ['MacBook Pro M5 Max 14" 48/2TB', 4750, 'MacBook'],
  ['MacBook Pro M5 Pro 16" 24/1TB', 2995, 'MacBook'],
  ['MacBook Pro M5 Pro 16" 48/1TB', 3460, 'MacBook'],
  ['MacBook Pro M5 Max 16" 36/2TB', 4390, 'MacBook'],
  ['MacBook Pro M5 Max 16" 48/2TB', 4955, 'MacBook'],
  ['iMac M4 24" 16/256 8CPU', 2050, 'Varios'],
  ['iMac M4 24" 16/256 10CPU', 2255, 'Varios'],
  ['iMac M4 24" 16/512 10CPU', 2460, 'Varios'],
  ['iMac M4 24" 24/512 10CPU', 2670, 'Varios'],
  ['iMac M4 24" 24/1TB 10CPU', 3440, 'Varios'],
  ['iMac M4 24" 32/1TB 10CPU', 3645, 'Varios'],
  ['Studio Display Standard Tilt', 2925, 'Varios'],
  ['Studio Display Standard Tilt+Height', 3030, 'Varios'],
  ['Studio Display Nano Tilt', 3335, 'Varios'],
  ['Magic Mouse 2 White', 145, 'Accesorio'],
  ['Magic Mouse 2 Black', 165, 'Accesorio'],
  ['Magic TrackPad 2 Black', 260, 'Accesorio'],
  ['Magic Keyboard Touch ID NumPad', 320, 'Accesorio'],
  ['PS5 Slim 825GB Digital', 660, 'Varios'],
  ['Joystick PS5 Original', 85, 'Varios'],
  ['PS5 VR2 + Horizon', 565, 'Varios'],
  ['Portal Remote Player PS5', 390, 'Varios'],
  ['Joystick Xbox Original', 80, 'Varios'],
  ['Nintendo Switch 2 256GB', 600, 'Varios'],
  ['Volante Logitech G923', 395, 'Varios'],
  ['Palanca Cambios G29/G923', 75, 'Varios'],
  ['Meta Quest 3S 128GB', 480, 'Varios'],
  ['Meta Quest 3S 256GB', 540, 'Varios'],
];

let initialized = false;

export async function initDb(force = false): Promise<void> {
  if (initialized && !force) return;
  // WAL: lecturas y escrituras concurrentes sin bloquearse (evita SQLITE_IOERR/locks)
  try {
    await db.execute('PRAGMA journal_mode=WAL');
    await db.execute('PRAGMA busy_timeout=5000');
  } catch {
    // si el FS no permite WAL, seguimos en modo delete
  }
  // Crear tablas
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }
  // Migraciones idempotentes (columnas nuevas en tablas ya existentes)
  try {
    await db.execute('ALTER TABLE bono_campanias ADD COLUMN fecha_inicio TEXT');
  } catch {
    // ya existe, no pasa nada
  }
  try {
    await db.execute('ALTER TABLE leads ADD COLUMN proximo_contacto TEXT');
  } catch {
    // ya existe, no pasa nada
  }
  // Solo crear un administrador inicial cuando la base está vacía y se lo configura.
  const userCount = await db.execute('SELECT COUNT(*) AS n FROM users');
  if (Number(userCount.rows[0].n) === 0 && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    if (process.env.BOOTSTRAP_ADMIN_PASSWORD.length < 12) throw new Error('La contraseña inicial debe tener al menos 12 caracteres');
    await db.execute({sql: 'INSERT INTO users(nombre,email,password_hash,rol) VALUES(?,?,?,?)', args: ['Administración', process.env.BOOTSTRAP_ADMIN_EMAIL, bcrypt.hashSync(process.env.BOOTSTRAP_ADMIN_PASSWORD, 12), 'admin']});
  }
  // Seed cuotas
  const cuotasCount = await db.execute('SELECT COUNT(*) as c FROM cuotas_fees');
  if (Number(cuotasCount.rows[0].c) === 0) {
    for (const c of CUOTAS) {
      await db.execute({
        sql: 'INSERT INTO cuotas_fees (plan, cuotas, fee_cobro_pct, fee_cuotas_pct, iibb_pct, posnet_pct) VALUES (?,?,?,?,?,?)',
        args: c,
      });
    }
  }
  // Seed catálogo
  const catCount = await db.execute('SELECT COUNT(*) as c FROM catalogo');
  if (process.env.DEMO_SEED === 'true' && process.env.NODE_ENV !== 'production' && Number(catCount.rows[0].c) === 0) {
    for (const [modelo, base, categoria] of CATALOGO) {
      const esIphone = categoria === 'iPhone';
      const contado = esIphone ? Math.round(base * 1.02) : base;
      const regular = esIphone ? base + 150 : base;
      const partes = modelo.split(' ');
      await db.execute({
        sql: 'INSERT INTO catalogo (producto, modelo, descripcion, precio_contado_usd, precio_regular_usd, categoria, destacado) VALUES (?,?,?,?,?,?,?)',
        args: [partes[0], modelo, `${modelo} — nuevo, sellado, garantía iPhone Culture`, contado, regular, categoria, esIphone ? 1 : 0],
      });
    }
  }
  // Seed stock de ejemplo (solo si vacío)
  const stockCount = await db.execute('SELECT COUNT(*) as c FROM stock');
  if (process.env.DEMO_SEED === 'true' && process.env.NODE_ENV !== 'production' && Number(stockCount.rows[0].c) === 0) {
    const stockSeed: Array<[string, string, string, string, string, number, number, number, string]> = [
      ['iPhone', 'iPhone 17 Pro Max', '256GB', 'Naranja', 'Nuevo sellado', 1150, 1290, 3, 'iPhone'],
      ['iPhone', 'iPhone 17 Pro', '256GB', 'Azul', 'Nuevo sellado', 1050, 1190, 2, 'iPhone'],
      ['iPhone', 'iPhone 17', '256GB', 'Blanco', 'Nuevo sellado', 850, 980, 4, 'iPhone'],
      ['iPhone', 'iPhone 16', '128GB', 'Negro', 'Nuevo sellado', 720, 835, 2, 'iPhone'],
      ['Apple Watch', 'Apple Watch S11', '46mm', 'Negro', 'Nuevo sellado', 380, 465, 2, 'Apple Watch'],
      ['AirPods', 'AirPods Pro 3rd Gen', '-', 'Blanco', 'Nuevo sellado', 240, 305, 5, 'AirPods'],
      ['iPad', 'iPad 11" A16', '128GB', 'Azul', 'Nuevo sellado', 370, 450, 2, 'iPad'],
      ['MacBook', 'MacBook Air M5 13.6"', '16/512', 'Medianoche', 'Nuevo sellado', 1200, 1380, 1, 'MacBook'],
    ];
    for (const s of stockSeed) {
      await db.execute({
        sql: 'INSERT INTO stock (producto, modelo, capacidad, color, condicion, precio_costo_usd, precio_venta_usd, cantidad, categoria) VALUES (?,?,?,?,?,?,?,?,?)',
        args: s,
      });
    }
  }
  initialized = true;
}
