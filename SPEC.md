# IPHONE CULTURE DASHBOARD — ESPECIFICACION COMPLETA

---

## 1. PROPOSITO

Dashboard para closeres (vendedores) de iPhone Culture (Neuquen, Argentina).
Cada vendedor tiene su propio panel. Admin gestiona todo. Oficina ve todo, anota y edita ventas (pagos) y gestiona stock.

---

## 2. USUARIOS INICIALES

| Nombre | Email | Password | Rol |
|--------|-------|----------|-----|
| Admin | admin@iphoneculture.com | admin123 | admin |
| Ian | ian@iphoneculture.com | ian2026! | closer |
| Maria Fuentes | maria.fuentes@iphoneculture.com | maria2026! | closer |
| Oficina | oficina@iphoneculture.com | oficina2026! | oficina |

---

## 3. ROLES Y PERMISOS

### Admin
- Todo: crear, editar, eliminar, ver
- Pone costo_usd y ganancia_usd en ventas
- Recalcula comision = ganancia * 0.20
- Ve calendario completo con todos los turnos

### Oficina
- VE todo como admin (ventas, turnos, stock, métricas, leads)
- ANOTA ventas asignándolas a un closer (closer_id obligatorio) o como venta propia (closer_id = su propio id)
- EDITA cualquier venta (pago_completo, seña, falta_pagar, método de pago, estado, notas, datos del comprador) — caso típico: cliente que dejó seña y termina de pagar. NO puede poner costo/ganancia, NO puede reasignar closer_id, NO puede eliminar ventas
- AGREGA y ELIMINA items de stock (no puede ajustar cantidades ni vaciar el stock)
- MENSAJEA a los closers (directo o broadcast) y recibe sus respuestas
- FICHA entrada/salida (POST /api/fichajes/marcar)
- No puede crear/editar/eliminar el resto de las entidades

### Closer (vendedor)
- Ve solo sus ventas, sus turnos, sus métricas
- Puede crear/editar/eliminar sus propias ventas y turnos
- Puede ELIMINAR items de stock (cuando vende una unidad); no puede agregar ni editar stock
- Puede RESPONDER mensajes a Oficina (POST /api/mensajes con para_oficina: true)
- NO ve lo de otros vendedores
- NO puede poner costo ni ganancia

---

## 4. STACK TECNICO

- **Backend:** Node.js + Express + TypeScript + @libsql/client (Turso)
- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **PDF:** jsPDF
- **DB:** Turso (SQLite en la nube)
- **Deploy:** Railway (backend) + Railway/Vercel (frontend)
- **Auth:** JWT

---

## 5. DATABASE SCHEMA (SQLite)

```sql
-- Usuarios
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT CHECK(rol IN ('admin','oficina','closer')) DEFAULT 'closer',
  telefono TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Catalogo de productos
CREATE TABLE catalogo (
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

-- Stock
CREATE TABLE stock (
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

-- Ventas
CREATE TABLE ventas (
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

-- Facturas (Comprobantes X)
CREATE TABLE facturas (
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

-- Turnos
CREATE TABLE turnos (
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

-- Cuotero fees (valores oficiales del PDF del negocio)
CREATE TABLE cuotas_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan TEXT,
  cuotas INTEGER,
  fee_cobro_pct REAL,
  fee_cuotas_pct REAL,
  iibb_pct REAL DEFAULT 1.5,
  posnet_pct REAL DEFAULT 4
);

-- Noticias
CREATE TABLE noticias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  contenido TEXT,
  tipo TEXT DEFAULT 'general',
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mensajes (admin -> closer)
-- Mensajes internos admin/oficina <-> closers
CREATE TABLE mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER,
  titulo TEXT,
  contenido TEXT,
  leido INTEGER DEFAULT 0,
  creado_por INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fichaje de entrada/salida (oficina/admin)
CREATE TABLE fichajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leads
CREATE TABLE leads (
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

-- Bonos
CREATE TABLE bonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  closer_id INTEGER,
  tipo_bono TEXT,
  monto_usd REAL,
  descripcion TEXT,
  fecha TEXT,
  pagado INTEGER DEFAULT 0,
  creado_por INTEGER
);

-- Canjes
CREATE TABLE canjes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto_entregado TEXT,
  producto_recibido TEXT,
  diferencia_usd REAL,
  estado TEXT,
  closer_id INTEGER,
  notas TEXT
);

-- Postventa
CREATE TABLE postventa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  producto TEXT,
  tipo_reclamo TEXT,
  estado TEXT,
  closer_id INTEGER,
  descripcion TEXT,
  resolucion TEXT
);

-- Clientes
CREATE TABLE clientes (
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

-- Push subscriptions (para notificaciones)
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, endpoint)
);
```

