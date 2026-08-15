import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'iphone-culture-secret-2026';
// ===== ASYNC HANDLER HELPER =====
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ===== DATABASE INIT (async) =====
const seedPath = path.join(__dirname, 'catalogo_seed.json');

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema_turso.sql');
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      await db.exec(schema);
      console.log('[INIT] Schema applied');
    }
  } catch (e) {
    console.error('[INIT] Error applying schema:', e);
  }

  // Migracion: agregar columnas nuevas a turnos (v1 -> v2)
  try {
    const columnsToAdd = [
      { name: 'titulo', type: 'TEXT' },
      { name: 'motivo', type: 'TEXT' },
      { name: 'producto_objetivo', type: 'TEXT' },
      { name: 'modelo_detalle', type: 'TEXT' },
      { name: 'que_busca', type: 'TEXT' },
      { name: 'presupuesto_estimado', type: 'REAL' },
      { name: 'moneda', type: 'TEXT' },
      { name: 'forma_pago', type: 'TEXT' },
      { name: 'senia', type: 'TEXT' },
      { name: 'monto_senia', type: 'REAL' },
      { name: 'cliente_id', type: 'INTEGER' },
      { name: 'venta_id', type: 'INTEGER' },
      { name: 'confirmado', type: "TEXT DEFAULT 'Sin confirmar'" },
      { name: 'canal_contacto', type: 'TEXT' },
      { name: 'ultimo_contacto', type: 'DATETIME' },
      { name: 'estado_recordatorio', type: "TEXT DEFAULT 'Pendiente'" },
      { name: 'alerta_15_enviada', type: 'INTEGER DEFAULT 0' },
    ];
    for (const col of columnsToAdd) {
      try {
        await db.prepare(`ALTER TABLE turnos ADD COLUMN ${col.name} ${col.type}`).run();
        console.log(`[MIGRATE] Columna ${col.name} agregada a turnos`);
      } catch (e: any) {
        if (!e.message?.includes('duplicate column')) {
          console.log(`[MIGRATE] Columna ${col.name} ya existe o error:`, e.message);
        }
      }
    }
  } catch (e) {
    console.error('[MIGRATE] Error migrando turnos:', e);
  }

  // Seed usuarios si no existen
  try {
    const usersCount = await db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
    if (usersCount.c === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const ianHash = bcrypt.hashSync('ian2026!', 10);
      const mariaHash = bcrypt.hashSync('maria2026!', 10);
      await db.prepare("INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)").run('Admin', 'admin@iphoneculture.com', adminHash, 'admin');
      await db.prepare("INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)").run('Ian', 'ian@iphoneculture.com', ianHash, 'closer');
      await db.prepare("INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)").run('Maria Fuentes', 'maria.fuentes@iphoneculture.com', mariaHash, 'closer');
      console.log('[SEED] Usuarios creados: admin, ian, maria');
    }
  } catch (e) {
    console.error('[SEED] Error creando usuarios:', e);
  }

  // Seed fees de cuotero si no existen
  try {
    const feesCount = await db.prepare('SELECT COUNT(*) as c FROM cuotas_fees').get() as any;
    if (feesCount.c === 0) {
      const fees = [
        { plan: '1 cuota', cuotas: 1, fee_cobro_pct: 4, fee_cuotas_pct: 6.29, iibb_pct: 5, posnet_pct: 0 },
        { plan: '2 cuotas', cuotas: 2, fee_cobro_pct: 4, fee_cuotas_pct: 8.0, iibb_pct: 5, posnet_pct: 0 },
        { plan: '3 cuotas', cuotas: 3, fee_cobro_pct: 4, fee_cuotas_pct: 8.0, iibb_pct: 5, posnet_pct: 0 },
        { plan: '6 cuotas', cuotas: 6, fee_cobro_pct: 4, fee_cuotas_pct: 15.0, iibb_pct: 5, posnet_pct: 0 },
        { plan: '9 cuotas', cuotas: 9, fee_cobro_pct: 4, fee_cuotas_pct: 19.0, iibb_pct: 5, posnet_pct: 0 },
        { plan: '12 cuotas', cuotas: 12, fee_cobro_pct: 4, fee_cuotas_pct: 22.0, iibb_pct: 5, posnet_pct: 0 },
        { plan: '18 cuotas', cuotas: 18, fee_cobro_pct: 4, fee_cuotas_pct: 30.0, iibb_pct: 5, posnet_pct: 0 },
      ];
      for (const f of fees) {
        await db.prepare('INSERT INTO cuotas_fees (plan, cuotas, fee_cobro_pct, fee_cuotas_pct, iibb_pct, posnet_pct) VALUES (?, ?, ?, ?, ?, ?)').run(
          f.plan, f.cuotas, f.fee_cobro_pct, f.fee_cuotas_pct, f.iibb_pct, f.posnet_pct
        );
      }
      console.log('[SEED] Fees de cuotero cargados');
    }
  } catch (e) {
    console.error('[SEED] Error cargando fees:', e);
  }

  if (existsSync(seedPath)) {
    try {
      const count = await db.prepare('SELECT COUNT(*) as c FROM catalogo').get() as any;
      if (count.c === 0) {
        const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
        const stmt = db.prepare(`
          INSERT INTO catalogo (producto, modelo, descripcion, precio_contado_usd, precio_regular_usd,
            cuotas_3, cuotas_6, cuotas_9, cuotas_12, categoria, destacado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of seed) {
          await stmt.run(
            item.producto, item.modelo, item.descripcion || '',
            item.precio_contado_usd, item.precio_regular_usd,
            item.cuotas_3, item.cuotas_6, item.cuotas_9, item.cuotas_12,
            item.categoria, item.destacado || 0
          );
        }
        console.log(`[SEED] Catalogo cargado: ${seed.length} productos`);
      }
    } catch (e) {
      console.error('[SEED] Error cargando catalogo:', e);
    }
  }
}

app.use(cors());
app.use(express.json());

// ===== HEALTH / STATUS (publico) =====
app.get('/api/status', asyncHandler(async (req, res) => {
  const catalogoCount = (await db.prepare('SELECT COUNT(*) as c FROM catalogo').get() as any).c;
  const usersCount = (await db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const closers = await db.prepare("SELECT id, nombre, email FROM users WHERE rol = 'closer'").all();
  res.json({ catalogo: catalogoCount, users: usersCount, closers });
}));

// ===== INIT FORZADO (emergencia) =====
app.post('/api/init', asyncHandler(async (req, res) => {
  await initDatabase();
  res.json({ success: true, message: 'Init completado' });
}));

// ===== SEED FORZADO (usar con precaucion) =====
app.post('/api/seed', asyncHandler(async (req, res) => {
  if (req.body.secret !== 'iphone-culture-2026-seed') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    if (existsSync(seedPath)) {
      const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
      try {
        await db.prepare("INSERT INTO catalogo (producto, modelo, categoria) VALUES ('__test__', '__test__', 'Accesorio')").run();
        await db.prepare("DELETE FROM catalogo WHERE producto = '__test__'").run();
      } catch (e) {
        await db.prepare("ALTER TABLE catalogo RENAME TO catalogo_old").run();
        await db.prepare(`CREATE TABLE catalogo (
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
        )`).run();
        await db.prepare(`INSERT INTO catalogo (id, producto, modelo, descripcion, precio_contado_usd, precio_regular_usd,
          cuotas_3, cuotas_6, cuotas_9, cuotas_12, categoria, imagen_url, destacado, created_at)
          SELECT id, producto, modelo, descripcion, precio_contado_usd, precio_regular_usd,
          cuotas_3, cuotas_6, cuotas_9, cuotas_12, categoria, imagen_url, destacado, created_at FROM catalogo_old`).run();
        await db.prepare("DROP TABLE catalogo_old").run();
      }
      await db.prepare('DELETE FROM catalogo').run();
      const stmt = db.prepare(`
        INSERT INTO catalogo (producto, modelo, descripcion, precio_contado_usd, precio_regular_usd,
          cuotas_3, cuotas_6, cuotas_9, cuotas_12, categoria, destacado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of seed) {
        await stmt.run(
          item.producto, item.modelo, item.descripcion || '',
          item.precio_contado_usd, item.precio_regular_usd,
          item.cuotas_3, item.cuotas_6, item.cuotas_9, item.cuotas_12,
          item.categoria, item.destacado || 0
        );
      }
    }
    const adminHash = bcrypt.hashSync('admin123', 10);
    const ianHash = bcrypt.hashSync('ian2026!', 10);
    const mariaHash = bcrypt.hashSync('maria2026!', 10);
    await db.prepare("UPDATE users SET password_hash = ? WHERE email = 'admin@iphoneculture.com'").run(adminHash);
    await db.prepare("UPDATE users SET password_hash = ? WHERE email = 'ian@iphoneculture.com'").run(ianHash);
    await db.prepare("UPDATE users SET password_hash = ? WHERE email = 'maria.fuentes@iphoneculture.com'").run(mariaHash);
    res.json({ success: true, message: 'Seed completado' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// ===== AUTH MIDDLEWARE =====
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('[AUTH] No token provided');
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (e: any) {
    console.log('[AUTH] JWT verify failed:', e.message);
    console.log('[AUTH] Token prefix:', token.substring(0, 40) + '...');
    console.log('[AUTH] JWT_SECRET length:', JWT_SECRET.length, '| first3:', JWT_SECRET.substring(0, 3));
    res.status(401).json({ error: 'Invalid token', detail: e.message });
  }
};

const adminOnly = (req: any, res: any, next: any) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
};

// ===== AUTH =====
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, (user as any).password_hash)) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }
  const token = jwt.sign({ id: (user as any).id, email: (user as any).email, rol: (user as any).rol, nombre: (user as any).nombre }, JWT_SECRET);
  res.json({ token, user: { id: (user as any).id, nombre: (user as any).nombre, email: (user as any).email, rol: (user as any).rol } });
}));

