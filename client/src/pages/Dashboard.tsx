import AutomationOverview from '../components/AutomationOverview';
// ============================================================
// pages/Dashboard.tsx — Panel principal post-login.
// Renderiza una vista distinta según rol:
//   - closer: sus métricas, gráfico 6 meses, turnos, mensajes, noticias, bonos.
//   - admin/oficina: stats globales + ranking de closers + atajos.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  CalendarClock, DollarSign, Gift, Megaphone, Newspaper, Trophy,
  ShoppingBag, TrendingUp, Users, PackageX, ArrowRight, Bell, Sparkles, Target,
} from 'lucide-react';
import { api, fmtUSD, fmtFecha } from '../lib/api';
import { useAuth, User } from '../lib/auth';
import { mensajeDelDia, saludoDelDia } from '../lib/motivacion';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner, StatCard, cn } from '../components/ui';

// ------------------------------------------------------------
// Tipos locales (respuestas de la API)
// ------------------------------------------------------------
interface MetricaMes {
  mes: string; // 'YYYY-MM' o etiqueta
  total_usd: number;
  cantidad?: number;
  comisiones_usd?: number;
}
interface MetricasResponse {
  meses?: MetricaMes[];
  data?: MetricaMes[];
  ventas_por_mes?: MetricaMes[];
  comisiones_total_usd?: number;
  total_vendido_usd?: number;
  resumen?: { ventas_mes_usd?: number; comisiones_mes_usd?: number };
}
interface Turno {
  id: number;
  cliente_nombre: string | null;
  fecha_hora: string | null;
  motivo: string | null;
  producto_objetivo?: string | null;
  estado?: string | null;
}
interface Mensaje {
  id: number;
  titulo: string | null;
  contenido: string | null;
  leido: number;
  created_at: string | null;
}
interface Noticia {
  id: number;
  titulo: string | null;
  contenido: string | null;
  tipo: string | null;
  created_at: string | null;
}
interface Bono {
  id: number;
  tipo_bono: string | null;
  monto_usd: number | null;
  descripcion?: string | null;
  fecha?: string | null;
  pagado: number;
}
interface RankingEntry {
  closer_id: number;
  nombre: string;
  total_usd: number;
  cantidad_ventas?: number;
  cantidad?: number;
}
interface AdminStats {
  ventas_mes_total_usd?: number;
  ganancia_mes_usd?: number;
  comisiones_mes_usd?: number;
  turnos_hoy?: number;
  leads_nuevos?: number;
  stock_bajo?: number;
  top_closers?: Array<{ id: number; nombre: string; total_usd: number; ventas: number }>;
}
interface Fichaje {
  id: number;
  user_id: number;
  tipo: 'entrada' | 'salida';
  created_at: string;
}
interface MetaEntry {
  user_id: number;
  nombre: string;
  rol?: string | null;
  monto_usd: number | null;
  vendido_usd: number;
  cumplida: boolean;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function parseFecha(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') || s.includes('Z') ? s : s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Para campos guardados en hora LOCAL naive (turnos.fecha_hora) — NO agregar 'Z'. */
function parseFechaLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza la respuesta de /api/admin/metricas a un array de meses. */
function extraerMeses(raw: unknown): MetricaMes[] {
  const r = raw as MetricasResponse | MetricaMes[];
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.meses)) return r.meses;
  if (Array.isArray(r?.ventas_por_mes)) return r.ventas_por_mes;
  if (Array.isArray(r?.data)) return r.data;
  return [];
}

function etiquetaMes(mes: string): string {
  // 'YYYY-MM' se parsea como fecha LOCAL (no UTC) para no caer en el mes anterior
  if (/^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
  }
  const d = parseFecha(mes);
  if (!d) return mes;
  return d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
}

/** Badge de urgencia de un turno según cuánto falta. */
function alertaTurno(fecha: Date | null): { label: string; color: 'red' | 'amber' | 'slate' } {
  if (!fecha) return { label: 'Sin fecha', color: 'slate' };
  const diffMin = (fecha.getTime() - Date.now()) / 60000;
  if (diffMin <= 60) return { label: 'Urgente', color: 'red' };
  if (diffMin <= 60 * 24) return { label: 'Pronto', color: 'amber' };
  return { label: 'Programado', color: 'slate' };
}

const tooltipStyle = {
  backgroundColor: '#101018',
  border: '1px solid rgba(0,240,255,0.25)',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 13,
} as const;

