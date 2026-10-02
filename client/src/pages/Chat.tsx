// ============================================================
// pages/Chat.tsx — Chat interno (canal "Equipo" + DMs 1-a-1)
// Todos los roles chatean. Sin websockets: polling del hilo
// activo cada 5s y de /api/chat/unread cada 10s. Al abrir un
// hilo se hace POST /api/chat/leer.
// Layout: columna izquierda = conversaciones (Equipo fijada
// arriba + usuarios con badge de rol y contador de no leídos),
// derecha = hilo activo con burbujas (propias derecha/neon,
// ajenas izquierda/oscuras) + composer (Enter envía).
// Mobile: lista O hilo con botón de volver.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ArrowLeft, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, Card, Badge, Input, cn } from '../components/ui';

// ---------- Tipos ----------
interface ChatUsuario {
  id: number;
  nombre: string;
  rol: 'admin' | 'oficina' | 'closer';
}

interface ChatMensaje {
  id: number;
  de_id: number;
  para_id: number | null;
  texto: string;
  created_at: string;
  de_nombre?: string | null;
}

interface Unread {
  general: number;
  dms: Record<string, number>;
}

// Conversación activa: canal general o DM con otro usuario
type Hilo = { tipo: 'general' } | { tipo: 'dm'; otroId: number };

const rolBadgeColor: Record<ChatUsuario['rol'], 'amber' | 'violet' | 'neon'> = {
  admin: 'amber',
  oficina: 'violet',
  closer: 'neon',
};

const rolLabel: Record<ChatUsuario['rol'], string> = {
  admin: 'Admin',
  oficina: 'Oficina',
  closer: 'Closer',
};

const conversacionKey = (h: Hilo): string => (h.tipo === 'general' ? 'general' : `dm:${h.otroId}`);