---

## 6. SEED DE CUOTAS (INSERTAR AL INICIAR)

Fees oficiales del PDF del negocio. NO existe plan de 18 cuotas.

```sql
INSERT INTO cuotas_fees (plan, cuotas, fee_cobro_pct, fee_cuotas_pct, iibb_pct, posnet_pct) VALUES
('1 cuota', 1, 14.52, 0.00, 0.00, 4.00),
('2 cuotas', 2, 8.47, 5.81, 1.50, 4.00),
('3 cuotas', 3, 7.61, 8.35, 1.50, 4.00),
('6 cuotas', 6, 7.61, 20.69, 1.50, 4.00),
('9 cuotas', 9, 7.61, 14.52, 1.50, 4.00),
('12 cuotas', 12, 7.61, 26.98, 1.50, 4.00);
```

---

## 7. FORMULA DEL CUOTERO (CRITICA)

**Input:** precio_usd, tipo_cambio, plan (ej: "12 cuotas")

**Pasos:**
1. `precio_ars = precio_usd * tipo_cambio` (ARS Neto Deseado)
2. Buscar fee del plan
3. `total_add = fee_cobro_pct + iibb_pct + fee_cuotas_pct` (los tres fees se suman y se descuentan juntos)
4. `factor_neto = (1 - total_add/100) * (1 - posnet_pct/100)` (posnet se aplica DESPUÉS, en cascada)
5. `total_cobrar_ars = round(precio_ars / factor_neto * 1.02, 2)` (el 2% es colchón)
6. `valor_cuota_ars = round(total_cobrar_ars / cuotas, 2)`
7. `neto_final_ars = round(total_cobrar_ars * factor_neto, 2)`
8. `neto_final_usd = round(neto_final_ars / tipo_cambio, 2)` (debe ≈ precio_usd + 2%)

**Ejemplo verificado (1000 USD a TC 1000):**
- Plan "1 cuota": factor_neto = 0.8548 × 0.96 = 0.820608 → total_cobrar = 1,242,980.81 → cuota = 1,242,980.81
- Plan "12 cuotas": factor_neto = (1 − 0.3609) × 0.96 = 0.613536 → total_cobrar = 1,662,494.13 → cuota = 138,541.18

---

## 8. REGLAS DE NEGOCIO CRITICAS

### Ventas
- Al crear venta → AUTOMATICAMENTE crear factura con numero FX-${Date.now().toString(36).toUpperCase()}
- Closer NO puede poner costo_usd ni ganancia_usd
- Si es_canje = 1 → comision_fija = 15 USD
- Si no es canje → comision = 0 hasta que admin ponga ganancia
- Cuando admin pone ganancia → comision = ganancia * 0.20
- OFICINA al crear una venta DEBE indicar closer_id: un usuario con rol closer, o su propio id (venta propia). Sin closer_id → 400. Oficina nunca setea costo/ganancia.
- OFICINA y ADMIN pueden EDITAR cualquier venta (pago_completo, seña, falta_pagar, método de pago, estado, notas, datos del comprador) — caso típico: seña que luego se termina de pagar. Oficina NO puede tocar costo_usd/ganancia_usd (forzados/ignorados por el server) ni reasignar closer_id. Eliminar ventas sigue siendo solo closer dueño o admin.

### Mensajería interna
- Admin → puede enviar a cualquier usuario o broadcast (closer_id NULL)
- Oficina → puede enviar a un closer o broadcast
- Closer → SOLO puede responder a Oficina (para_oficina: true; el server resuelve el id de oficina)
- PUT /leido: el destinatario directo (cualquier rol); broadcast → solo closers