// ============================================================
// META MENSUAL — barra de progreso (compartida closer/admin)
// ============================================================
function MetaProgress({ meta }: { meta: MetaEntry }) {
  if (!meta.monto_usd) return null;
  const pct = Math.min(100, Math.round((meta.vendido_usd / meta.monto_usd) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-200 flex items-center gap-2">
          {meta.nombre}
          {meta.cumplida && <Badge color="success">¡Meta cumplida! 🎉</Badge>}
        </span>
        <span className="text-slate-400 text-xs">
          <span className="text-neon font-bold text-sm">{fmtUSD(meta.vendido_usd)}</span>
          {' / '}
          {fmtUSD(meta.monto_usd)}
          {' · '}
          {pct}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-base-700 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            meta.cumplida ? 'bg-success' : 'bg-neon-grad'
          )}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// VISTA CLOSER
// ============================================================
function DashboardCloser({ user }: { user: User }) {
  const [meses, setMeses] = useState<MetricaMes[]>([]);
  const [resumen, setResumen] = useState<MetricasResponse['resumen'] | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [bonos, setBonos] = useState<Bono[]>([]);
  const [meta, setMeta] = useState<MetaEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [metricasRaw, turnosData, mensajesData, noticiasData, bonosData, metasData] = await Promise.all([
          api.get<unknown>(`/api/admin/metricas?closer_id=${user.id}`),
          api.get<Turno[]>('/api/turnos/proximos'),
          api.get<Mensaje[]>('/api/mensajes'),
          api.get<Noticia[]>('/api/noticias'),
          api.get<Bono[]>('/api/bonos'),
          api.get<{ mes: string; metas: MetaEntry[] }>('/api/metas'),
        ]);
        if (cancelled) return;
        setMeses(extraerMeses(metricasRaw));
        setResumen(
          Array.isArray(metricasRaw)
            ? null
            : (metricasRaw as MetricasResponse).resumen ?? {
                comisiones_mes_usd: (metricasRaw as MetricasResponse).comisiones_total_usd,
              }
        );
        setTurnos(Array.isArray(turnosData) ? turnosData : []);
        setMensajes(Array.isArray(mensajesData) ? mensajesData : []);
        setNoticias(Array.isArray(noticiasData) ? noticiasData : []);
        setBonos(Array.isArray(bonosData) ? bonosData : []);
        setMeta(metasData?.metas?.find((m) => m.user_id === user.id) ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando el dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const stats = useMemo(() => {
    const ahora = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const delMes = meses.filter((m) => m.mes?.startsWith(mesActual));
    const base = delMes.length > 0 ? delMes : meses.slice(-1);
    const ventasMes = resumen?.ventas_mes_usd ?? base.reduce((acc, m) => acc + (m.total_usd || 0), 0);
    const comisionesMes = resumen?.comisiones_mes_usd ?? base.reduce((acc, m) => acc + (m.comisiones_usd || 0), 0);
    const hoy = ahora.toDateString();
    const turnosHoy = turnos.filter((t) => parseFechaLocal(t.fecha_hora)?.toDateString() === hoy).length;
    const bonosPend = bonos.filter((b) => !b.pagado).reduce((acc, b) => acc + (b.monto_usd || 0), 0);
    return { ventasMes, comisionesMes, turnosHoy, bonosPend };
  }, [meses, resumen, turnos, bonos]);

  const chartData = useMemo(
    () =>
      meses.slice(-6).map((m) => ({
        mes: etiquetaMes(m.mes),
        total: m.total_usd || 0,
      })),
    [meses]
  );

  const marcarLeido = async (id: number) => {
    setMensajes((prev) => prev.map((m) => (m.id === id ? { ...m, leido: 1 } : m)));
    try {
      await api.put(`/api/mensajes/${id}/leido`);
    } catch {
      // silencioso: la UI ya refleja el cambio local
    }
  };

  if (loading) return <Spinner />;
  if (error) return <EmptyState message={`No se pudo cargar el panel: ${error}`} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hola, ${user.nombre}`}
        subtitle="Tu panel de ventas — iPhone Culture Neuquén"
      />

      {/* Saludo + mensaje motivacional del día (rota solo cada día) */}
      <Card className="border-neon/40 bg-neon/5 shadow-glow">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-neon shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-bold text-neon mb-1">{saludoDelDia(user.nombre)}</p>
            <p className="text-slate-100 font-semibold leading-relaxed">{mensajeDelDia()}</p>
          </div>
        </div>
      </Card>

      {/* StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas del mes" value={fmtUSD(stats.ventasMes)} accent="neon" />
        <StatCard label="Comisiones del mes" value={fmtUSD(stats.comisionesMes)} accent="success" />
        <StatCard label="Turnos hoy" value={stats.turnosHoy} accent="amber" />
        <StatCard label="Bonos pendientes" value={fmtUSD(stats.bonosPend)} accent="violet" />
      </div>

      {/* Meta mensual */}
      {meta?.monto_usd ? (
        <Card className={cn(meta.cumplida && 'border-success/50')}>
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-neon" />
            <h2 className="text-base font-bold text-slate-100">Tu meta del mes</h2>
          </div>
          <MetaProgress meta={meta} />
          {!meta.cumplida && (
            <p className="text-xs text-slate-400 mt-3">
              Te faltan <b className="text-neon">{fmtUSD(meta.monto_usd - meta.vendido_usd)}</b> para llegar. ¡Vamos que se puede!
            </p>
          )}
        </Card>
      ) : null}

      {/* Gráfico de ventas 6 meses */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-neon" />
          <h2 className="text-base font-bold text-slate-100">Mis ventas — últimos 6 meses</h2>
        </div>
        {chartData.length === 0 ? (
          <EmptyState message="Todavía no hay ventas registradas para graficar." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [fmtUSD(value), 'Ventas']}
                  labelStyle={{ color: '#00f0ff' }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#00f0ff"
                  strokeWidth={2.5}
                  fill="url(#gradVentas)"
                  dot={{ r: 3, fill: '#00f0ff', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#00f0ff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próximos turnos */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-admin" />
              <h2 className="text-base font-bold text-slate-100">Próximos turnos</h2>
            </div>
            <Link to="/turnos" className="text-xs text-neon hover:underline inline-flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          {turnos.length === 0 ? (
            <EmptyState message="No tenés turnos próximos." />
          ) : (
            <div className="space-y-3">
              {turnos.slice(0, 5).map((t) => {
                const fechaLocal = parseFechaLocal(t.fecha_hora);
                const alerta = alertaTurno(fechaLocal);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-700/60 border border-slate-600/20">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {t.cliente_nombre || 'Cliente'} <span className="text-slate-500 font-normal">· {t.motivo || 'Consulta'}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fechaLocal
                          ? fechaLocal.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </p>
                    </div>
                    <Badge color={alerta.color}>{alerta.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Mensajes del admin */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={18} className="text-neon" />
            <h2 className="text-base font-bold text-slate-100">Mensajes del admin</h2>
          </div>
          {mensajes.length === 0 ? (
            <EmptyState message="No hay mensajes por ahora." />
          ) : (
            <div className="space-y-3">
              {mensajes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => !m.leido && void marcarLeido(m.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl bg-base-700/60 border transition-all',
                    m.leido ? 'border-slate-600/20 opacity-70' : 'neon-border hover:shadow-glow cursor-pointer'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">{m.titulo || 'Mensaje'}</p>
                    {!m.leido && <Badge color="neon">Nuevo</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.contenido}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">{fmtFecha(m.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Noticias */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={18} className="text-oficina" />
            <h2 className="text-base font-bold text-slate-100">Noticias</h2>
          </div>
          {noticias.length === 0 ? (
            <EmptyState message="Sin noticias por el momento." />
          ) : (
            <div className="space-y-4">
              {noticias.slice(0, 5).map((n) => (
                <article key={n.id} className="border-l-2 border-oficina/50 pl-3">
                  <p className="text-sm font-semibold text-slate-100">{n.titulo || 'Noticia'}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3">{n.contenido}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">{fmtFecha(n.created_at)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        {/* Mis bonos */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Gift size={18} className="text-success" />
            <h2 className="text-base font-bold text-slate-100">Mis bonos</h2>
          </div>
          {bonos.length === 0 ? (
            <EmptyState message="No tenés bonos cargados todavía." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-600/30">
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Monto</th>
                    <th className="pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {bonos.map((b) => (
                    <tr key={b.id} className="border-b border-slate-600/10 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-200">{b.tipo_bono || 'Bono'}</td>
                      <td className="py-2.5 pr-4 font-semibold text-neon">{fmtUSD(b.monto_usd)}</td>
                      <td className="py-2.5">
                        <Badge color={b.pagado ? 'success' : 'amber'}>{b.pagado ? 'Pagado' : 'Pendiente'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// FICHAJE (oficina/admin): botón grande entrada/salida + marcas de hoy
// ============================================================
function FichajeCard({ user }: { user: User }) {
  const [ultimo, setUltimo] = useState<Fichaje | null>(null);
  const [hoy, setHoy] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const [est, lista] = await Promise.all([
        api.get<{ ultimo: Fichaje | null }>('/api/fichajes/estado'),
        api.get<Fichaje[]>('/api/fichajes'),
      ]);
      setUltimo(est.ultimo ?? null);
      const hoyStr = new Date().toDateString();
      const propios = (Array.isArray(lista) ? lista : []).filter(
        (f) => f.user_id === user.id && parseFecha(f.created_at)?.toDateString() === hoyStr
      );
      setHoy(propios.reverse()); // la API viene DESC; mostrar cronológico
    } catch {
      // sin datos: se muestra el botón igual
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const marcar = async (tipo: 'entrada' | 'salida') => {
    setEnviando(true);
    setError(null);
    try {
      await api.post('/api/fichajes/marcar', { tipo });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el fichaje');
    } finally {
      setEnviando(false);
    }
  };

  const enOficina = ultimo?.tipo === 'entrada';

  return (
    <Card className={cn('border-neon/30', enOficina && 'shadow-glow')}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border',
              enOficina ? 'bg-success/15 border-success/50 text-success' : 'bg-base-700 border-slate-600/40 text-slate-400'
            )}
          >
            <CalendarClock size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-100">Fichaje</h2>
            <p className="text-xs text-slate-400">
              {loading
                ? 'Cargando estado…'
                : enOficina
                  ? `Entraste a las ${parseFecha(ultimo!.created_at)?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) ?? '—'}`
                  : 'No estás fichado/a en oficina'}
            </p>
          </div>
        </div>
        <Button
          variant={enOficina ? 'success' : 'primary'}
          onClick={() => void marcar(enOficina ? 'salida' : 'entrada')}
          disabled={enviando || loading}
          className="text-base !py-3 !px-6 font-extrabold"
        >
          {enviando ? 'Registrando…' : enOficina ? '🟢 En oficina — Marcar salida' : '⚪ Marcar entrada'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      {hoy.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700/40">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Hoy</p>
          <div className="flex flex-wrap gap-2">
            {hoy.map((f) => (
              <Badge key={f.id} color={f.tipo === 'entrada' ? 'success' : 'slate'}>
                {parseFecha(f.created_at)?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) ?? '—'}{' '}
                {f.tipo}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// VISTA ADMIN / OFICINA
// ============================================================
function DashboardAdmin({ user }: { user: User }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [metas, setMetas] = useState<MetaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const statsData = await api.get<AdminStats>('/api/admin/stats');
        if (cancelled) return;
        setStats(statsData);
        let rank: RankingEntry[] = Array.isArray(statsData?.top_closers)
          ? statsData.top_closers.map((c) => ({
              closer_id: c.id,
              nombre: c.nombre,
              total_usd: c.total_usd,
              cantidad_ventas: c.ventas,
            }))
          : [];
        if (rank.length === 0) {
          // Fallback: ranking desde /api/admin/metricas (sin closer_id)
          try {
            const metricasRaw = await api.get<unknown>('/api/admin/metricas');
            if (!cancelled && Array.isArray(metricasRaw)) {
              rank = (metricasRaw as RankingEntry[]).filter((r) => typeof r?.total_usd === 'number');
            }
          } catch {
            // sin ranking disponible
          }
        }
        if (!cancelled) {
          setRanking([...rank].sort((a, b) => (b.total_usd || 0) - (a.total_usd || 0)));
        }
        // Metas del mes con progreso por usuario
        try {
          const metasData = await api.get<{ mes: string; metas: MetaEntry[] }>('/api/metas');
          if (!cancelled) setMetas((metasData?.metas ?? []).filter((m) => m.monto_usd));
        } catch {
          // sin metas cargadas todavía
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando las estadísticas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxRanking = useMemo(() => Math.max(1, ...ranking.map((r) => r.total_usd || 0)), [ranking]);

  if (loading) return <Spinner />;
  if (error) return <EmptyState message={`No se pudo cargar el panel: ${error}`} />;

  const esAdmin = user.rol === 'admin';

  return (
    <div className="space-y-8">
      <PageHeader
        title={esAdmin ? 'Panel de administración' : 'Panel de oficina'}
        subtitle={esAdmin ? 'Visión global del negocio — iPhone Culture' : 'Vista general del negocio'}
      />

      {/* Fichaje entrada/salida */}
      <FichajeCard user={user} />

      {/* StatCards globales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Ventas del mes" value={fmtUSD(stats?.ventas_mes_total_usd)} accent="neon" />
        <StatCard label="Ganancia del mes" value={fmtUSD(stats?.ganancia_mes_usd)} accent="success" />
        <StatCard label="Comisiones del mes" value={fmtUSD(stats?.comisiones_mes_usd)} accent="amber" />
        <StatCard label="Turnos hoy" value={stats?.turnos_hoy ?? 0} accent="violet" />
        <StatCard label="Leads nuevos" value={stats?.leads_nuevos ?? 0} accent="neon" />
        <StatCard label="Stock bajo" value={stats?.stock_bajo ?? 0} accent="amber" hint="productos con pocas unidades" />
      </div>

      {/* Ranking de closers */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Trophy size={18} className="text-admin" />
          <h2 className="text-base font-bold text-slate-100">Ranking de closers</h2>
        </div>
        {ranking.length === 0 ? (
          <EmptyState message="Todavía no hay datos de ventas para armar el ranking." />
        ) : (
          <div className="space-y-4">
            {ranking.map((r, i) => (
              <div key={r.closer_id ?? i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-200">
                    <span className="text-slate-500 mr-2">#{i + 1}</span>
                    {r.nombre}
                  </span>
                  <span className="text-slate-400 text-xs">
                    <span className="text-neon font-bold text-sm">{fmtUSD(r.total_usd)}</span>
                    {' · '}
                    {r.cantidad_ventas ?? r.cantidad ?? 0} ventas
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-base-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-neon-grad transition-all duration-700"
                    style={{ width: `${Math.max(3, ((r.total_usd || 0) / maxRanking) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Metas del mes */}
      {metas.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-neon" />
              <h2 className="text-base font-bold text-slate-100">Metas del mes</h2>
            </div>
            <Link to="/admin" className="text-xs text-neon hover:underline inline-flex items-center gap-1">
              Editar metas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-4">
            {metas.map((m) => (
              <MetaProgress key={m.user_id} meta={m} />
            ))}
          </div>
        </Card>
      )}

      {/* Atajos */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to="/admin" className="glass p-5 shadow-glow group hover:border-admin/50 transition-all">
          <div className="flex items-center justify-between">
            <Users size={20} className="text-admin" />
            <ArrowRight size={16} className="text-slate-500 group-hover:text-admin transition-colors" />
          </div>
          <p className="mt-3 font-bold text-slate-100">Administración</p>
          <p className="text-xs text-slate-400 mt-1">Closers, bonos, mensajes y noticias</p>
        </Link>
        <Link to="/ventas" className="glass p-5 shadow-glow group hover:border-neon/50 transition-all">
          <div className="flex items-center justify-between">
            <ShoppingBag size={20} className="text-neon" />
            <ArrowRight size={16} className="text-slate-500 group-hover:text-neon transition-colors" />
          </div>
          <p className="mt-3 font-bold text-slate-100">Ventas</p>
          <p className="text-xs text-slate-400 mt-1">Todas las operaciones del equipo</p>
        </Link>
        <Link to="/turnos" className="glass p-5 shadow-glow group hover:border-oficina/50 transition-all">
          <div className="flex items-center justify-between">
            <CalendarClock size={20} className="text-oficina" />
            <ArrowRight size={16} className="text-slate-500 group-hover:text-oficina transition-colors" />
          </div>
          <p className="mt-3 font-bold text-slate-100">Turnos</p>
          <p className="text-xs text-slate-400 mt-1">Agenda completa de la tienda</p>
        </Link>
      </div>

      {/* Indicadores secundarios */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <DollarSign size={20} className="text-success shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Margen del mes</p>
            <p className="text-sm font-bold text-slate-100">
              {stats?.ventas_mes_total_usd
                ? `${Math.round(((stats.ganancia_mes_usd ?? 0) / stats.ventas_mes_total_usd) * 100)}%`
                : '—'}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Bell size={20} className="text-admin shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Turnos de hoy</p>
            <p className="text-sm font-bold text-slate-100">{stats?.turnos_hoy ?? 0} agendados</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <PackageX size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Alertas de stock</p>
            <p className="text-sm font-bold text-slate-100">{stats?.stock_bajo ?? 0} productos bajos</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Entry point
// ============================================================
export default function Dashboard() {
  const { user, loading } = useAuth();
  if (loading || !user) return <Spinner />;
  return <><AutomationOverview />{user.rol === 'closer' ? <DashboardCloser user={user} /> : <DashboardAdmin user={user} />}</>;
}