function fmtHora(iso: string): string {
  const d = new Date(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDia(iso: string): string {
  const d = new Date(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function mismoDia(a: string, b: string): boolean {
  return fmtDia(a) === fmtDia(b);
}

// ============================================================
export default function Chat() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<ChatUsuario[]>([]);
  const [unread, setUnread] = useState<Unread>({ general: 0, dms: {} });
  const [hilo, setHilo] = useState<Hilo>({ tipo: 'general' });
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Mobile: false = lista, true = hilo
  const [mobileHilo, setMobileHilo] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ---------- Usuarios ----------
  useEffect(() => {
    api
      .get<ChatUsuario[]>('/api/chat/usuarios')
      .then((data) => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => setUsuarios([]));
  }, []);

  // ---------- Unread (poll 10s) ----------
  const fetchUnread = useCallback(async () => {
    try {
      const data = await api.get<Unread>('/api/chat/unread');
      setUnread(data);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    void fetchUnread();
    const interval = setInterval(() => void fetchUnread(), 10_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // ---------- Hilo activo (poll 5s) ----------
  const fetchHilo = useCallback(async () => {
    try {
      const path = hilo.tipo === 'general' ? '/api/chat/general' : `/api/chat/dm/${hilo.otroId}`;
      const data = await api.get<ChatMensaje[]>(path);
      setMensajes(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando mensajes');
    }
  }, [hilo]);

  useEffect(() => {
    setMensajes([]);
    void fetchHilo();
    const interval = setInterval(() => void fetchHilo(), 5_000);
    return () => clearInterval(interval);
  }, [fetchHilo]);

  // Marcar leído al abrir un hilo y cuando llegan mensajes nuevos
  useEffect(() => {
    if (mensajes.length === 0) return;
    api
      .post('/api/chat/leer', { conversacion: conversacionKey(hilo) })
      .then(() => void fetchUnread())
      .catch(() => undefined);
  }, [hilo, mensajes, fetchUnread]);

  // Scroll al final cuando cambian los mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ---------- Acciones ----------
  const abrirHilo = (h: Hilo) => {
    setHilo(h);
    setMobileHilo(true);
    api
      .post('/api/chat/leer', { conversacion: conversacionKey(h) })
      .then(() => void fetchUnread())
      .catch(() => undefined);
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      await api.post('/api/chat', {
        para_id: hilo.tipo === 'dm' ? hilo.otroId : null,
        texto: t,
      });
      setTexto('');
      await fetchHilo();
      void fetchUnread();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error enviando mensaje');
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Datos derivados ----------
  const otros = usuarios.filter((u) => u.id !== user?.id);
  const tituloHilo =
    hilo.tipo === 'general'
      ? '💬 Equipo'
      : usuarios.find((u) => u.id === hilo.otroId)?.nombre ?? `Usuario #${hilo.otroId}`;
  const totalUnreadGeneral = unread.general;
  const unreadDe = (id: number) => unread.dms[String(id)] ?? 0;

  // ---------- Lista de conversaciones ----------
  const lista = (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Conversaciones</p>
      <div className="flex flex-col gap-1 overflow-y-auto min-h-0 flex-1">
        {/* Canal general fijado arriba */}
        <button
          onClick={() => abrirHilo({ tipo: 'general' })}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
            hilo.tipo === 'general'
              ? 'bg-neon/10 text-neon border-neon/40 shadow-glow'
              : 'text-slate-300 border-transparent hover:bg-neon/5 hover:text-neon'
          )}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-sm font-semibold truncate">💬 Equipo</span>
          {totalUnreadGeneral > 0 && (
            <span className="min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">
              {totalUnreadGeneral > 99 ? '99+' : totalUnreadGeneral}
            </span>
          )}
        </button>

        {otros.map((u) => {
          const activo = hilo.tipo === 'dm' && hilo.otroId === u.id;
          const n = unreadDe(u.id);
          return (
            <button
              key={u.id}
              onClick={() => abrirHilo({ tipo: 'dm', otroId: u.id })}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border',
                activo
                  ? 'bg-neon/10 text-neon border-neon/40 shadow-glow'
                  : 'text-slate-300 border-transparent hover:bg-neon/5 hover:text-neon'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-neon-grad flex items-center justify-center font-extrabold text-base-900 shrink-0 text-sm">
                {u.nombre.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{u.nombre}</p>
                <Badge color={rolBadgeColor[u.rol]}>{rolLabel[u.rol]}</Badge>
              </div>
              {n > 0 && (
                <span className="min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---------- Hilo ----------
  const hiloView = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header del hilo */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/40">
        <button
          onClick={() => setMobileHilo(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-neon hover:bg-neon/5 transition-all"
          aria-label="Volver a la lista"
        >
          <ArrowLeft size={18} />
        </button>
        <p className="text-sm font-extrabold text-slate-100 truncate">{tituloHilo}</p>
        {hilo.tipo === 'dm' && (
          <Badge color={rolBadgeColor[usuarios.find((u) => u.id === hilo.otroId)?.rol ?? 'closer']}>
            {rolLabel[usuarios.find((u) => u.id === hilo.otroId)?.rol ?? 'closer']}
          </Badge>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-2">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {mensajes.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Todavía no hay mensajes. ¡Empezá la conversación!</p>
          </div>
        )}
        {mensajes.map((m, i) => {
          const propio = m.de_id === user?.id;
          const separadorDia = i === 0 || !mismoDia(mensajes[i - 1].created_at, m.created_at);
          return (
            <div key={m.id}>
              {separadorDia && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 border-t border-slate-700/40" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{fmtDia(m.created_at)}</span>
                  <div className="flex-1 border-t border-slate-700/40" />
                </div>
              )}
              <div className={cn('flex', propio ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                    propio
                      ? 'bg-neon/15 text-neon border border-neon/40 shadow-glow rounded-br-sm'
                      : 'bg-base-700 text-slate-200 border border-slate-600/30 rounded-bl-sm'
                  )}
                >
                  <p className={cn('text-[10px] font-semibold mb-0.5', propio ? 'text-neon/70' : 'text-slate-400')}>
                    {propio ? 'Vos' : (m.de_nombre ?? '—')} · {fmtHora(m.created_at)}
                  </p>
                  {m.texto}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          placeholder="Escribí un mensaje… (Enter para enviar)"
          maxLength={2000}
          className="flex-1"
        />
        <button
          onClick={() => void enviar()}
          disabled={enviando || !texto.trim()}
          className="p-2.5 rounded-xl bg-neon/15 border border-neon/50 text-neon hover:bg-neon/25 transition-all disabled:opacity-40 shadow-glow shrink-0"
          aria-label="Enviar mensaje"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );

  // ---------- Render ----------
  return (
    <div>
      <PageHeader title="Chat" subtitle="Comunicación interna del equipo — canal general y mensajes directos" />

      {/* Desktop: dos columnas. Mobile: lista O hilo. */}
      <div className="hidden md:grid md:grid-cols-[280px_1fr] gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        <Card className="min-h-0 overflow-hidden">{lista}</Card>
        <Card className="min-h-0 overflow-hidden">{hiloView}</Card>
      </div>

      <div className="md:hidden" style={{ height: 'calc(100vh - 220px)' }}>
        <Card className="h-full min-h-0 overflow-hidden">{mobileHilo ? hiloView : lista}</Card>
      </div>
    </div>
  );
}
