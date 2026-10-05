// ============================================================
// components/Layout.tsx — Frontend_Login_Layout
// Shell principal: sidebar dark neon + topbar con notificaciones.
// Contrato: NO recibe props; renderiza <Outlet/> de react-router-dom.
// - Sidebar: logo glow, links con iconos lucide, activo con bg-neon/10
//   + borde neon + glow, card de usuario con Badge de rol y logout.
// - Topbar: título según ruta, campana con no leídos (dropdown marca
//   leído vía PUT /api/mensajes/:id/leido), indicador de próximos
//   turnos (urgente → rojo pulsante, pronto → amber). Polling 60s.
// - Responsive: sidebar overlay con hamburger en <md.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Calendar,
  Users,
  Calculator,
  Grid3x3,
  Package,
  Settings,
  LogOut,
  Bell,
  BellRing,
  BellOff,
  Menu,
  X,
  Clock,
  Smartphone,
  Repeat,
  MessageCircle,
  Trophy,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, fmtFecha } from '../lib/api';
import { activarPush, desactivarPush, estadoPush, pushSoportado, type PushEstado } from '../lib/push';
import { Badge, cn } from './ui';

// ------------------------------------------------------------
// Tipos de datos que consumen los endpoints
// ------------------------------------------------------------
interface Mensaje {
  id: number;
  titulo: string | null;
  contenido: string | null;
  leido: number;
  created_at: string;
  autor_nombre?: string | null;
  closer_nombre?: string | null;
}

interface TurnoProximo {
  id: number;
  cliente_nombre: string | null;
  fecha_hora: string | null;
  motivo: string | null;
  alerta: 'urgente' | 'pronto' | null;
  closer_nombre?: string | null;
}

type Rol = 'admin' | 'oficina' | 'closer';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Rol[];
}

const links: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'oficina', 'closer'] },
  { to: '/atencion', label: 'Atención IA', icon: MessageCircle, roles: ['admin', 'oficina', 'closer'] },
  { to: '/ventas', label: 'Ventas', icon: ShoppingBag, roles: ['admin', 'oficina', 'closer'] },
  { to: '/canjes', label: 'Canjes', icon: Repeat, roles: ['admin', 'oficina', 'closer'] },
  { to: '/chat', label: 'Chat', icon: MessageCircle, roles: ['admin', 'oficina', 'closer'] },
  { to: '/facturas', label: 'Facturas', icon: FileText, roles: ['admin', 'oficina', 'closer'] },
  { to: '/turnos', label: 'Turnos', icon: Calendar, roles: ['admin', 'oficina', 'closer'] },
  { to: '/leads', label: 'Leads', icon: Users, roles: ['admin', 'oficina', 'closer'] },
  { to: '/cuotero', label: 'Cuotero', icon: Calculator, roles: ['admin', 'oficina', 'closer'] },
  { to: '/catalogo', label: 'Catálogo', icon: Grid3x3, roles: ['admin', 'oficina', 'closer'] },
  { to: '/stock', label: 'Stock', icon: Package, roles: ['admin', 'oficina', 'closer'] },
  { to: '/bonos', label: 'Bonos', icon: Trophy, roles: ['admin', 'oficina', 'closer'] },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'oficina'] },
  { to: '/admin', label: 'Admin', icon: Settings, roles: ['admin', 'oficina'] },
];

const rolBadgeColor: Record<Rol, 'amber' | 'violet' | 'neon'> = {
  admin: 'amber',
  oficina: 'violet',
  closer: 'neon',
};

