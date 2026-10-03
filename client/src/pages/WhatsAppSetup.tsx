import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, PageHeader, Spinner } from '../components/ui';

type MetaConfig = {
  ready: boolean;
  appId: string;
  configurationId: string;
  graphVersion: string;
  coexistence: boolean;
  liveMessages: boolean;
};

type SignupSession = {
  type: 'WA_EMBEDDED_SIGNUP';
  event: string;
  data?: { waba_id?: string };
};

type CompleteResult = {
  ok: boolean;
  coexistence: boolean;
  permanentTokenReady: boolean;
  sync: { contacts: boolean; history: boolean };
};

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function WhatsAppSetup() {
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [state, setState] = useState<'idle' | 'waiting' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<CompleteResult | null>(null);
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<SignupSession | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    api.get<MetaConfig>('/api/admin/meta-onboarding/config')
      .then(setConfig)
      .catch((error) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo leer la configuración');
      });
  }, []);

  useEffect(() => {
    if (!config?.ready) return;
    const finish = async () => {
      if (submittingRef.current || !codeRef.current || !sessionRef.current) return;
      submittingRef.current = true;
      setState('saving');
      setMessage('Confirmando la coexistencia con Meta…');
      try {
        const response = await api.post<CompleteResult>('/api/admin/meta-onboarding/complete', {
          code: codeRef.current,
          session: sessionRef.current,
        });
        setResult(response);
        setState('done');
        setMessage('WhatsApp Business quedó conectado sin desactivar la app del celular.');
      } catch (error) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo completar la conexión');
      } finally {
        submittingRef.current = false;
      }
    };

    const receive = (event: MessageEvent) => {
      try {
        const host = new URL(event.origin).hostname;
        if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        sessionRef.current = data as SignupSession;
        if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          setMessage('Coexistencia confirmada; asegurando la conexión…');
          void finish();
        } else if (data.event === 'CANCEL') {
          setState('idle');
          setMessage('El proceso se canceló sin modificar el número.');
        } else if (data.event === 'ERROR') {
          setState('error');
          setMessage('Meta informó un error durante el registro.');
        }
      } catch {
        // Ignorar mensajes ajenos al registro insertado.
      }
    };

    window.addEventListener('message', receive);
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
    return () => window.removeEventListener('message', receive);
  }, [config]);

  const launch = () => {
    if (!config || !window.FB) return;
    codeRef.current = null;
    sessionRef.current = null;
    setResult(null);
    setState('waiting');
    setMessage('Completá el proceso de Meta y elegí conectar la cuenta existente de WhatsApp Business.');
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setState('idle');
          setMessage('El proceso se cerró sin autorizar cambios.');
          return;
        }
        codeRef.current = code;
        if (sessionRef.current?.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          // El evento y el callback pueden llegar en cualquier orden.
          setState('saving');
          void api.post<CompleteResult>('/api/admin/meta-onboarding/complete', { code, session: sessionRef.current })
            .then((response) => {
              setResult(response);
              setState('done');
              setMessage('WhatsApp Business quedó conectado sin desactivar la app del celular.');
            })
            .catch((error) => {
              setState('error');
              setMessage(error instanceof Error ? error.message : 'No se pudo completar la conexión');
            });
        }
      },
      {
        config_id: config.configurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
  };

  if (!config && state !== 'error') return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conectar WhatsApp Business"
        subtitle="Modo coexistencia: el número sigue funcionando en el celular"
        actions={<Badge color="success">Sin respuestas automáticas</Badge>}
      />
      <Card>
        <div className="flex items-start gap-4">
          <ShieldCheck className="h-8 w-8 text-neon shrink-0" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Tu cuenta actual se conserva</h2>
            <p className="text-slate-300">Este proceso no migra ni desconecta el número. Meta lo conecta a la API y mantiene WhatsApp Business disponible en el teléfono.</p>
            <p className="text-sm text-amber-300">Durante el proceso elegí “Conectar una cuenta existente de WhatsApp Business”. Nunca elijas migrar o desconectar.</p>
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-neon" />
            <div>
              <div className="font-semibold text-white">Registro seguro de Meta</div>
              <div className="text-sm text-slate-400">El código temporal se intercambia únicamente en el servidor y nunca se muestra ni se guarda en el navegador.</div>
            </div>
          </div>
          {!config?.ready && <p className="text-amber-300">Falta completar la configuración del servidor antes de iniciar.</p>}
          <Button onClick={launch} disabled={!config?.ready || !sdkReady || state === 'waiting' || state === 'saving' || state === 'done'}>
            {state === 'saving' ? 'Confirmando…' : state === 'done' ? 'Conectado' : 'Conectar cuenta existente'}
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
              <div>App del celular: activa</div>
              <div>Contactos: {result.sync.contacts ? 'sincronización iniciada' : 'pendiente'}</div>
              <div>Historial: {result.sync.history ? 'sincronización iniciada' : 'no compartido o pendiente'}</div>
              <div>Token permanente: {result.permanentTokenReady ? 'verificado' : 'requiere asignar el nuevo activo'}</div>
              <div>Respuestas automáticas: desactivadas</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
