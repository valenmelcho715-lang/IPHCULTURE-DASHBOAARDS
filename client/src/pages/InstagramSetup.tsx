import { useEffect, useState } from 'react';
import { CheckCircle2, Instagram, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, PageHeader, Spinner } from '../components/ui';

type MetaConfig = {
  ready: boolean;
  appId: string;
  configurationId: string;
  graphVersion: string;
  liveMessages: boolean;
};

type CompleteResult = {
  ok: boolean;
  username: string | null;
  pageName: string | null;
  subscribed: boolean;
  liveMessages: false;
};

export default function InstagramSetup() {
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [state, setState] = useState<'idle' | 'waiting' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<CompleteResult | null>(null);

  useEffect(() => {
    api.get<MetaConfig>('/api/admin/meta-onboarding/instagram/config')
      .then(setConfig)
      .catch((error) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo leer la configuración');
      });
  }, []);

  useEffect(() => {
    if (!config?.ready) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: config.appId, autoLogAppEvents: true, xfbml: true, version: config.graphVersion });
      setSdkReady(true);
    };
    if (window.FB) window.fbAsyncInit();
    else if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      document.body.appendChild(script);
    }
  }, [config]);

  const launch = () => {
    if (!config || !window.FB) return;
    setState('waiting');
    setMessage('Elegí la Página IPHONE Culture Neuquén y la cuenta @iphoneculture_.');
    setResult(null);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setState('idle');
          setMessage('La ventana se cerró sin autorizar la conexión.');
          return;
        }
        setState('saving');
        setMessage('Verificando la Página, Instagram y los webhooks…');
        void api.post<CompleteResult>('/api/admin/meta-onboarding/instagram/complete', { code })
          .then((value) => {
            setResult(value);
            setState('done');
            setMessage('Instagram quedó conectado y preparado para recibir mensajes.');
          })
          .catch((error) => {
            setState('error');
            setMessage(error instanceof Error ? error.message : 'No se pudo completar la conexión');
          });
      },
      {
        config_id: config.configurationId,
        response_type: 'code',
        override_default_response_type: true,
      }
    );
  };

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
          <Button onClick={launch} disabled={!config?.ready || !sdkReady || state === 'waiting' || state === 'saving' || state === 'done'}>
            {state === 'saving' ? 'Verificando…' : state === 'done' ? 'Conectado' : 'Conectar con Facebook'}
          </Button>
          {message && <p className={state === 'error' ? 'text-red-300' : 'text-slate-300'}>{message}</p>}
        </div>
      </Card>
      {result && (
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
            <div className="space-y-1 text-slate-300">
              <div className="font-semibold text-white">Conexión preparada</div>
              <div>Instagram: {result.username ? `@${result.username}` : 'cuenta profesional verificada'}</div>
              <div>Página: {result.pageName || 'Página vinculada verificada'}</div>
              <div>Recepción de mensajes: {result.subscribed ? 'suscrita' : 'pendiente'}</div>
              <div>Respuestas automáticas: desactivadas</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