### Fichaje (oficina/admin)
- POST /api/fichajes/marcar con tipo 'entrada' | 'salida'
- No se permiten dos marcas idénticas consecutivas (400)

### Turnos
- Alertas: 30 min antes (recordatorio) y 15 min antes (urgente)
- Notificaciones push nativas (web push) opcional por vendedor
- Admin ve turnos de todos, closer solo los suyos

### Stock
- Admin y oficina pueden cargar, editar y eliminar items
- Los closers también pueden eliminar items (cuando venden una unidad)
- Ajuste de cantidad (+/-) y vaciar stock: solo admin
- Todos pueden ver stock actual

### Facturas (Comprobantes X)
- SON COMPROBANTES X = NO tienen validez fiscal
- Deben verse ESPECTACULARES tipo Apple Store receipt
- PDF descargable con diseño premium
- QR de verificación
- Footer: "Este documento es un comprobante de operacion (Factura X). No tiene validez fiscal."

---

## 9. CATALOGO DE PRECIOS (USD)

### iPhones Nuevos
| Producto | Precio Base |
|----------|-------------|
| iPhone 16 128GB | 835 |
| iPhone 17 256GB | 980 |
| iPhone Air 256GB | 1020 |
| iPhone 17 Pro 256GB | 1190 |
| iPhone 17 Pro 512GB | 1410 |
| iPhone 17 Pro Max 256GB | 1290 |
| iPhone 17 Pro Max 512GB | 1510 |
| iPhone 17 Pro Max 1TB | 1720 |
| iPhone 17 Pro Max 2TB | 2140 |

**Precios finales:**
- Precio contado = precio_base + 2%
- Precio regular = precio_base + 150 USD
- Precio promo contado = precio contado (el contado ES la promo). REGLA DEL DUEÑO: el precio promo contado SIEMPRE es el más barato mostrado (siempre ≤ lista/regular). En la card del catálogo el precio grande es la promo contado y el tachado es el precio de lista (regular).

### Apple Watch
| Producto | Precio |
|----------|--------|
| Apple Watch SE 3 40mm | 330 |
| Apple Watch SE 3 44mm | 360 |
| Apple Watch SE 3 + CELL 40mm | 410 |
| Apple Watch SE 3 + CELL 44mm | 440 |
| Apple Watch S11 42mm | 435 |
| Apple Watch S11 46mm | 465 |
| Apple Watch S11 + CELL 42mm | 670 |
| Apple Watch S11 + CELL 46mm | 700 |
| Apple Watch Ultra 3 + CELL 49mm | 835 |

### AirPods
| Producto | Precio |
|----------|--------|
| AirPods 4 | 165 |
| AirPods 4 (ANC) | 205 |
| AirPods Pro 3rd Gen | 305 |
| AirPods Max USB-C | 585 |

### Accesorios
| Producto | Precio |
|----------|--------|
| 20W USB-C Power Adapter | 25 |
| 30W USB-C Power Adapter | 40 |
| Lightning Cable AAA | 10 |
| USB-C to Lightning Cable AAA | 10 |
| AirTag 1 Pack | 75 |
| AirTag 4 Pack | 170 |
| Apple TV 4K 128GB | 290 |

### iPad (consultar colores)
| Producto | Precio |
|----------|--------|
| iPad Mini A17 Pro 128GB | 585 |
| iPad Mini A17 Pro 256GB | 685 |
| iPad 11" A16 128GB | 450 |
| iPad 11" A16 256GB | 560 |
| iPad Air 11" M3 128GB | 640 |
| iPad Air 11" M4 128GB | 720 |
| iPad Air 11" M4 256GB | 820 |
| iPad Air 13" M3 128GB | 890 |
| iPad Air 13" M3 256GB | 990 |
| iPad Air 13" M4 128GB | 960 |
| iPad Air 13" M4 256GB | 1060 |
| iPad Pro 11" M5 256GB | 1090 |
| iPad Pro 11" M5 512GB | 1330 |
| iPad Pro 11" M5+CELL 256GB | 1400 |
| iPad Pro 11" M5+CELL 512GB | 1615 |
| iPad Pro 13" M5 256GB | 1420 |
| iPad Pro 13" M5 512GB | 1660 |
| iPad Pro 13" M5 1TB | 2235 |
| iPad Pro 13" M5 2TB | 2710 |
| iPad Pro 13" M5+CELL 256GB | 1760 |
| iPad Pro 13" M5+CELL 512GB | 1980 |