app.get('/api/auth/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id, nombre, email, rol, telefono FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
}));

app.put('/api/auth/me/telefono', authMiddleware, asyncHandler(async (req, res) => {
  const { telefono } = req.body;
  await db.prepare('UPDATE users SET telefono = ? WHERE id = ?').run(telefono || null, req.user.id);
  res.json({ success: true });
}));

app.get('/api/closers', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const closers = await db.prepare("SELECT id, nombre, email FROM users WHERE rol = 'closer'").all();
  res.json(closers);
}));

// ===== NOTICIAS (todos ven, solo admin crea) =====
app.get('/api/noticias', authMiddleware, asyncHandler(async (req, res) => {
  const items = await db.prepare('SELECT * FROM noticias ORDER BY created_at DESC').all();
  res.json(items);
}));

app.post('/api/noticias', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { titulo, contenido, tipo } = req.body;
  const result = await db.prepare('INSERT INTO noticias (titulo, contenido, tipo, creado_por) VALUES (?, ?, ?, ?)').run(titulo, contenido, tipo || 'general', req.user.id);
  res.json({ id: result.lastInsertRowid });
}));

app.delete('/api/noticias/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM noticias WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// ===== MENSAJES (admin crea, closer ve solo los suyos) =====
app.get('/api/mensajes', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.rol === 'admin') {
    const items = await db.prepare('SELECT m.*, u.nombre as closer_nombre FROM mensajes m JOIN users u ON m.closer_id = u.id ORDER BY created_at DESC').all();
    return res.json(items);
  }
  const items = await db.prepare('SELECT * FROM mensajes WHERE closer_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(items);
}));

