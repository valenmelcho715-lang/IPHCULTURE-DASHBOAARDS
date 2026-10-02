import {runBackup,backupIntervalMinutes} from './automation/storage';
import './config';
import { initAutomation } from './automation/schema';
import { automationRouter } from './automation/routes';
import { metaRouter } from './automation/meta';
import { startWorker } from './automation/worker';
// ============================================================
// index.ts — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// Express app: monta todas las rutas /api/*, sirve el build del cliente.
// ============================================================
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { initDb, db } from './db';
import { authRequired } from './auth';
import {securityHeaders} from './security';

import authRoutes from './routes/auth';
import catalogoRoutes from './routes/catalogo';
import stockRoutes from './routes/stock';
import ventasRoutes from './routes/ventas';
import facturasRoutes from './routes/facturas';
import turnosRoutes from './routes/turnos';
import cuoteroRoutes from './routes/cuotero';
import adminRoutes from './routes/admin';
import noticiasRoutes from './routes/noticias';
import mensajesRoutes from './routes/mensajes';
import fichajesRoutes from './routes/fichajes';
import leadsRoutes from './routes/leads';
import extrasRoutes from './routes/extras';
import pushRoutes from './routes/push';
import chatRoutes from './routes/chat';
import mejorasRoutes, { logActividad } from './routes/mejoras';

const app = express();
if(process.env.NODE_ENV==='production')app.set('trust proxy',1);
app.use(compression());
app.use(securityHeaders);
app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false }));
app.use(express.json({ limit: '10mb', verify: (req, _res, buf) => { if(req.url?.startsWith('/api/integrations/meta')) (req as any).rawBody = Buffer.from(buf); } }));
app.use('/api/integrations/meta', metaRouter);
app.use('/api/atencion', automationRouter);

// ---------- Auditoría automática de mutaciones ----------
// Registra POST/PUT/DELETE exitosos en /api/* (sin tocar auth, chat ni push
// para no guardar contraseñas ni llenar la tabla de ruido).
const RUTAS_AUDITABLES = ['/api/ventas', '/api/leads', '/api/stock', '/api/turnos', '/api/catalogo', '/api/bonos', '/api/canjes', '/api/admin'];
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  if (!RUTAS_AUDITABLES.some((p) => req.path.startsWith(p))) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const u = (req as { user?: { id: number; nombre: string } }).user;
    const accion =
      req.method === 'POST' ? 'Creación' : req.method === 'DELETE' ? 'Eliminación' : 'Edición';
    void logActividad(u?.id ?? null, u?.nombre ?? null, accion, `${req.method} ${req.originalUrl}`);
  });
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'iphone-culture', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
// Comprobante público ANTES de cualquier router con auth global montado en /api
import { publicRouter as comprobantePublico } from './routes/facturas';
app.use('/api/comprobante', comprobantePublico);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/cuotero', cuoteroRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/mensajes', mensajesRoutes);
app.use('/api/fichajes', fichajesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', mejorasRoutes); // /api/reportes /api/metas /api/actividad /api/backup
app.use('/api', extrasRoutes); // /api/bonos /api/canjes /api/postventa /api/clientes (auth global: va último)

// Endpoint auxiliar compartido: usuario actual ya está en /api/auth/me

// Servir frontend build (producción)
// El cliente corresponde a este build; se permite una ruta explícita de despliegue.
const clientDistLocal = path.resolve(__dirname, '../../client/dist');
const clientDist = process.env.CLIENT_DIST_DIR || clientDistLocal;
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        // Assets con hash: caché larga. HTML/JS de entrada y sw.js: sin caché.
        if (/\.(js|css|png|jpg|svg|woff2?)$/.test(filePath) && filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------- Backup automático diario de la base de datos ----------
async function backupDiario(): Promise<void> {try{await runBackup();}catch{console.error('[backup] No se pudo completar el respaldo; revisar Almacenamiento en el panel');}}

const PORT = Number(process.env.PORT || 8080);

initDb()
  .then(async () => {
    await initAutomation();
    await startWorker();
    void backupDiario(); // backup al arrancar
    setInterval(backupDiario, backupIntervalMinutes() * 60 * 1000); // y una vez por día
    app.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`[iphone-culture] API lista en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Error inicializando DB', err);
    process.exit(1);
  });

export { db, authRequired };