const rolLabel: Record<Rol, string> = {
  admin: 'Admin',
  oficina: 'Oficina',
  closer: 'Closer',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [turnos, setTurnos] = useState<TurnoProximo[]>([]);
  const [pushEstado, setPushEstado] = useState<PushEstado>('desactivado');
  const [pushCargando, setPushCargando] = useState(false);

  // Responder a Oficina (solo closers)
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTitulo, setReplyTitulo] = useState('');
  const [replyContenido, setReplyContenido] = useState('');
  const [replyEnviando, setReplyEnviando] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const responderOficina = async () => {
    if (!replyContenido.trim()) return;
    setReplyEnviando(true);
    setReplyError(null);
    try {
      await api.post('/api/mensajes', {
        para_oficina: true,
        titulo: replyTitulo.trim(),
        contenido: replyContenido.trim(),
      });
      setReplyTitulo('');
      setReplyContenido('');
      setReplyOpen(false);
      void fetchNotificaciones();
    } catch (e) {
      setReplyError((e as Error).message || 'No se pudo enviar la respuesta');
    } finally {
      setReplyEnviando(false);
    }
  };

  // ----------------------------------------------------------
  // Estado de notificaciones push (web push, opcional por usuario)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    void estadoPush().then(setPushEstado);
  }, [user]);

  const togglePush = async () => {
    if (pushCargando) return;
    setPushCargando(true);
    try {
      if (pushEstado === 'activado') {
        await desactivarPush();
        setPushEstado('desactivado');
      } else {
        await activarPush();
        setPushEstado(await estadoPush());
      }
    } catch (e) {
      alert((e as Error).message || 'No se pudieron activar las notificaciones');
      setPushEstado(await estadoPush());
    } finally {
      setPushCargando(false);
    }
  };

  // ----------------------------------------------------------
  // Polling de mensajes y próximos turnos (cada 60s)
  // ----------------------------------------------------------
  const fetchNotificaciones = useCallback(async () => {
    try {
      const [ms, ts] = await Promise.all([
        api.get<Mensaje[]>('/api/mensajes'),
        api.get<TurnoProximo[]>('/api/turnos/proximos'),
      ]);
      setMensajes(Array.isArray(ms) ? ms : []);
      setTurnos(Array.isArray(ts) ? ts : []);
    } catch {
      // silencioso: la topbar no debe romper la navegación
    }
  }, []);

  useEffect(() => {
    void fetchNotificaciones();
    const interval = setInterval(() => void fetchNotificaciones(), 60_000);
    return () => clearInterval(interval);
  }, [fetchNotificaciones]);

  // ----------------------------------------------------------
  // Polling de chat no leídos (cada 15s) → badge rojo en el nav
  // ----------------------------------------------------------
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetchChatUnread = async () => {
      try {
        const u = await api.get<{ general: number; dms: Record<string, number> }>('/api/chat/unread');
        const dms = Object.values(u.dms || {}).reduce((a, b) => a + b, 0);
        setChatUnread((u.general || 0) + dms);
      } catch {
        // silencioso
      }
    };
    void fetchChatUnread();
    const interval = setInterval(() => void fetchChatUnread(), 15_000);
    return () => clearInterval(interval);
  }, [user]);

  // Cerrar sidebar mobile al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
    setBellOpen(false);
  }, [location.pathname]);

  const noLeidos = mensajes.filter((m) => !m.leido).length;
  const hayUrgente = turnos.some((t) => t.alerta === 'urgente');
  const hayPronto = !hayUrgente && turnos.some((t) => t.alerta === 'pronto');
  const turnosAlerta = turnos.filter((t) => t.alerta === 'urgente' || t.alerta === 'pronto');

  const marcarLeido = async (m: Mensaje) => {
    if (m.leido) return;
    // Optimista + refresco desde el server
    setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, leido: 1 } : x)));
    try {
      await api.put(`/api/mensajes/${m.id}/leido`);
    } catch {
      // admin/oficina no pueden marcar mensajes ajenos: ignorar
    }
    void fetchNotificaciones();
  };

  // Título de la sección actual derivado de la ruta
  const seccion =
    links.find((l) => (l.to === '/' ? location.pathname === '/' : location.pathname.startsWith(l.to)))?.label ??
    'Panel';

  const inicial = user?.nombre?.trim().charAt(0).toUpperCase() || '?';

  // ----------------------------------------------------------
  // Sidebar (compartida entre desktop fija y mobile overlay)
  // ----------------------------------------------------------
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-neon-grad flex items-center justify-center shadow-glow shrink-0">
          <Smartphone className="w-5 h-5 text-base-900" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="font-extrabold text-neon glow-text leading-tight truncate">iPhone Culture</p>
          <p className="text-[11px] text-slate-500">Neuquén · Panel de ventas</p>
        </div>
      </div>

      {/* Links */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {(user?.email === 'meta-review@iphoneculture.com'
          ? [{ to: '/admin/instagram', label: 'Instagram', icon: MessageCircle, roles: ['admin'] as Rol[] }]
          : links)
          .filter((l) => user && l.roles.includes(user.rol))
          .map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border border-transparent',
                    isActive
                      ? 'bg-neon/10 text-neon border-neon/40 shadow-glow'
                      : 'text-slate-400 hover:text-neon hover:bg-neon/5'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{l.label}</span>
                {l.to === '/chat' && chatUnread > 0 && (
                  <span className="min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </NavLink>
            );
          })}
      </nav>

      {/* Card de usuario + logout */}
      <div className="glass p-3 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-neon-grad flex items-center justify-center font-extrabold text-base-900 shrink-0">
            {inicial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.nombre}</p>
            {user && <Badge color={rolBadgeColor[user.rol]}>{rolLabel[user.rol]}</Badge>}
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-slate-600/30 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-base-900">
      {/* Sidebar desktop */}
      <aside className="hidden md:block w-64 shrink-0 border-r border-cyan-500/20 bg-base-800/60 p-4 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Sidebar mobile (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-cyan-500/20 bg-base-800 p-4 transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-neon"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Columna principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 py-3 bg-base-900/80 backdrop-blur border-b border-cyan-500/20">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-slate-400 hover:text-neon"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-extrabold text-slate-100 flex-1 truncate">{seccion}</h2>

          {/* Indicador de próximos turnos */}
          <div className="relative group">
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-default',
                hayUrgente
                  ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : hayPronto
                    ? 'border-admin/40 bg-admin/10 text-admin'
                    : 'border-slate-600/30 text-slate-500'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Turnos</span>
              {hayUrgente && (
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
                </span>
              )}
              {hayPronto && <span className="w-2 h-2 rounded-full bg-admin" />}
            </div>
            {/* Tooltip */}
            <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-72 glass p-3 shadow-glow-lg z-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Próximos turnos (48 h)
              </p>
              {turnosAlerta.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {turnos.length === 0 ? 'Sin turnos próximos.' : 'Sin alertas: todo en horario normal.'}
                </p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {turnosAlerta.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={cn(
                          'mt-1 w-2 h-2 rounded-full shrink-0',
                          t.alerta === 'urgente' ? 'bg-red-500 animate-pulse' : 'bg-admin'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-slate-200 font-semibold truncate">
                          {t.cliente_nombre || 'Cliente'} — {t.motivo || 'Consulta'}
                        </p>
                        <p className="text-slate-500">
                          {fmtFecha(t.fecha_hora)}
                          {t.closer_nombre ? ` · ${t.closer_nombre}` : ''}
                          {t.alerta === 'urgente' ? ' · ¡en menos de 15 min!' : ' · en menos de 30 min'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Toggle de notificaciones push (opcional por usuario) */}
          {user && pushSoportado() && (
            <button
              onClick={() => void togglePush()}
              disabled={pushCargando || pushEstado === 'denegado'}
              className={cn(
                'p-2 rounded-xl transition-all disabled:opacity-40',
                pushEstado === 'activado'
                  ? 'text-neon bg-neon/10 shadow-glow'
                  : pushEstado === 'denegado'
                    ? 'text-red-400/70'
                    : 'text-slate-400 hover:text-neon hover:bg-neon/5'
              )}
              title={
                pushEstado === 'activado'
                  ? 'Notificaciones activadas — tocar para desactivar'
                  : pushEstado === 'denegado'
                    ? 'Notificaciones bloqueadas en el navegador'
                    : 'Activar notificaciones (avisos de turnos 30/15 min antes)'
              }
              aria-label="Notificaciones push"
            >
              {pushEstado === 'activado' ? (
                <BellRing className="w-5 h-5" />
              ) : pushEstado === 'denegado' ? (
                <BellOff className="w-5 h-5" />
              ) : (
                <BellRing className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Campana de mensajes */}
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              className="relative p-2 rounded-xl text-slate-400 hover:text-neon hover:bg-neon/5 transition-all"
              aria-label="Mensajes"
            >
              <Bell className="w-5 h-5" />
              {noLeidos > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-neon text-base-900 text-[10px] font-extrabold flex items-center justify-center shadow-glow">
                  {noLeidos > 99 ? '99+' : noLeidos}
                </span>
              )}
            </button>

            {bellOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] glass p-3 shadow-glow-lg z-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Mensajes {noLeidos > 0 && <span className="text-neon">({noLeidos} sin leer)</span>}
                  </p>
                  {mensajes.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No hay mensajes.</p>
                  ) : (
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                      {mensajes.map((m) => (
                        <li key={m.id}>
                          <button
                            onClick={() => void marcarLeido(m)}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-xl border transition-all',
                              m.leido
                                ? 'border-slate-600/20 text-slate-500'
                                : 'border-neon/30 bg-neon/5 text-slate-200 hover:bg-neon/10'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {!m.leido && <span className="w-1.5 h-1.5 rounded-full bg-neon shrink-0" />}
                              <p className="text-xs font-bold truncate">{m.titulo || 'Mensaje'}</p>
                            </div>
                            {m.contenido && (
                              <p className="text-xs mt-1 line-clamp-2 opacity-80">{m.contenido}</p>
                            )}
                            <p className="text-[10px] mt-1 opacity-60">
                              {m.autor_nombre ? `${m.autor_nombre} · ` : ''}
                              {fmtFecha(m.created_at)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {user?.rol === 'closer' && (
                    <div className="mt-3 pt-3 border-t border-slate-600/30">
                      {!replyOpen ? (
                        <button
                          onClick={() => setReplyOpen(true)}
                          className="w-full px-3 py-2 rounded-xl border border-neon/40 text-neon text-xs font-bold hover:bg-neon/10 transition-all"
                        >
                          Responder a Oficina
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <input
                            value={replyTitulo}
                            onChange={(e) => setReplyTitulo(e.target.value)}
                            placeholder="Título (opcional)"
                            className="w-full px-3 py-2 rounded-xl bg-base-700 border border-slate-600/40 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-neon/50"
                          />
                          <textarea
                            value={replyContenido}
                            onChange={(e) => setReplyContenido(e.target.value)}
                            placeholder="Escribí tu respuesta a Oficina…"
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-base-700 border border-slate-600/40 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-neon/50 resize-none"
                          />
                          {replyError && <p className="text-[11px] text-red-400">{replyError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setReplyOpen(false);
                                setReplyError(null);
                              }}
                              disabled={replyEnviando}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-600/40 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => void responderOficina()}
                              disabled={replyEnviando || !replyContenido.trim()}
                              className="flex-1 px-3 py-2 rounded-xl bg-neon/15 border border-neon/50 text-xs font-bold text-neon hover:bg-neon/25 transition-all disabled:opacity-40 shadow-glow"
                            >
                              {replyEnviando ? 'Enviando…' : 'Enviar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
