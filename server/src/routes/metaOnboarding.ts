import { Router, Response } from 'express';
import { authRequired, requireRole, AuthRequest } from '../auth';
import { db } from '../db';
import { getInstagramConnection, saveInstagramConnection } from '../automation/metaCredentials';

const router = Router();
router.use(authRequired, requireRole('admin'));

type SignupSession = {
  type?: unknown;
  event?: unknown;
  data?: { waba_id?: unknown };
};

const digits = (value: unknown): string | null => {
  const text = String(value ?? '');
  return /^\d{5,30}$/.test(text) ? text : null;
};

async function graphRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Meta respondió HTTP ${response.status}`);
  return body;
}

async function hasInstagramAssetSubscription(
  accountId: string,
  pageId: string,
  token: string,
  appId: string
): Promise<boolean> {
  for (const assetId of [accountId, pageId].filter(Boolean)) {
    try {
      const subscriptions = await graphRequest<{ data?: Array<{ id?: string }> }>(
        `${assetId}/subscribed_apps?fields=id`,
        token
      );
      if (subscriptions.data?.some((item) => String(item.id || '') === appId)) return true;
    } catch {
      // El token puede autorizar solamente uno de los dos activos.
    }
  }
  return false;
}

router.get('/config', (_req: AuthRequest, res: Response) => {
  const appId = process.env.META_APP_ID || '';
  const configurationId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  res.json({
    ready: Boolean(appId && configurationId && process.env.META_APP_SECRET),
    appId,
    configurationId,
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    coexistence: true,
    liveMessages: process.env.ALLOW_LIVE_MESSAGES === 'true',
  });
});

router.get('/instagram/config', async (_req: AuthRequest, res: Response) => {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const configurationId = process.env.META_INSTAGRAM_LOGIN_CONFIG_ID || '';
  const connection = await getInstagramConnection();
  let webhookSubscribed = false;
  if (appId && appSecret) {
    try {
      const subscriptions = await graphRequest<{
        data?: Array<{ object?: string; fields?: Array<{ name?: string }> }>;
      }>(`${appId}/subscriptions`, `${appId}|${appSecret}`);
      const instagram = subscriptions.data?.find((item) => item.object === 'instagram');
      const fields = new Set((instagram?.fields || []).map((field) => String(field.name || '')));
      webhookSubscribed = fields.has('messages') && fields.has('messaging_postbacks');
    } catch {
      // La conexión sigue siendo válida aunque Meta no permita consultar el estado en este momento.
    }
  }
  if (webhookSubscribed && connection) {
    webhookSubscribed = await hasInstagramAssetSubscription(
      connection.accountId,
      connection.pageId,
      connection.token,
      appId
    );
  }
  res.json({
    ready: Boolean(appId && configurationId && appSecret),
    appId,
    configurationId,
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    liveMessages: process.env.ALLOW_LIVE_MESSAGES === 'true',
    connected: Boolean(connection),
    username: connection?.username || null,
    webhookSubscribed,
  });
});

router.post('/instagram/subscribe', async (_req: AuthRequest, res: Response) => {
  const appId = process.env.META_APP_ID || '';
  const connection = await getInstagramConnection();
  if (!appId || !connection) return res.status(409).json({ error: 'Instagram no está conectado' });

  let warning = 'Meta no permitió asociar la cuenta de Instagram con la app';
  const attempts: Array<{ asset: 'instagram' | 'page'; error: string }> = [];
  for (const assetId of [connection.accountId, connection.pageId].filter(Boolean)) {
    try {
      await graphRequest(
        `${assetId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks`,
        connection.token,
        { method: 'POST' }
      );
      return res.json({ ok: true, subscribed: true });
    } catch (error) {
      warning = error instanceof Error ? error.message : warning;
      attempts.push({
        asset: assetId === connection.accountId ? 'instagram' : 'page',
        error: warning,
      });
    }
  }
  res.status(502).json({ error: warning, attempts });
});

router.post('/instagram/complete', async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.ALLOW_LIVE_MESSAGES === 'true') {
      return res.status(409).json({ error: 'Desactivá los mensajes automáticos antes de conectar Instagram' });
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!code || code.length > 4096) return res.status(400).json({ error: 'Código de autorización inválido' });

    const appId = process.env.META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';
    if (!appId || !appSecret) return res.status(503).json({ error: 'Falta completar la configuración segura de Meta' });

    const version = process.env.META_GRAPH_VERSION || 'v26.0';
    const exchangeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    exchangeUrl.searchParams.set('client_id', appId);
    exchangeUrl.searchParams.set('client_secret', appSecret);
    exchangeUrl.searchParams.set('code', code);
    exchangeUrl.searchParams.set(
      'redirect_uri',
      process.env.META_INSTAGRAM_REDIRECT_URI || 'https://iphoneculture-atencion.onrender.com/admin/instagram'
    );
    const exchange = await fetch(exchangeUrl, { signal: AbortSignal.timeout(20_000) });
    const exchangeBody = (await exchange.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (!exchange.ok || !exchangeBody.access_token) {
      throw new Error(exchangeBody.error?.message || 'Meta no pudo intercambiar el código de autorización');
    }

    type Page = {
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    };
    const pageFields = 'id,name,access_token,instagram_business_account{id,username}';
    let pages: { data?: Page[] } = { data: [] };
    try {
      pages = await graphRequest<{ data?: Page[] }>(
        `me/accounts?fields=${pageFields}&limit=100`,
        exchangeBody.access_token
      );
    } catch {
      // Los tokens de usuario del sistema no siempre exponen /me/accounts.
    }
    const businessId = digits(process.env.META_BUSINESS_ID || '336387824995497');
    if (!pages.data?.some((item) => item.instagram_business_account?.id) && businessId) {
      for (const edge of ['owned_pages', 'client_pages']) {
        try {
          const businessPages = await graphRequest<{ data?: Page[] }>(
            `${businessId}/${edge}?fields=${pageFields}&limit=100`,
            exchangeBody.access_token
          );
          pages = { data: [...(pages.data || []), ...(businessPages.data || [])] };
          if (pages.data?.some((item) => item.instagram_business_account?.id)) break;
        } catch {
          // El portfolio puede no tener uno de los dos tipos de relación.
        }
      }
    }
    const configuredPageId = digits(process.env.META_FACEBOOK_PAGE_ID || '112335748460786');
    if (!pages.data?.some((item) => item.instagram_business_account?.id) && configuredPageId) {
      try {
        const configuredPage = await graphRequest<Page>(
          `${configuredPageId}?fields=${pageFields}`,
          exchangeBody.access_token
        );
        pages = { data: [...(pages.data || []), configuredPage] };
      } catch {
        // Business Login puede ocultar la lista de activos; la validación final sigue siendo obligatoria.
      }
    }
    const expectedAccount = digits(process.env.INSTAGRAM_ACCOUNT_ID || '17841451079126644');
    const page = pages.data?.find((item) =>
      item.instagram_business_account?.id && (!expectedAccount || item.instagram_business_account.id === expectedAccount)
    );
    const pageId = digits(page?.id) || configuredPageId;
    let accountId = digits(page?.instagram_business_account?.id) || expectedAccount;
    let username = page?.instagram_business_account?.username || null;
    const pageToken = page?.access_token || exchangeBody.access_token;
    if (!accountId) {
      throw new Error('Meta no devolvió una Página vinculada con una cuenta profesional de Instagram');
    }
    const requestedAccountId = accountId;

    try {
      const verifiedAccount = await graphRequest<{ id?: string; username?: string }>(
        `${accountId}?fields=id,username`,
        pageToken
      );
      accountId = digits(verifiedAccount.id);
      username = verifiedAccount.username || username;
    } catch {
      type DebugToken = {
        data?: {
          app_id?: string;
          is_valid?: boolean;
          scopes?: string[];
          granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
        };
      };
      const debug = await graphRequest<DebugToken>(
        `debug_token?input_token=${encodeURIComponent(pageToken)}`,
        `${appId}|${appSecret}`
      );
      const targetIds = new Set(
        (debug.data?.granular_scopes || []).flatMap((scope) => scope.target_ids || []).map(String)
      );
      const grantedScopes = new Set([
        ...(debug.data?.scopes || []),
        ...(debug.data?.granular_scopes || []).map((scope) => String(scope.scope || '')),
      ]);
      const identifiesSelectedAsset = targetIds.size === 0
        || targetIds.has(requestedAccountId)
        || Boolean(configuredPageId && targetIds.has(configuredPageId))
        || Boolean(businessId && targetIds.has(businessId));
      if (
        !debug.data?.is_valid
        || String(debug.data.app_id || '') !== appId
        || !grantedScopes.has('instagram_manage_messages')
        || !identifiesSelectedAsset
      ) {
        accountId = null;
      } else {
        username = username || process.env.INSTAGRAM_USERNAME || 'iphoneculture_';
      }
    }
    if (!accountId) throw new Error('Meta no pudo validar la cuenta profesional de Instagram');
    await saveInstagramConnection({
      accountId,
      username,
      pageId: pageId || '',
      token: pageToken,
    });

    let subscribed = false;
    let subscriptionWarning: string | null = null;
    try {
      await graphRequest(`${accountId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks`, pageToken, { method: 'POST' });
      subscribed = true;
    } catch (accountSubscriptionError) {
      try {
        if (!pageId) throw accountSubscriptionError;
        await graphRequest(`${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks`, pageToken, { method: 'POST' });
        subscribed = true;
      } catch (pageSubscriptionError) {
        subscriptionWarning = pageSubscriptionError instanceof Error
          ? pageSubscriptionError.message
          : 'Meta no permitió suscribir los mensajes de Instagram';
        console.warn('[instagram-onboarding] Credencial guardada; suscripción pendiente:', subscriptionWarning);
      }
    }

    res.json({
      ok: true,
      accountId,
      username,
      pageName: page?.name || null,
      subscribed,
      subscriptionWarning,
      liveMessages: false,
    });
  } catch (error) {
    console.error('[instagram-onboarding]', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo completar la conexión con Instagram' });
  }
});

router.post('/complete', async (req: AuthRequest, res: Response) => {
  try {
    if (process.env.ALLOW_LIVE_MESSAGES === 'true') {
      return res.status(409).json({ error: 'Desactivá los mensajes automáticos antes de conectar el número' });
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const session = (req.body?.session || {}) as SignupSession;
    const wabaId = digits(session.data?.waba_id);
    if (!code || code.length > 4096) return res.status(400).json({ error: 'Código de autorización inválido' });
    if (session.type !== 'WA_EMBEDDED_SIGNUP' || session.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || !wabaId) {
      return res.status(400).json({ error: 'El alta no confirmó el modo coexistencia' });
    }

    const appId = process.env.META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';
    if (!appId || !appSecret) return res.status(503).json({ error: 'Falta completar la configuración segura de Meta' });

    const version = process.env.META_GRAPH_VERSION || 'v26.0';
    const exchangeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    exchangeUrl.searchParams.set('client_id', appId);
    exchangeUrl.searchParams.set('client_secret', appSecret);
    exchangeUrl.searchParams.set('code', code);
    const exchange = await fetch(exchangeUrl, { signal: AbortSignal.timeout(20_000) });
    const exchangeBody = (await exchange.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (!exchange.ok || !exchangeBody.access_token) {
      throw new Error(exchangeBody.error?.message || 'Meta no pudo intercambiar el código de autorización');
    }
    const businessToken = exchangeBody.access_token;

    await graphRequest(`${wabaId}/subscribed_apps`, businessToken, { method: 'POST' });
    const phones = await graphRequest<{ data?: Array<{ id?: string; display_phone_number?: string }> }>(
      `${wabaId}/phone_numbers?fields=id,display_phone_number,is_on_biz_app,platform_type`,
      businessToken
    );
    const phone = phones.data?.find((item) => digits(item.id));
    const phoneNumberId = digits(phone?.id);
    if (!phoneNumberId) throw new Error('Meta no devolvió el identificador del número conectado');

    const sync: Record<string, boolean> = { contacts: false, history: false };
    for (const [key, syncType] of [['contacts', 'smb_app_state_sync'], ['history', 'history']] as const) {
      try {
        await graphRequest(`${phoneNumberId}/smb_app_data`, businessToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
        });
        sync[key] = true;
      } catch {
        // La persona puede elegir no compartir el historial; no invalida la coexistencia.
      }
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS meta_connection (
        id INTEGER PRIMARY KEY CHECK(id=1),
        waba_id TEXT NOT NULL,
        phone_number_id TEXT NOT NULL,
        business_id TEXT,
        coexistence INTEGER NOT NULL DEFAULT 1,
        connected_at TEXT NOT NULL
      )
    `);
    await db.execute({
      sql: `INSERT INTO meta_connection(id,waba_id,phone_number_id,business_id,coexistence,connected_at)
            VALUES(1,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET waba_id=excluded.waba_id,phone_number_id=excluded.phone_number_id,
              business_id=excluded.business_id,coexistence=1,connected_at=excluded.connected_at`,
      args: [wabaId, phoneNumberId, null, 1, new Date().toISOString()],
    });

    let permanentTokenReady = false;
    const permanentToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (permanentToken) {
      try {
        await graphRequest(`${phoneNumberId}?fields=id`, permanentToken);
        permanentTokenReady = true;
      } catch {
        permanentTokenReady = false;
      }
    }

    res.json({
      ok: true,
      coexistence: true,
      phoneNumberId,
      wabaId,
      sync,
      permanentTokenReady,
      liveMessages: false,
    });
  } catch (error) {
    console.error('[meta-onboarding]', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'No se pudo completar la conexión con Meta' });
  }
});

export default router;
