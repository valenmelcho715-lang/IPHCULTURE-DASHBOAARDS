-- Schema SQLite/Turso para iPhone Culture Dashboard
-- Compatible con Turso / libsql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('admin','closer')),
  telefono TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'general' CHECK(tipo IN ('general','stock','urgente')),
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  leido INTEGER DEFAULT 0,
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  canal_origen TEXT CHECK(canal_origen IN ('Instagram','WhatsApp','Otro')),
  cantidad_compras INTEGER DEFAULT 0,
  cliente_recurrente INTEGER DEFAULT 0,
  email TEXT,
  instagram TEXT,
  telefono TEXT,
  total_comprado_usd REAL DEFAULT 0,
  closer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER NOT NULL,
  nombre_comprador TEXT,
  apellido_comprador TEXT,
  dni TEXT,
  producto TEXT NOT NULL,
  precio_venta_usd REAL NOT NULL,
  costo_usd REAL DEFAULT 0,
  ganancia_usd REAL DEFAULT 0,
  comision_usd REAL DEFAULT 0,
  pago_completo INTEGER DEFAULT 1,
  monto_senado_usd REAL DEFAULT 0,
  falta_pagar_usd REAL DEFAULT 0,
  metodo_pago TEXT CHECK(metodo_pago IN ('Efectivo USD','Efectivo ARS','Transferencia','Cuotas')),
  es_canje INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'Completada' CHECK(estado IN ('Pendiente','Completada','Cancelada')),
  factura_generada INTEGER DEFAULT 0,
  numero_factura TEXT,
  comprobante_pdf TEXT,
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER,
  closer_id INTEGER,
  numero TEXT,
  cliente_nombre TEXT,
  cliente_dni TEXT,
  producto TEXT,
  precio_usd REAL,
  monto_senado REAL,
  falta_pagar REAL,
  es_canje INTEGER DEFAULT 0,
  fecha DATETIME,
  estado TEXT DEFAULT 'Emitida' CHECK(estado IN ('Emitida','Anulada')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto TEXT NOT NULL,
  modelo TEXT NOT NULL,
  capacidad TEXT,
  color TEXT,
  condicion TEXT CHECK(condicion IN ('Sellado','Usado','Refurbished')),
  precio_costo_usd REAL,
  precio_venta_usd REAL,
  cantidad INTEGER DEFAULT 0,
  categoria TEXT CHECK(categoria IN ('iPhone','iPad','MacBook','Apple Watch','AirPods','Android','Accesorio')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turnos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_nombre TEXT NOT NULL,
  telefono TEXT,
  fecha_hora DATETIME NOT NULL,
  tipo TEXT CHECK(tipo IN ('Venta','Entrega','Canje','Consulta','Seguimiento')),
  estado TEXT DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Confirmado','Completado','Cancelado')),
  closer_id INTEGER NOT NULL,
  notas TEXT,
  alerta_enviada INTEGER DEFAULT 0,
  notificar_whatsapp INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canjes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto_entregado TEXT,
  producto_recibido TEXT,
  diferencia_usd REAL,
  estado TEXT DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Aprobado','Rechazado','Completado')),
  closer_id INTEGER,
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS postventa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto TEXT,
  tipo_reclamo TEXT CHECK(tipo_reclamo IN ('Garantía','Devolución','Reparación','Consulta')),
  estado TEXT DEFAULT 'Abierto' CHECK(estado IN ('Abierto','En Proceso','Resuelto','Cerrado')),
  closer_id INTEGER,
  descripcion TEXT,
  resolucion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS casos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  tipo TEXT CHECK(tipo IN ('Devolución','Garantía','Reclamo')),
  motivo TEXT,
  estado TEXT DEFAULT 'Abierto' CHECK(estado IN ('Abierto','En revisión','Resuelto','Cerrado')),
  monto_reclamado_usd REAL,
  resolucion TEXT,
  closer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER,
  tipo_bono TEXT CHECK(tipo_bono IN ('Por Venta','Por Meta','Extraordinario')),
  monto_usd REAL,
  descripcion TEXT,
  fecha DATETIME,
  pagado INTEGER DEFAULT 0,
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  telefono TEXT,
  instagram TEXT,
  email TEXT,
  fuente TEXT CHECK(fuente IN ('Instagram','WhatsApp','Referido','Web','Otro')),
  estado TEXT DEFAULT 'Nuevo' CHECK(estado IN ('Nuevo','Contactado','Interesado','Cerrado','Perdido')),
  closer_asignado_id INTEGER,
  notas TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catalogo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto TEXT NOT NULL,
  modelo TEXT NOT NULL,
  descripcion TEXT,
  precio_contado_usd REAL,
  precio_regular_usd REAL,
  cuotas_3 TEXT,
  cuotas_6 TEXT,
  cuotas_9 TEXT,
  cuotas_12 TEXT,
  categoria TEXT CHECK(categoria IN ('iPhone','iPad','MacBook','Apple Watch','AirPods','Android','Accesorio')),
  imagen_url TEXT,
  destacado INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cuotas_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan TEXT NOT NULL UNIQUE,
  cuotas INTEGER NOT NULL,
  fee_cobro_pct REAL NOT NULL,
  fee_cuotas_pct REAL NOT NULL,
  iibb_pct REAL NOT NULL,
  posnet_pct REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
