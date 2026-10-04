import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Instagram, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
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
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [state, setState] = useState<'idle' | 'waiting' | 'saving' | 'done' | 'error'>('idle');
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
            ? 'Instagram está conectado y preparado para recibir mensajes.'
            : 'La credencial está guardada. Falta habilitar la recepción en Webhooks de Meta.');
        }
      })
      .catch((error) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo leer la configuración');
      });
  }, []);

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
      setMessage('Meta devolvió una autorización que no coincide con esta sesión. Volvé a intentarlo.');
      return;
    }
    sessionStorage.removeItem('instagram_oauth_state');
    setState('saving');
    setMessage('Verificando la Página, Instagram y los webhooks…');
    void api.post<CompleteResult>('/api/admin/meta-onboarding/instagram/complete', { code })
      .then((value) => {
        setResult(value);
        setState('done');
        setMessage(value.subscribed
          ? 'Instagram quedó conectado y preparado para recibir mensajes.'
          : 'La credencial quedó guardada. Falta habilitar la recepción en Webhooks de Meta.');
      })
      .catch((requestError) => {
        setState('error');
        setMessage(requestError instanceof Error ? requestError.message : 'No se pudo completar la conexión');
      });
  }, [config]);

  const launch = () => {
    if (!config) return;
    setState('waiting');
    setMessage('Abriendo Meta para elegir la Página IPHONE Culture Neuquén y @iphoneculture_…');
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

  const connection = result || (config?.connected ? {
    username: config.username,
    pageName: null,
    subscribed: config.webhookSubscribed,
  } : null);

  if (!config && state !== 'error') return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conectar mensajes de Instagram"
        subtitle="Autorización mediante Facebook y la Página vinculada"
        actions={<Badge color="success">Sin respuestas automáticas</Badge>}
      />
      <Card>
        <div className="flex items-start gap-4">
          <ShieldCheck className="h-8 w-8 text-neon shrink-0" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">No necesitás iniciar sesión directamente en Instagram</h2>
            <p className="text-slate-300">Meta autoriza la cuenta profesional a través de tu Facebook y de la Página IPHONE Culture Neuquén.</p>
            <p className="text-sm text-slate-400">La credencial queda cifrada en el servidor y nunca se muestra en el navegador.</p>
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Instagram className="h-6 w-6 text-fuchsia-400" />
            <div>
              <div className="font-semibold text-white">Instagram Direct</div>
              <div className="text-sm text-slate-400">Conecta recepción y respuesta manual; la automatización permanece apagada.</div>
            </div>
          </div>
          {!config?.ready && <p className="text-amber-300">Falta completar la configuración de Meta en el servidor.</p>}
          <Button onClick={launch} disabled={!config?.ready || state === 'waiting' || state === 'saving' || state === 'done'}>
            {state === 'saving' ? 'Verificando…' : state === 'done' ? 'Conectado' : 'Conectar con Facebook'}
          </Button>
          {message && <p className={state === 'error' ? 'text-red-300' : 'text-slate-300'}>{message}</p>}
        </div>
      </Card>
      {connection && (
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
            <div className="space-y-1 text-slate-300">
              <div className="font-semibold text-white">Conexión preparada</div>
              <div>Instagram: {connection.username ? `@${connection.username}` : 'cuenta profesional verificada'}</div>
              <div>Página: {connection.pageName || 'Página vinculada verificada'}</div>
              <div>Recepción de mensajes: {connection.subscribed ? 'suscrita' : 'pendiente'}</div>
              <div>Respuestas automáticas: desactivadas</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