app.post('/api/mensajes', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { closer_id, titulo, contenido } = req.body;
  const result = await db.prepare('INSERT INTO mensajes (closer_id, titulo, contenido, creado_por) VALUES (?, ?, ?, ?)').run(closer_id, titulo, contenido, req.user.id);
  res.json({ id: result.lastInsertRowid });
}));

app.put('/api/mensajes/:id/leido', authMiddleware, asyncHandler(async (req, res) => {
  await db.prepare('UPDATE mensajes SET leido = 1 WHERE id = ? AND closer_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
}));

// ===== VENTAS (closer ve solo las suyas, admin ve todas) =====
app.get('/api/ventas', authMiddleware, asyncHandler(async (req, res) => {
  let sql = 'SELECT v.*, u.nombre as closer_nombre, f.numero as factura FROM ventas v LEFT JOIN users u ON v.closer_id = u.id LEFT JOIN facturas f ON f.venta_id = v.id WHERE 1=1';
  const params: any[] = [];
  if (req.user.rol !== 'admin') {
    sql += ' AND v.closer_id = ?';
    params.push(req.user.id);
  }
  sql += ' ORDER BY v.created_at DESC';
  const items = await db.prepare(sql).all(...params);
  res.json(items);
}));

app.get('/api/ventas/:id', authMiddleware, asyncHandler(async (req, res) => {
  const item = await db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && (item as any).closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  res.json(item);
}));

app.post('/api/ventas', authMiddleware, asyncHandler(async (req, res) => {
  const data = req.body;
  const closerId = req.user.rol === 'admin' ? (data.closer_id || req.user.id) : req.user.id;
  const esCanje = data.es_canje ? 1 : 0;
  const precioVenta = parseFloat(data.precio_venta_usd) || 0;
  const costo = 0;
  let ganancia = 0;
  let comision = 0;
  if (esCanje) {
    comision = 15;
  } else {
    ganancia = 0;
    comision = 0;
  }
  const faltaPagar = data.pago_completo ? 0 : (parseFloat(data.falta_pagar_usd) || 0);
  const montoSenado = data.pago_completo ? 0 : (parseFloat(data.monto_senado_usd) || 0);
  const result = await db.prepare(`
    INSERT INTO ventas (closer_id, nombre_comprador, apellido_comprador, dni, producto,
      precio_venta_usd, costo_usd, ganancia_usd, comision_usd,
      pago_completo, monto_senado_usd, falta_pagar_usd, metodo_pago,
      es_canje, estado, notas, comprobante_pdf)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    closerId, data.nombre_comprador || '', data.apellido_comprador || '', data.dni || '', data.producto,
    precioVenta, costo, ganancia, comision,
    data.pago_completo ? 1 : 0, montoSenado, faltaPagar, data.metodo_pago || 'Efectivo USD',
    esCanje, data.estado || 'Completada', data.notas || '', data.comprobante_pdf || null
  );
  const ventaId = result.lastInsertRowid;
  const facturaNum = `FX-${Date.now().toString(36).toUpperCase()}`;
  await db.prepare(`
    INSERT INTO facturas (venta_id, closer_id, numero, cliente_nombre, cliente_dni, producto, 
      precio_usd, monto_senado, falta_pagar, es_canje, fecha, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'Emitida')
  `).run(
    ventaId, closerId, facturaNum,
    `${data.nombre_comprador || ''} ${data.apellido_comprador || ''}`.trim(),
    data.dni || '', data.producto, precioVenta, montoSenado, faltaPagar, esCanje
  );
  res.json({ id: ventaId, factura: facturaNum, ganancia_usd: ganancia, comision_usd: comision });
}));

app.put('/api/ventas/:id', authMiddleware, asyncHandler(async (req, res) => {
  const data = req.body;
  const venta = await db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id) as any;
  if (!venta) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && venta.closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const updates: string[] = [];
  const values: any[] = [];
  const fields = ['nombre_comprador','apellido_comprador','dni','producto','precio_venta_usd','metodo_pago','estado','notas','pago_completo','monto_senado_usd','falta_pagar_usd','es_canje','comprobante_pdf'];
  fields.forEach(f => {
    if (data[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(data[f]);
    }
  });
  if (req.user.rol === 'admin') {
    if (data.costo_usd !== undefined) {
      updates.push('costo_usd = ?');
      values.push(parseFloat(data.costo_usd) || 0);
    }
    if (data.ganancia_usd !== undefined) {
      updates.push('ganancia_usd = ?');
      values.push(parseFloat(data.ganancia_usd) || 0);
    }
  }
  const esCanje = data.es_canje !== undefined ? (data.es_canje ? 1 : 0) : venta.es_canje;
  const gananciaAdmin = req.user.rol === 'admin' && data.ganancia_usd !== undefined
    ? parseFloat(data.ganancia_usd)
    : (venta.ganancia_usd || 0);
  let comision = 0;
  if (esCanje) {
    comision = 15;
  } else {
    comision = (gananciaAdmin || 0) * 0.20;
  }
  updates.push('comision_usd = ?');
  values.push(comision);
  values.push(req.params.id);
  await db.prepare(`UPDATE ventas SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (data.nombre_comprador !== undefined || data.apellido_comprador !== undefined || data.dni !== undefined) {
    await db.prepare('UPDATE facturas SET cliente_nombre = ?, cliente_dni = ? WHERE venta_id = ?').run(
      `${data.nombre_comprador || venta.nombre_comprador || ''} ${data.apellido_comprador || venta.apellido_comprador || ''}`.trim(),
      data.dni || venta.dni || '', req.params.id
    );
  }
  res.json({ success: true, comision_usd: comision });
}));

app.delete('/api/ventas/:id', authMiddleware, asyncHandler(async (req, res) => {
  const venta = await db.prepare('SELECT closer_id FROM ventas WHERE id = ?').get(req.params.id) as any;
  if (!venta) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && venta.closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  await db.prepare('DELETE FROM ventas WHERE id = ?').run(req.params.id);
  await db.prepare('DELETE FROM facturas WHERE venta_id = ?').run(req.params.id);
  res.json({ success: true });
}));

// ===== FACTURAS =====
app.get('/api/facturas', authMiddleware, asyncHandler(async (req, res) => {
  let sql = 'SELECT * FROM facturas WHERE 1=1';
  const params: any[] = [];
  if (req.user.rol !== 'admin') {
    sql += ' AND closer_id = ?';
    params.push(req.user.id);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(await db.prepare(sql).all(...params));
}));

app.get('/api/facturas/:id', authMiddleware, asyncHandler(async (req, res) => {
  const item = await db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && (item as any).closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  res.json(item);
}));

// Endpoint publico para ver factura por numero (para enviar al cliente)
app.get('/api/comprobante/:numero', asyncHandler(async (req, res) => {
  const item = await db.prepare(`
    SELECT f.*, u.nombre as closer_nombre,
      v.metodo_pago, v.estado as venta_estado, v.notas, v.pago_completo
    FROM facturas f
    LEFT JOIN users u ON f.closer_id = u.id
    LEFT JOIN ventas v ON f.venta_id = v.id
    WHERE f.numero = ?
  `).get(req.params.numero);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
}));

// ===== CUOTERO =====
app.get('/api/cuotero/fees', authMiddleware, asyncHandler(async (req, res) => {
  const fees = await db.prepare('SELECT plan, cuotas, fee_cobro_pct, fee_cuotas_pct, iibb_pct, posnet_pct FROM cuotas_fees ORDER BY cuotas').all();
  res.json(fees);
}));

app.post('/api/cuotero/calcular', authMiddleware, asyncHandler(async (req, res) => {
  const { precio_usd, tipo_cambio, plan } = req.body;
  const pUsd = parseFloat(precio_usd) || 0;
  const tc = parseFloat(tipo_cambio) || 0;
  if (pUsd <= 0 || tc <= 0) return res.status(400).json({ error: 'Precio USD y tipo de cambio son requeridos' });

  const fee = await db.prepare('SELECT * FROM cuotas_fees WHERE plan = ?').get(plan) as any;
  if (!fee) return res.status(404).json({ error: 'Plan no encontrado' });

  const arsNetoDeseado = pUsd * tc;
  const totalAdd = (fee.fee_cobro_pct + fee.iibb_pct + fee.fee_cuotas_pct) / 100;
  const factorNeto = (1 - totalAdd) * (1 - fee.posnet_pct / 100);
  const totalCobrar = Math.round((arsNetoDeseado / factorNeto) * 1.02);
  const valorCuota = Math.round(totalCobrar / fee.cuotas);
  const netoFinalArs = Math.round(totalCobrar * factorNeto);
  const netoFinalUsd = parseFloat((netoFinalArs / tc).toFixed(2));

  res.json({
    precio_usd: pUsd,
    tipo_cambio: tc,
    plan: fee.plan,
    cuotas: fee.cuotas,
    ars_neto_deseado: Math.round(arsNetoDeseado),
    factor_neto: parseFloat(factorNeto.toFixed(6)),
    total_cobrar_ars: totalCobrar,
    valor_cuota_ars: valorCuota,
    neto_final_ars: netoFinalArs,
    neto_final_usd: netoFinalUsd,
    fees: {
      fee_cobro_pct: fee.fee_cobro_pct,
      fee_cuotas_pct: fee.fee_cuotas_pct,
      iibb_pct: fee.iibb_pct,
      posnet_pct: fee.posnet_pct,
    }
  });
}));

// ===== METRICAS POR CLOSER =====
app.get('/api/metricas', authMiddleware, asyncHandler(async (req, res) => {
  const closerId = req.user.rol === 'admin' && req.query.closer_id ? parseInt(req.query.closer_id as string) : req.user.id;
  const ventasHoy = await db.prepare("SELECT COUNT(*) as c, SUM(precio_venta_usd) as total, SUM(comision_usd) as comision FROM ventas WHERE closer_id = ? AND date(created_at) = date('now')").get(closerId);
  const ventasSemana = await db.prepare("SELECT COUNT(*) as c, SUM(precio_venta_usd) as total, SUM(comision_usd) as comision FROM ventas WHERE closer_id = ? AND created_at >= date('now', '-7 days')").get(closerId);
  const ventasMes = await db.prepare("SELECT COUNT(*) as c, SUM(precio_venta_usd) as total, SUM(comision_usd) as comision FROM ventas WHERE closer_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").get(closerId);
  const historial = await db.prepare(`
    SELECT strftime('%Y-%m', created_at) as mes, COUNT(*) as ventas, SUM(precio_venta_usd) as total, SUM(comision_usd) as comisiones
    FROM ventas WHERE closer_id = ? GROUP BY mes ORDER BY mes DESC LIMIT 12
  `).all(closerId);
  const promedio = await db.prepare('SELECT AVG(precio_venta_usd) as promedio FROM ventas WHERE closer_id = ?').get(closerId);
  const totalAcumulado = await db.prepare('SELECT SUM(comision_usd) as total FROM ventas WHERE closer_id = ?').get(closerId);
  const pendientes = await db.prepare('SELECT COUNT(*) as c, SUM(falta_pagar_usd) as monto FROM ventas WHERE closer_id = ? AND pago_completo = 0').get(closerId);
  const leadsCount = await db.prepare('SELECT COUNT(*) as c FROM leads WHERE closer_asignado_id = ?').get(closerId);
  const turnosHoy = await db.prepare("SELECT COUNT(*) as c FROM turnos WHERE closer_id = ? AND date(fecha_hora) = date('now')").get(closerId);
  res.json({
    hoy: ventasHoy,
    semana: ventasSemana,
    mes: ventasMes,
    historial,
    promedio: promedio || { promedio: 0 },
    totalAcumulado: totalAcumulado || { total: 0 },
    pendientes,
    leads: leadsCount,
    turnosHoy,
  });
}));

// ===== ADMIN STATS =====
app.get('/api/admin/stats', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const totalVentas = await db.prepare('SELECT COUNT(*) as c, SUM(precio_venta_usd) as total, SUM(ganancia_usd) as ganancia, SUM(comision_usd) as comisiones FROM ventas').get();
  const totalClientes = await db.prepare('SELECT COUNT(*) as c FROM clientes').get();
  const totalStock = await db.prepare('SELECT SUM(cantidad) as c FROM stock').get();
  const leadsNuevos = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE estado = 'Nuevo'").get();
  const porCloser = await db.prepare(`
    SELECT u.nombre, COUNT(v.id) as ventas, SUM(v.precio_venta_usd) as total, SUM(v.comision_usd) as comisiones
    FROM users u LEFT JOIN ventas v ON u.id = v.closer_id
    WHERE u.rol = 'closer' GROUP BY u.id
  `).all();
  res.json({ totalVentas, totalClientes, totalStock, leadsNuevos, porCloser });
}));

// ===== TURNOS (v2 - campos completos) =====
app.get('/api/turnos', authMiddleware, asyncHandler(async (req, res) => {
  let sql = 'SELECT t.*, u.nombre as closer_nombre, u.telefono as closer_telefono FROM turnos t LEFT JOIN users u ON t.closer_id = u.id WHERE 1=1';
  const params: any[] = [];
  if (req.user.rol !== 'admin') {
    sql += ' AND t.closer_id = ?';
    params.push(req.user.id);
  }
  if (req.query.confirmado) {
    sql += ' AND t.confirmado = ?';
    params.push(req.query.confirmado);
  }
  if (req.query.desde && req.query.hasta) {
    sql += ' AND t.fecha_hora BETWEEN ? AND ?';
    params.push(req.query.desde, req.query.hasta);
  }
  sql += ' ORDER BY t.fecha_hora ASC';
  res.json(await db.prepare(sql).all(...params));
}));

app.post('/api/turnos', authMiddleware, asyncHandler(async (req, res) => {
  const d = req.body;
  if (!d.fecha_hora) {
    return res.status(400).json({ error: 'La fecha y hora del turno son obligatorias' });
  }
  const closerId = req.user.rol === 'admin' ? parseInt(d.closer_id || req.user.id) : req.user.id;
  const result = await db.prepare(`
    INSERT INTO turnos (
      titulo, cliente_nombre, telefono, fecha_hora,
      motivo, producto_objetivo, modelo_detalle, que_busca,
      presupuesto_estimado, moneda, forma_pago, senia, monto_senia,
      cliente_id, venta_id, closer_id,
      confirmado, canal_contacto, ultimo_contacto, estado_recordatorio,
      tipo, estado, notas, notificar_whatsapp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.titulo || `${d.cliente_nombre || ''} - ${d.motivo || 'Consulta'}`,
    d.cliente_nombre || '',
    d.telefono || '',
    d.fecha_hora,
    d.motivo || 'Consulta',
    d.producto_objetivo || 'Otro',
    d.modelo_detalle || '',
    d.que_busca || '',
    parseFloat(d.presupuesto_estimado) || 0,
    d.moneda || 'USD',
    d.forma_pago || 'Efectivo',
    d.senia || 'No aplica',
    parseFloat(d.monto_senia) || 0,
    d.cliente_id ? parseInt(d.cliente_id) : null,
    d.venta_id ? parseInt(d.venta_id) : null,
    closerId,
    d.confirmado || 'Sin confirmar',
    d.canal_contacto || 'WhatsApp',
    d.ultimo_contacto || null,
    d.estado_recordatorio || 'Pendiente',
    d.tipo || 'Consulta',
    d.estado || 'Pendiente',
    d.notas || '',
    d.notificar_whatsapp ? 1 : 0
  );
  res.json({ id: result.lastInsertRowid });
}));

app.put('/api/turnos/:id', authMiddleware, asyncHandler(async (req, res) => {
  const turno = await db.prepare('SELECT closer_id FROM turnos WHERE id = ?').get(req.params.id) as any;
  if (!turno) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && turno.closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const data = req.body;
  const keys = Object.keys(data).filter(k => data[k] !== undefined && k !== 'id');
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.prepare(`UPDATE turnos SET ${setClause} WHERE id = ?`).run(...keys.map(k => data[k]), req.params.id);
  res.json({ success: true });
}));

app.delete('/api/turnos/:id', authMiddleware, asyncHandler(async (req, res) => {
  const turno = await db.prepare('SELECT closer_id FROM turnos WHERE id = ?').get(req.params.id) as any;
  if (!turno) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.rol !== 'admin' && turno.closer_id !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  await db.prepare('DELETE FROM turnos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// ===== ALERTAS PENDIENTES (para el frontend) =====
app.get('/api/turnos/alertas', authMiddleware, asyncHandler(async (req, res) => {
  const ahora = new Date().toISOString();
  const en15Min = new Date(Date.now() + 15 * 60000).toISOString();
  const en30Min = new Date(Date.now() + 30 * 60000).toISOString();

  // Alertas de 15 min (urgentes)
  const alertas15 = await db.prepare(`
    SELECT t.*, u.nombre as closer_nombre, u.telefono as closer_telefono
    FROM turnos t
    JOIN users u ON t.closer_id = u.id
    WHERE t.fecha_hora BETWEEN ? AND ?
      AND t.estado != 'Completado'
      AND t.estado != 'Cancelado'
      AND t.alerta_15_enviada = 0
      AND t.notificar_whatsapp = 1
      ${req.user.rol !== 'admin' ? 'AND t.closer_id = ?' : ''}
  `).all(ahora, en15Min, ...(req.user.rol !== 'admin' ? [req.user.id] : []));

  // Alertas de 30 min
  const alertas30 = await db.prepare(`
    SELECT t.*, u.nombre as closer_nombre, u.telefono as closer_telefono
    FROM turnos t
    JOIN users u ON t.closer_id = u.id
    WHERE t.fecha_hora BETWEEN ? AND ?
      AND t.estado != 'Completado'
      AND t.estado != 'Cancelado'
      AND t.alerta_enviada = 0
      AND t.notificar_whatsapp = 1
      AND t.fecha_hora > ?
      ${req.user.rol !== 'admin' ? 'AND t.closer_id = ?' : ''}
  `).all(en15Min, en30Min, en15Min, ...(req.user.rol !== 'admin' ? [req.user.id] : []));

  res.json({ alertas15, alertas30 });
}));

// ===== STOCK CUSTOM ENDPOINTS (antes del CRUD generico) =====
app.delete('/api/stock', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM stock').run();
  res.json({ success: true, message: 'Stock eliminado completamente' });
}));

app.post('/api/stock/:id/ajustar', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { cantidad } = req.body;
  const item = await db.prepare('SELECT * FROM stock WHERE id = ?').get(req.params.id) as any;
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  const nuevaCantidad = Math.max(0, (item.cantidad || 0) + (parseInt(cantidad) || 0));
  await db.prepare('UPDATE stock SET cantidad = ? WHERE id = ?').run(nuevaCantidad, req.params.id);
  res.json({ success: true, cantidad_anterior: item.cantidad, cantidad_nueva: nuevaCantidad });
}));

// ===== GENERIC CRUD =====
const createCRUD = (table: string, fields: string[]) => {
  app.get(`/api/${table}`, authMiddleware, asyncHandler(async (req, res) => {
    let sql = `SELECT * FROM ${table} WHERE 1=1`;
    const params: any[] = [];
    if (req.user.rol !== 'admin' && ['clientes','canjes','postventa','casos','bonos','leads'].includes(table)) {
      const closerField = table === 'leads' ? 'closer_asignado_id' : 'closer_id';
      sql += ` AND ${closerField} = ?`;
      params.push(req.user.id);
    }
    sql += ' ORDER BY created_at DESC';
    res.json(await db.prepare(sql).all(...params));
  }));
  app.get(`/api/${table}/:id`, authMiddleware, asyncHandler(async (req, res) => {
    res.json(await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id));
  }));
  app.post(`/api/${table}`, authMiddleware, asyncHandler(async (req, res) => {
    const data = req.body;
    if (req.user.rol !== 'admin') {
      const closerField = table === 'leads' ? 'closer_asignado_id' : 'closer_id';
      data[closerField] = req.user.id;
    }
    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const cols = keys.join(',');
    const placeholders = keys.map(() => '?').join(',');
    const result = await db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(...keys.map(k => data[k]));
    res.json({ id: result.lastInsertRowid });
  }));
  app.put(`/api/${table}/:id`, authMiddleware, asyncHandler(async (req, res) => {
    const data = req.body;
    const keys = Object.keys(data).filter(k => data[k] !== undefined && k !== 'id');
    const setClause = keys.map(k => `${k} = ?`).join(',');
    await db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...keys.map(k => data[k]), req.params.id);
    res.json({ success: true });
  }));
  app.delete(`/api/${table}/:id`, authMiddleware, asyncHandler(async (req, res) => {
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  }));
};

createCRUD('clientes', ['nombre','canal_origen','cantidad_compras','cliente_recurrente','email','instagram','telefono','total_comprado_usd','closer_id']);
createCRUD('stock', ['producto','modelo','capacidad','color','condicion','precio_costo_usd','precio_venta_usd','cantidad','categoria']);
createCRUD('canjes', ['cliente_id','producto_entregado','producto_recibido','diferencia_usd','estado','closer_id','notas']);
createCRUD('postventa', ['cliente_id','producto','tipo_reclamo','estado','closer_id','descripcion','resolucion']);
createCRUD('casos', ['cliente_id','tipo','motivo','estado','monto_reclamado_usd','resolucion','closer_id']);
createCRUD('bonos', ['closer_id','tipo_bono','monto_usd','descripcion','fecha','pagado','creado_por']);
createCRUD('leads', ['nombre','telefono','instagram','email','fuente','estado','closer_asignado_id','notas']);
createCRUD('catalogo', ['producto','modelo','descripcion','precio_contado_usd','precio_regular_usd','cuotas_3','cuotas_6','cuotas_9','cuotas_12','categoria','imagen_url','destacado']);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ===== CRON: Revisar turnos proximos cada minuto =====
setInterval(() => {
  (async () => {
    const ahora = new Date().toISOString();
    const en15Min = new Date(Date.now() + 15 * 60000).toISOString();
    const en30Min = new Date(Date.now() + 30 * 60000).toISOString();

    // 1) Alertas URGENTES: 15 minutos antes
    const turnos15Min = await db.prepare(`
      SELECT t.*, u.telefono as closer_telefono, u.nombre as closer_nombre
      FROM turnos t
      JOIN users u ON t.closer_id = u.id
      WHERE t.fecha_hora BETWEEN ? AND ?
        AND t.estado != 'Completado'
        AND t.estado != 'Cancelado'
        AND t.alerta_15_enviada = 0
        AND t.notificar_whatsapp = 1
    `).all(ahora, en15Min);

    for (const turno of turnos15Min) {
      await db.prepare('UPDATE turnos SET alerta_15_enviada = 1 WHERE id = ?').run(turno.id);
      console.log(`[ALERTA 15MIN] Turno #${turno.id} - ${turno.cliente_nombre} en 15 min para ${turno.closer_nombre}`);
    }

    // 2) Alertas: 30 minutos antes (excluyendo los que ya fueron alertados a 15 min)
    const turnos30Min = await db.prepare(`
      SELECT t.*, u.telefono as closer_telefono, u.nombre as closer_nombre
      FROM turnos t
      JOIN users u ON t.closer_id = u.id
      WHERE t.fecha_hora BETWEEN ? AND ?
        AND t.estado != 'Completado'
        AND t.estado != 'Cancelado'
        AND t.alerta_enviada = 0
        AND t.notificar_whatsapp = 1
        AND t.fecha_hora > ?
    `).all(en15Min, en30Min, en15Min);

    for (const turno of turnos30Min) {
      await db.prepare('UPDATE turnos SET alerta_enviada = 1 WHERE id = ?').run(turno.id);
      console.log(`[ALERTA 30MIN] Turno #${turno.id} - ${turno.cliente_nombre} en 30 min para ${turno.closer_nombre}`);
    }
  })().catch(e => console.error('Error en cron de turnos:', e));
}, 60000);

// Start server after init
(async () => {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`iPhone Culture API running on port ${PORT}`);
  });
})();
