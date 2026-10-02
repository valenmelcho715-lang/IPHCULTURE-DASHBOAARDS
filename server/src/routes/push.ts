// ============================================================
// routes/push.ts — Backend_Auth_Admin
// GET /vapid-public-key · POST /subscribe · POST /unsubscribe
// web-push se importa de forma segura: si faltan claves VAPID
// el servidor arranca igual y el push queda deshabilitado (503).
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';

const router = Router();

// Import seguro de web-push (nunca rompe el arranque)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webpush: any = null;
let pushEnabled = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  webpush = require('web-push');
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails('mailto:admin@iphoneculture.com', pub, priv);
    pushEnabled = true;
  }
} catch (err) {
  console.warn('[push] web-push no disponible, notificaciones push deshabilitadas', err);
  webpush = null;
  pushEnabled = false;
}

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (_req, res: Response) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key || !pushEnabled) {
    res.status(503).json({ error: 'Push no configurado' });
    return;
  }
  res.json({ key });
});

// POST /api/push/subscribe — upsert en push_subscriptions (UNIQUE(user_id, endpoint))
router.post('/subscribe', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: 'Suscripción inválida: faltan endpoint o claves' });
      return;
    }
    await db.execute({
      sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (?,?,?,?)
            ON CONFLICT(user_id, endpoint)
            DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      args: [req.user!.id, String(endpoint), String(p256dh), String(auth)],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe]', err);
    res.status(500).json({ error: 'Error al guardar la suscripción' });
  }
});

// POST /api/push/unsubscribe — borra la suscripción del usuario
router.post('/unsubscribe', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      res.status(400).json({ error: 'Falta el endpoint' });
      return;
    }
    await db.execute({
      sql: 'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      args: [req.user!.id, String(endpoint)],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/unsubscribe]', err);
    res.status(500).json({ error: 'Error al eliminar la suscripción' });
  }
});

// POST /api/push/test — admin: envía una notificación de prueba a todas las suscripciones
router.post('/test', authRequired, requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  if (!pushEnabled || !webpush) {
    res.status(503).json({ error: 'Push no configurado' });
    return;
  }
  try {
    const subs = await db.execute({
      sql: 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions',
      args: [],
    });
    const payload = JSON.stringify({
      title: 'Notificaciones activadas ✔',
      body: 'Ya vas a recibir avisos de turnos y mensajes de iPhone Culture.',
      url: '/',
    });
    let enviados = 0;
    let fallidos = 0;
    for (const row of subs.rows) {
      const sub = {
        endpoint: String(row.endpoint),
        keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
      };
      try {
        const r = await webpush.sendNotification(sub, payload);
        console.log(`[push/test] sendNotification → status ${r.statusCode} (${sub.endpoint.slice(0, 60)}…)`);
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        console.warn(`[push/test] fallo (status ${status})`, err);
        fallidos++;
        // Suscripción muerta: limpiar
        if (status === 404 || status === 410) {
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE id = ?', args: [row.id] });
        }
      }
    }
    res.json({ ok: true, enviados, fallidos });
  } catch (err) {
    console.error('[push/test]', err);
    res.status(500).json({ error: 'Error al enviar la notificación de prueba' });
  }
});

export default router;