### MacBook (consultar colores)
| Producto | Precio |
|----------|--------|
| MacBook Neo A18 Pro 13" 8/256 | 765 |
| MacBook Neo A18 Pro 13" 8/512 | 865 |
| MacBook Air M5 13.6" 16/512 | 1380 |
| MacBook Air M5 13.6" 16/1TB | 1545 |
| MacBook Air M5 13.6" 24/1TB | 1855 |
| MacBook Air M5 15.3" 16/512 | 1430 |
| MacBook Air M5 15.3" 16/1TB | 2010 |
| MacBook Air M5 15.3" 24/1TB | 1895 |
| MacBook Pro M5 14" 16/1TB | 2270 |
| MacBook Pro M5 14" 24/1TB | 2475 |
| MacBook Pro M5 14" 32/1TB | 2735 |
| MacBook Pro M5 Pro 14" 24/1TB | 2460 |
| MacBook Pro M5 Pro 14" 24/2TB | 2945 |
| MacBook Pro M5 Pro 14" 24/2TB 18CPU | 3255 |
| MacBook Pro M5 Pro 14" 48/1TB | 3100 |
| MacBook Pro M5 Pro 14" 48/1TB 18CPU | 3305 |
| MacBook Pro M5 Max 14" 36/2TB | 4025 |
| MacBook Pro M5 Max 14" 48/2TB | 4750 |
| MacBook Pro M5 Pro 16" 24/1TB | 2995 |
| MacBook Pro M5 Pro 16" 48/1TB | 3460 |
| MacBook Pro M5 Max 16" 36/2TB | 4390 |
| MacBook Pro M5 Max 16" 48/2TB | 4955 |

### iMac / Studio / Accesorios Mac
| Producto | Precio |
|----------|--------|
| iMac M4 24" 16/256 8CPU | 2050 |
| iMac M4 24" 16/256 10CPU | 2255 |
| iMac M4 24" 16/512 10CPU | 2460 |
| iMac M4 24" 24/512 10CPU | 2670 |
| iMac M4 24" 24/1TB 10CPU | 3440 |
| iMac M4 24" 32/1TB 10CPU | 3645 |
| Studio Display Standard Tilt | 2925 |
| Studio Display Standard Tilt+Height | 3030 |
| Studio Display Nano Tilt | 3335 |
| Magic Mouse 2 White | 145 |
| Magic Mouse 2 Black | 165 |
| Magic TrackPad 2 Black | 260 |
| Magic Keyboard Touch ID NumPad | 320 |

### Consolas / Varios
| Producto | Precio |
|----------|--------|
| PS5 Slim 825GB Digital | 660 |
| Joystick PS5 Original | 85 |
| PS5 VR2 + Horizon | 565 |
| Portal Remote Player PS5 | 390 |
| Joystick Xbox Original | 80 |
| Nintendo Switch 2 256GB | 600 |
| Volante Logitech G923 | 395 |
| Palanca Cambios G29/G923 | 75 |
| Meta Quest 3S 128GB | 480 |
| Meta Quest 3S 256GB | 540 |

---

## 10. DISEÑO VISUAL

