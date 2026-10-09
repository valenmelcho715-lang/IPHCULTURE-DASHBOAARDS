import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Instagram, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, PageHeader, Spinner } from '../components/ui';

type MetaConfig = {
  ready: boolean;
  appId: string;
  configurationId: string;
  graphVersion: string;
  liveMessages: boolean;
  connected: boolean;
  username: string | null;
  webhookSubscribed: boolean;
};

type CompleteResult = {
  ok: boolean;
  username: string | null;
  pageName: string | null;
  subscribed: boolean;
  subscriptionWarning: string | null;
  liveMessages: false;
};

export default function InstagramSetup() {
  const { user } = useAuth();
  const isMetaReviewer = user?.email === 'meta-review@iphoneculture.com';
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [state, setState] = useState<'idle' | 'waiting' | 'saving' | 'subscribing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<CompleteResult | null>(null);
  const callbackStarted = useRef(false);

  useEffect(() => {
    api.get<MetaConfig>('/api/admin/meta-onboarding/instagram/config')
      .then((value) => {
        setConfig(value);
        if (value.connected) {
          setState('done');
          setMessage(value.webhookSubscribed
            ? (isMetaReviewer ? 'Instagram is connected and ready to receive messages.' : 'Instagram está conectado y preparado para recibir mensajes.')
            : (isMetaReviewer ? 'The credential is stored. Meta Webhooks still needs message reception enabled.' : 'La credencial está guardada. Falta habilitar la recepción en Webhooks de Meta.'));
        }
      })
      .catch((error) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo leer la configuración');
      });
  }, [isMetaReviewer]);

  useEffect(() => {
    if (!config?.ready || callbackStarted.current) return;
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    const returnedState = query.get('state');
    const expectedState = sessionStorage.getItem('instagram_oauth_state');
    const error = query.get('error_description') || query.get('error_message');
    if (error) {
      callbackStarted.current = true;
      setState('error');
      setMessage(error);
      window.history.replaceState({}, '', '/admin/instagram');
      return;
    }
    if (!code) return;
    callbackStarted.current = true;
    window.history.replaceState({}, '', '/admin/instagram');
    if (!expectedState || returnedState !== expectedState) {
      setState('error');
      setMessage(isMetaReviewer
        ? 'Meta returned an authorization that does not match this session. Please try again.'
        : 'Meta devolvió una autorización que no coincide con esta sesión. Volvé a intentarlo.');
      return;
    }
    sessionStorage.removeItem('instagram_oauth_state');
    setState('saving');
    setMessage(isMetaReviewer
      ? 'Verifying the linked Page, Instagram account, and Webhooks…'
      : 'Verificando la Página, Instagram y los webhooks…');
    void api.post<CompleteResult>('/api/admin/meta-onboarding/instagram/complete', { code })
      .then((value) => {
        setResult(value);
        setState('done');
        setMessage(value.subscribed
          ? (isMetaReviewer ? 'Instagram is connected and ready to receive messages.' : 'Instagram quedó conectado y preparado para recibir mensajes.')
          : (isMetaReviewer ? 'The credential is stored. Meta Webhooks still needs message reception enabled.' : 'La credencial quedó guardada. Falta habilitar la recepción en Webhooks de Meta.'));
      })
      .catch((requestError) => {
        setState('error');
        setMessage(requestError instanceof Error ? requestError.message : 'No se pudo completar la conexión');
      });
  }, [config, isMetaReviewer]);

  const launch = () => {
    if (!config) return;
    setState('waiting');
    setMessage(isMetaReviewer
      ? 'Opening Meta to select the linked Facebook Page and Instagram professional account…'
      : 'Abriendo Meta para elegir la Página IPHONE Culture Neuquén y @iphoneculture_…');
    setResult(null);
    const stateValue = crypto.randomUUID();
    sessionStorage.setItem('instagram_oauth_state', stateValue);
    const redirectUri = `${window.location.origin}/admin/instagram`;
    const dialog = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
    dialog.searchParams.set('client_id', config.appId);
    dialog.searchParams.set('redirect_uri', redirectUri);
    dialog.searchParams.set('config_id', config.configurationId);
    dialog.searchParams.set('response_type', 'code');
    dialog.searchParams.set('override_default_response_type', 'true');
    dialog.searchParams.set('state', stateValue);
    window.location.assign(dialog.toString());
  };

  const subscribe = () => {
    setState('subscribing');
    setMessage(isMetaReviewer ? 'Enabling message reception in Meta…' : 'Activando la recepción de mensajes en Meta…');
    void api.post<{ ok: boolean; subscribed: boolean }>('/api/admin/meta-onboarding/instagram/subscribe', {})
      .then((value) => {
        if (!value.subscribed) throw new Error('Meta todavía no confirmó la suscripción');
        setConfig((current) => current ? { ...current, webhookSubscribed: true } : current);
        setResult((current) => current ? { ...current, subscribed: true, subscriptionWarning: null } : current);
        setState('done');
        setMessage(isMetaReviewer
          ? 'Instagram is connected and ready to receive messages.'
          : 'Instagram está conectado y preparado para recibir mensajes.');
      })
      .catch((requestError) => {
        setState('error');
        setMessage(requestError instanceof Error ? requestError.message : 'No se pudo activar la recepción de Instagram');
      });
  };

  const connection = result || (config?.connected ? {
    username: config.username,
    pageName: null,
    subscribed: config.webhookSubscribed,
  } : null);

  if (!config && state !== 'error') return <Spinner />;

  const copy = isMetaReviewer ? {
    title: 'Connect Instagram messages',
    subtitle: 'Meta authorization through the linked Facebook Page',
    safe: 'Automatic replies are OFF',
    review: 'Meta App Review environment: this account is restricted to the Instagram connection flow.',
    noLogin: 'Authorize the professional Instagram account',
    auth: 'Use Facebook Login and select the Page linked to the Instagram professional account.',
    secret: 'The access token is encrypted on the server and is never displayed in the browser.',
    direct: 'Instagram Direct',
    directHelp: 'Receives Instagram DMs and allows a team member to reply. Automatic replies remain disabled.',
    missing: 'The secure Meta configuration is incomplete on the server.',
    connect: state === 'saving' ? 'Verifying…' : state === 'done' ? 'Reconnect with Meta' : 'Continue with Facebook',
    activating: state === 'subscribing' ? 'Enabling message reception…' : 'Enable message reception',
    prepared: 'Connection status',
    instagram: 'Instagram',
    page: 'Linked Page',
    professional: 'verified professional account',
    verifiedPage: 'verified linked Page',
    reception: 'Message reception',
    subscribed: 'enabled',
    pending: 'pending',
    automation: 'Automatic replies',
    disabled: 'disabled',
  } : {
    title: 'Conectar mensajes de Instagram',
    subtitle: 'Autorización mediante Facebook y la Página vinculada',
    safe: 'Sin respuestas automáticas',
    review: 'Entorno de revisión de Meta: esta cuenta solo puede acceder a la conexión de Instagram.',
    noLogin: 'No necesitás iniciar sesión directamente en Instagram',
    auth: 'Meta autoriza la cuenta profesional a través de tu Facebook y de la Página IPHONE Culture Neuquén.',
    secret: 'La credencial queda cifrada en el servidor y nunca se muestra en el navegador.',
    direct: 'Instagram Direct',
    directHelp: 'Conecta recepción y respuesta manual; la automatización permanece apagada.',
    missing: 'Falta completar la configuración de Meta en el servidor.',
    connect: state === 'saving' ? 'Verificando…' : state === 'done' ? 'Conectado' : 'Conectar con Facebook',
    activating: state === 'subscribing' ? 'Activando recepción…' : 'Activar recepción de mensajes',
    prepared: 'Conexión preparada',
    instagram: 'Instagram',
    page: 'Página',
    professional: 'cuenta profesional verificada',
    verifiedPage: 'Página vinculada verificada',
    reception: 'Recepción de mensajes',
    subscribed: 'suscrita',
    pending: 'pendiente',
    automation: 'Respuestas automáticas',
    disabled: 'desactivadas',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={<Badge color="success">{copy.safe}</Badge>}
      />
      {isMetaReviewer && (
        <Card>
          <p className="text-sm text-slate-300">
            {copy.review}
          </p>
        </Card>
      )}
      <Card>
        <div className="flex items-start gap-4">
          <ShieldCheck className="h-8 w-8 text-neon shrink-0" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">{copy.noLogin}</h2>
            <p className="text-slate-300">{copy.auth}</p>
            <p className="text-sm text-slate-400">{copy.secret}</p>
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Instagram className="h-6 w-6 text-fuchsia-400" />
            <div>
              <div className="font-semibold text-white">{copy.direct}</div>
              <div className="text-sm text-slate-400">{copy.directHelp}</div>
            </div>
          </div>
          {!config?.ready && <p className="text-amber-300">{copy.missing}</p>}
          <Button onClick={launch} disabled={!config?.ready || state === 'waiting' || state === 'saving' || (state === 'done' && !isMetaReviewer)}>
            {isMetaReviewer && state === 'done' ? 'Reconnect with Meta' : copy.connect}
          </Button>
          {config?.connected && !config.webhookSubscribed && !isMetaReviewer && (
            <Button
              variant="success"
              onClick={subscribe}
              disabled={state === 'subscribing'}
            >
              {copy.activating}
            </Button>
          )}
          {message && <p className={state === 'error' ? 'text-red-300' : 'text-slate-300'}>{message}</p>}
        </div>
      </Card>
      {connection && (
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
            <div className="space-y-1 text-slate-300">
              <div className="font-semibold text-white">{copy.prepared}</div>
              <div>{copy.instagram}: {connection.username ? `@${connection.username}` : copy.professional}</div>
              <div>{copy.page}: {connection.pageName || copy.verifiedPage}</div>
              <div>{copy.reception}: {connection.subscribed ? copy.subscribed : copy.pending}</div>
              <div>{copy.automation}: {copy.disabled}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