- **Fondo:** #0a0a0f (negro azulado)
- **Primario:** #00f0ff (cyan neon)
- **Éxito:** #10b981 (emerald)
- **Admin:** #f59e0b (amber)
- **Oficina:** #8b5cf6 (violet)
- **Bordes:** border-cyan-500/20
- **Sombras:** box-shadow con rgba(0,240,255,0.1)
- **Gradientes:** linear-gradient(90deg, #00f0ff, #a855f7)
- **Fuente:** Inter o sistema
- **Cursor personalizado:** iPhone (opcional)

---

## 11. API ENDPOINTS RESUMEN

### Auth
- POST /api/auth/login → {token, user}
- GET /api/auth/me → user
- PUT /api/auth/me/telefono

### Catalogo
- GET /api/catalogo

### Stock
- GET /api/stock
- POST /api/stock (admin, oficina)
- PUT /api/stock/:id (admin, oficina)
- DELETE /api/stock/:id (admin, oficina, closer) ← eliminar un item
- DELETE /api/stock (admin) ← eliminar TODO
- POST /api/stock/:id/ajustar (admin)

### Ventas
- GET /api/ventas (filtra por rol)
- POST /api/ventas (closer: propia; admin: puede indicar closer_id; oficina: closer_id OBLIGATORIO = closer o ella misma)
- PUT /api/ventas/:id (closer dueño, oficina o admin; oficina/closer no pueden tocar costo_usd/ganancia_usd ni closer_id)
- DELETE /api/ventas/:id (closer dueño o admin)

### Facturas
- GET /api/facturas
- GET /api/comprobante/:numero (publico)

### Canjes
- GET /api/canjes (filtra por rol: closer ve los suyos)
- POST /api/canjes (admin, closer)
- PUT /api/canjes/:id (admin)
- DELETE /api/canjes/:id (admin)
- GET /api/clientes (picker de cliente para canjes)

### Turnos
- GET /api/turnos
- POST /api/turnos
- PUT /api/turnos/:id
- DELETE /api/turnos/:id

### Cuotero
- GET /api/cuotero/fees
- POST /api/cuotero/calcular

### Admin
- GET /api/admin/stats
- GET /api/closers
- GET /api/metricas?closer_id=X

### Noticias
- GET /api/noticias
- POST /api/noticias (admin)
- DELETE /api/noticias/:id (admin)

### Mensajes
- GET /api/mensajes (closer: propios + broadcast; admin/oficina: todos)
- POST /api/mensajes (admin/oficina/closer con validación por rol; closer usa para_oficina: true)
- PUT /api/mensajes/:id/leido (destinatario directo; broadcast solo closers)

### Chat (canal general "Equipo" + DMs entre todos; polling, sin websockets)
- GET /api/chat/usuarios → todos los usuarios [{id, nombre, rol}]
- GET /api/chat/general → últimos 100 del canal general (ascendente)
- GET /api/chat/dm/:otroId → últimos 100 entre yo y :otroId (ascendente)
- POST /api/chat {para_id|null, texto} (texto 1..2000 chars; para_id debe existir)
- POST /api/chat/leer {conversacion: 'general'|'dm:X'} → marca leído hasta el último mensaje
- GET /api/chat/unread → {general: N, dms: {"2": N, ...}} (DMs nunca abiertos cuentan en su totalidad)

### Fichajes
- POST /api/fichajes/marcar (oficina/admin) {tipo: 'entrada'|'salida'} — rechaza marcas repetidas consecutivas
- GET /api/fichajes (admin/oficina, con nombre de usuario)
- GET /api/fichajes/estado (última marca del usuario actual)

### Leads
- GET /api/leads
- POST /api/leads
- PUT /api/leads/:id
- DELETE /api/leads/:id

### Push
- GET /api/push/vapid-public-key
- POST /api/push/subscribe
- POST /api/push/unsubscribe

### Init
- POST /api/init (forzar init DB)
- POST /api/seed (resetear seed con secret)

---

## 12. ENV VARS NECESARIAS

```
PORT=8080
JWT_SECRET=iphone-culture-secret-2026
TURSO_DATABASE_URL=libsql://tu-db.turso.io
TURSO_AUTH_TOKEN=tu-token
VAPID_PUBLIC_KEY=(generar con web-push)
VAPID_PRIVATE_KEY=(generar con web-push)
```

---

## 13. DEPLOY

1. Railway: conectar repo GitHub, deploy automatico
2. Variables de entorno en Railway dashboard
3. Frontend: `npm run build` → sirve dist/ desde Express
4. O separado: Vercel/Netlify para frontend, Railway solo para API

---

## 14. NOTAS IMPORTANTES

- Las facturas SON Comprobantes X, NO validez fiscal
- El cuotero debe calcular con la formula exacta del usuario
- Los turnos deben persistir en Turso (no en memoria)
- Cada closer solo ve sus datos (excepto admin/oficina)
- Admin puede dejar mensajes, bonos, noticias, stock
- Las notificaciones push son opcionales por vendedor
- La factura se genera AUTOMATICAMENTE al cargar venta
- El closer puede subir PDF de comprobante de transferencia
