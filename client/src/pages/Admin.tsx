// ============================================================
// pages/Admin.tsx — PANEL DE ADMINISTRACIÓN (admin / oficina)
// Tabs: Resumen / Mensajes / Noticias / Bonos / Closers / Fichajes.
// Oficina: puede enviar mensajes a closers (Mensajes) y registrar
// ventas (página Ventas); el resto de las mutaciones sigue
// deshabilitado con tooltip "Solo lectura".
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Trash2, Check, Send, BarChart3, X, Trophy, Target, Activity, Download } from 'lucide-react';
import { api, fmtUSD, fmtFecha, getToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, Button, Input, Select, Textarea, Label, Badge, StatCard, PageHeader, Spinner, EmptyState, cn, ConfirmDialog } from '../components/ui';

// ---------- Tipos defensivos (el backend se implementa en paralelo) ----------
interface Closer {
  id: number;
  nombre: string;
  email: string;
  telefono?: string | null;
}

interface Stats {
  total_vendido_usd?: number;
  ventas_mes?: number;
  total_ventas?: number;
  closers_activos?: number;
  stock_items?: number;
  stock_unidades?: number;
  turnos_pendientes?: number;
  turnos_hoy?: number;
  leads_nuevos?: number;
  bonos_pendientes?: number;
  [k: string]: unknown;
}

interface Metricas {
  total_vendido_usd?: number;
  comisiones_usd?: number;
  turnos?: number;
  turnos_total?: number;
  bonos_pendientes?: number;
  ventas_por_mes?: Array<{ mes: string; total: number }>;
  [k: string]: unknown;
}

interface Mensaje {
  id: number;
  closer_id?: number | null;
  titulo?: string | null;
  contenido?: string | null;
  created_at?: string | null;
}

interface Noticia {
  id: number;
  titulo?: string | null;
  contenido?: string | null;
  tipo?: string | null;
  created_at?: string | null;
}

interface Bono {
  id: number;
  closer_id?: number | null;
  tipo_bono?: string | null;
  monto_usd?: number | null;
  descripcion?: string | null;
  fecha?: string | null;
  pagado?: number | null;
}

interface Campania {
  id: number;
  titulo: string;
  que_hay_que_hacer?: string | null;
  premio_usd?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  activa: number;
  pendientes?: number;
  total_marcados?: number;
}

interface Cumplimiento {
  id: number;
  campania_id: number;
  closer_id: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  created_at?: string | null;
  campania_titulo?: string | null;
  premio_usd?: number | null;
  closer_nombre?: string | null;
}

interface Fichaje {
  id: number;
  user_id: number;
  tipo: 'entrada' | 'salida';
  created_at: string;
  user_nombre?: string | null;
}

type Tab = 'resumen' | 'mensajes' | 'noticias' | 'bonos' | 'closers' | 'fichajes' | 'metas' | 'actividad';

// Intenta varias rutas (la misión usa /api/admin/* y la SPEC lista alias sin prefijo)
async function getFirstOk<T>(paths: string[]): Promise<T> {
  let lastErr: Error | null = null;
  for (const p of paths) {
    try {
      return await api.get<T>(p);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error('Sin respuesta del servidor');
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'mensajes', label: 'Mensajes' },
  { id: 'noticias', label: 'Noticias' },
  { id: 'bonos', label: 'Bonos' },
  { id: 'metas', label: 'Metas' },
  { id: 'closers', label: 'Closers' },
  { id: 'fichajes', label: 'Fichajes' },
  { id: 'actividad', label: 'Actividad' },
];

export default function Admin() {
  const { user } = useAuth();
  const readOnly = user?.rol === 'oficina';

  const [tab, setTab] = useState<Tab>('resumen');
  const [closers, setClosers] = useState<Closer[]>([]);

  const cargarClosers = useCallback(async () => {
    try {
      const data = await getFirstOk<Closer[]>(['/api/admin/closers', '/api/closers']);
      setClosers(Array.isArray(data) ? data : []);
    } catch {
      setClosers([]);
    }
  }, []);

  useEffect(() => {
    void cargarClosers();
  }, [cargarClosers]);

  const nombreCloser = (id?: number | null) =>
    id == null ? 'Todos' : closers.find((c) => c.id === id)?.nombre ?? `Closer #${id}`;

  // Props comunes para botones de mutación en modo solo-lectura
  const roProps = readOnly ? { disabled: true, title: 'Solo lectura' } : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración"
        subtitle={readOnly ? 'Modo solo lectura (oficina)' : 'Gestión completa del negocio'}
        actions={readOnly ? <Badge color="violet">Solo lectura</Badge> : <Badge color="amber">Admin</Badge>}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              tab === t.id
                ? 'bg-neon/15 text-neon border-neon/50 shadow-glow'
                : 'bg-base-700 text-slate-400 border-slate-600/30 hover:text-neon hover:border-neon/40'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen closers={closers} />}
      {tab === 'mensajes' && <TabMensajes closers={closers} nombreCloser={nombreCloser} />}
      {tab === 'noticias' && <TabNoticias readOnly={readOnly} roProps={roProps} />}
      {tab === 'bonos' && <TabBonos closers={closers} readOnly={readOnly} roProps={roProps} nombreCloser={nombreCloser} />}
      {tab === 'fichajes' && <TabFichajes />}
      {tab === 'metas' && <TabMetas readOnly={readOnly} />}
      {tab === 'actividad' && <TabActividad esAdmin={user?.rol === 'admin'} />}
      {tab === 'closers' && (
        <TabClosers
          closers={closers}
          onVerMetricas={(id) => {
            setTab('resumen');
            window.dispatchEvent(new CustomEvent('ic:admin:closer', { detail: id }));
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// TAB: RESUMEN
// ============================================================
function TabResumen({ closers }: { closers: Closer[] }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [closerId, setCloserId] = useState<string>('');
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingMet, setLoadingMet] = useState(false);

  useEffect(() => {
    getFirstOk<Stats>(['/api/admin/stats'])
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, []);

  // Permite que la tab Closers preseleccione un closer acá
  useEffect(() => {
    const handler = (e: Event) => setCloserId(String((e as CustomEvent).detail));
    window.addEventListener('ic:admin:closer', handler);
    return () => window.removeEventListener('ic:admin:closer', handler);
  }, []);

  useEffect(() => {
    if (!closerId) {
      setMetricas(null);
      return;
    }
    setLoadingMet(true);
    getFirstOk<Metricas>([`/api/admin/metricas?closer_id=${closerId}`, `/api/metricas?closer_id=${closerId}`])
      .then(setMetricas)
      .catch(() => setMetricas(null))
      .finally(() => setLoadingMet(false));
  }, [closerId]);

  const chartData = (metricas?.ventas_por_mes ?? []).map((v) => ({ mes: v.mes, total: Number(v.total) || 0 }));

  return (
    <div className="space-y-6">
      {loadingStats ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total vendido" value={fmtUSD(stats?.total_vendido_usd)} accent="neon" />
          <StatCard label="Ventas del mes" value={stats?.ventas_mes ?? stats?.total_ventas ?? '—'} accent="success" />
          <StatCard label="Closers activos" value={stats?.closers_activos ?? closers.length} accent="amber" />
          <StatCard label="Turnos pendientes" value={stats?.turnos_pendientes ?? stats?.turnos_hoy ?? '—'} accent="violet" />
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-64">
            <Label>Métricas por closer</Label>
            <Select value={closerId} onChange={(e) => setCloserId(e.target.value)}>
              <option value="">Elegí un closer…</option>
              {closers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {!closerId ? (
          <EmptyState message="Seleccioná un closer para ver sus métricas." />
        ) : loadingMet ? (
          <Spinner />
        ) : !metricas ? (
          <EmptyState message="No se pudieron cargar las métricas de este closer." />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total vendido" value={fmtUSD(metricas.total_vendido_usd)} accent="neon" />
              <StatCard label="Comisiones" value={fmtUSD(metricas.comisiones_usd)} accent="success" />
              <StatCard label="Turnos" value={metricas.turnos ?? metricas.turnos_total ?? '—'} accent="violet" />
              <StatCard label="Bonos pendientes" value={metricas.bonos_pendientes ?? '—'} accent="amber" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-neon" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Ventas por mes (USD)</h3>
              </div>
              {chartData.length === 0 ? (
                <EmptyState message="Sin ventas registradas por mes." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e1e2a" strokeDasharray="3 3" />
                      <XAxis dataKey="mes" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#101018', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 12 }}
                        labelStyle={{ color: '#94a3b8' }}
                        itemStyle={{ color: '#00f0ff' }}
                        formatter={(v: number | string) => [fmtUSD(Number(v)), 'Ventas']}
                      />
                      <Area type="monotone" dataKey="total" stroke="#00f0ff" strokeWidth={2} fill="url(#gradVentas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// TAB: MENSAJES (admin y oficina pueden enviar a closers / broadcast)
// ============================================================
function TabMensajes({
  closers,
  nombreCloser,
}: {
  closers: Closer[];
  nombreCloser: (id?: number | null) => string;
}) {
  const [lista, setLista] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [destino, setDestino] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api.get<Mensaje[]>('/api/mensajes');
      setLista(Array.isArray(data) ? data : []);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enviar = async () => {
    if (!titulo.trim() || !contenido.trim()) return;
    setEnviando(true);
    try {
      await api.post('/api/mensajes', {
        closer_id: destino === '' ? null : Number(destino),
        titulo: titulo.trim(),
        contenido: contenido.trim(),
      });
      setTitulo('');
      setContenido('');
      setDestino('');
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Nuevo mensaje</h3>
        <div className="space-y-4">
          <div>
            <Label>Destinatario</Label>
            <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Todos (broadcast)</option>
              {closers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Reunión de equipo" />
          </div>
          <div>
            <Label>Contenido</Label>
            <Textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Escribí el mensaje…" />
          </div>
          <Button onClick={enviar} disabled={enviando || !titulo.trim() || !contenido.trim()} className="w-full">
            <span className="inline-flex items-center gap-2">
              <Send size={15} /> {enviando ? 'Enviando…' : 'Enviar mensaje'}
            </span>
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Mensajes enviados</h3>
        {loading ? (
          <Spinner />
        ) : lista.length === 0 ? (
          <EmptyState message="Todavía no hay mensajes enviados." />
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {lista.map((m) => (
              <div key={m.id} className="glass p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-semibold text-slate-100 text-sm">{m.titulo || 'Sin título'}</p>
                  <Badge color={m.closer_id == null ? 'violet' : 'neon'}>{nombreCloser(m.closer_id)}</Badge>
                </div>
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{m.contenido}</p>
                <p className="text-[10px] text-slate-600 mt-2">{fmtFecha(m.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// TAB: NOTICIAS
// ============================================================
function TabNoticias({ readOnly, roProps }: { readOnly: boolean; roProps: { disabled?: boolean; title?: string } }) {
  const [lista, setLista] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState('general');
  const [enviando, setEnviando] = useState(false);
  const [noticiaAEliminar, setNoticiaAEliminar] = useState<Noticia | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const confirmarEliminar = async () => {
    if (!noticiaAEliminar) return;
    setEliminando(true);
    try {
      await api.del(`/api/noticias/${noticiaAEliminar.id}`);
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEliminando(false);
      setNoticiaAEliminar(null);
    }
  };

  const cargar = useCallback(async () => {
    try {
      const data = await api.get<Noticia[]>('/api/noticias');
      setLista(Array.isArray(data) ? data : []);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const publicar = async () => {
    if (!titulo.trim() || !contenido.trim()) return;
    setEnviando(true);
    try {
      await api.post('/api/noticias', { titulo: titulo.trim(), contenido: contenido.trim(), tipo });
      setTitulo('');
      setContenido('');
      setTipo('general');
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = (n: Noticia) => setNoticiaAEliminar(n);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {!readOnly && (
        <Card>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Nueva noticia</h3>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Llegó stock de iPhone 17" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="general">General</option>
                <option value="precios">Precios</option>
                <option value="stock">Stock</option>
                <option value="urgente">Urgente</option>
              </Select>
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Detalle de la novedad…" />
            </div>
            <Button onClick={publicar} disabled={enviando || !titulo.trim() || !contenido.trim()} {...roProps} className="w-full">
              {enviando ? 'Publicando…' : 'Publicar noticia'}
            </Button>
          </div>
        </Card>
      )}

      <Card className={cn(readOnly && 'lg:col-span-2')}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Noticias publicadas</h3>
        {loading ? (
          <Spinner />
        ) : lista.length === 0 ? (
          <EmptyState message="No hay noticias publicadas." />
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {lista.map((n) => (
              <div key={n.id} className="glass p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-semibold text-slate-100 text-sm">{n.titulo || 'Sin título'}</p>
                  <div className="flex items-center gap-2">
                    <Badge color={n.tipo === 'urgente' ? 'red' : n.tipo === 'precios' ? 'amber' : n.tipo === 'stock' ? 'success' : 'slate'}>
                      {n.tipo || 'general'}
                    </Badge>
                    {!readOnly && (
                      <button
                        onClick={() => eliminar(n)}
                        className="w-6 h-6 rounded-lg bg-base-700 border border-slate-600/40 text-slate-400 hover:border-red-500/50 hover:text-red-400 flex items-center justify-center"
                        title="Eliminar noticia"
                        {...roProps}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{n.contenido}</p>
                <p className="text-[10px] text-slate-600 mt-2">{fmtFecha(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={noticiaAEliminar !== null}
        onClose={() => !eliminando && setNoticiaAEliminar(null)}
        onConfirm={() => void confirmarEliminar()}
        title="Eliminar noticia"
        message={`¿Eliminar la noticia "${noticiaAEliminar?.titulo ?? ''}"?`}
        loading={eliminando}
      />
    </div>
  );
}

// ============================================================
// TAB: BONOS
// ============================================================
function TabBonos({
  closers,
  readOnly,
  roProps,
  nombreCloser,
}: {
  closers: Closer[];
  readOnly: boolean;
  roProps: { disabled?: boolean; title?: string };
  nombreCloser: (id?: number | null) => string;
}) {
  const [lista, setLista] = useState<Bono[]>([]);
  const [loading, setLoading] = useState(true);
  const [closerId, setCloserId] = useState('');
  const [tipoBono, setTipoBono] = useState('Objetivo mensual');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);

  // Campañas de bonos (el admin publica qué hay que hacer para ganarlo)
  const [campanias, setCampanias] = useState<Campania[]>([]);
  const [cumplimientos, setCumplimientos] = useState<Cumplimiento[]>([]);
  const [cTitulo, setCTitulo] = useState('');
  const [cQueHacer, setCQueHacer] = useState('');
  const [cPremio, setCPremio] = useState('');
  const [cFechaInicio, setCFechaInicio] = useState('');
  const [cFechaFin, setCFechaFin] = useState('');
  const [enviandoCamp, setEnviandoCamp] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [data, camps, cumpls] = await Promise.all([
        api.get<Bono[]>('/api/bonos'),
        api.get<Campania[]>('/api/bonos/campanias'),
        api.get<Cumplimiento[]>('/api/bonos/cumplimientos'),
      ]);
      setLista(Array.isArray(data) ? data : []);
      setCampanias(Array.isArray(camps) ? camps : []);
      setCumplimientos(Array.isArray(cumpls) ? cumpls : []);
    } catch {
      setLista([]);
      setCampanias([]);
      setCumplimientos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crearCampania = async () => {
    if (!cTitulo.trim()) return;
    setEnviandoCamp(true);
    try {
      await api.post('/api/bonos/campanias', {
        titulo: cTitulo.trim(),
        que_hay_que_hacer: cQueHacer.trim(),
        premio_usd: Number(cPremio) || 0,
        fecha_inicio: cFechaInicio || null,
        fecha_fin: cFechaFin || null,
      });
      setCTitulo('');
      setCQueHacer('');
      setCPremio('');
      setCFechaInicio('');
      setCFechaFin('');
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEnviandoCamp(false);
    }
  };

  const toggleCampania = async (c: Campania) => {
    try {
      await api.put(`/api/bonos/campanias/${c.id}`, { activa: c.activa ? 0 : 1 });
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const eliminarCampania = async (c: Campania) => {
    if (!confirm(`¿Eliminar la campaña "${c.titulo}"? Se borran también las marcas de "Cumplí".`)) return;
    try {
      await api.del(`/api/bonos/campanias/${c.id}`);
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const resolverCumplimiento = async (cum: Cumplimiento, estado: 'aprobado' | 'rechazado') => {
    try {
      await api.put(`/api/bonos/cumplimientos/${cum.id}`, { estado });
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const crear = async () => {
    if (!closerId || !monto) return;
    setEnviando(true);
    try {
      await api.post('/api/bonos', {
        closer_id: Number(closerId),
        tipo_bono: tipoBono,
        monto_usd: Number(monto) || 0,
        descripcion: descripcion.trim(),
        fecha,
      });
      setCloserId('');
      setMonto('');
      setDescripcion('');
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const marcarPagado = async (b: Bono) => {
    try {
      await api.put(`/api/bonos/${b.id}`, { pagado: 1 });
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* CAMPAÑAS: publicar un bono con qué hay que hacer para ganarlo */}
      {!readOnly && (
        <Card className="border-admin/30">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-2">
            <Trophy size={15} className="text-admin" /> Publicar nuevo bono (campaña)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Los vendedores lo ven en su sección Bonos y marcan "¡Cumplí!" cuando lo logran. Vos aprobás o rechazás abajo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <Label>¿Cuál es el bono?</Label>
              <Input
                value={cTitulo}
                onChange={(e) => setCTitulo(e.target.value)}
                placeholder="Ej: Bono USD 100 por 10 ventas en la semana"
              />
            </div>
            <div>
              <Label>Premio (USD)</Label>
              <Input type="number" min={0} value={cPremio} onChange={(e) => setCPremio(e.target.value)} placeholder="Ej: 100" />
            </div>
            <div>
              <Label>Válido desde (opcional)</Label>
              <Input type="date" value={cFechaInicio} onChange={(e) => setCFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Válido hasta (opcional)</Label>
              <Input type="date" value={cFechaFin} onChange={(e) => setCFechaFin(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>¿Qué hay que hacer para ganarlo?</Label>
              <Textarea
                rows={2}
                value={cQueHacer}
                onChange={(e) => setCQueHacer(e.target.value)}
                placeholder="Ej: Cerrar 10 ventas cobradas entre el lunes y el sábado"
              />
            </div>
            <div>
              <Button onClick={crearCampania} disabled={enviandoCamp || !cTitulo.trim()} {...roProps} className="w-full">
                {enviandoCamp ? 'Publicando…' : 'Publicar bono'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de campañas */}
      {campanias.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-base-700/40">
                  <th className="py-3 px-4">Bono</th>
                  <th className="py-3 px-4">Premio</th>
                  <th className="py-3 px-4">Límite</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Cumplimientos</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {campanias.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-100">{c.titulo}</p>
                      {c.que_hay_que_hacer && (
                        <p className="text-xs text-slate-400 max-w-[320px] truncate">{c.que_hay_que_hacer}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-neon">{c.premio_usd ? fmtUSD(c.premio_usd) : '—'}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {c.fecha_inicio || c.fecha_fin
                        ? `${c.fecha_inicio ? fmtFecha(c.fecha_inicio) : '…'} al ${c.fecha_fin ? fmtFecha(c.fecha_fin) : '…'}`
                        : 'Sin límite'}
                    </td>
                    <td className="py-3 px-4">
                      {c.activa ? <Badge color="success">Activa</Badge> : <Badge color="slate">Inactiva</Badge>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {(c.pendientes ?? 0) > 0 ? (
                        <span className="text-admin font-bold">{c.pendientes} pendiente(s)</span>
                      ) : (
                        `${c.total_marcados ?? 0} marcado(s)`
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          onClick={() => toggleCampania(c)}
                          {...roProps}
                          className="px-3 py-1 text-xs mr-2"
                        >
                          {c.activa ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void eliminarCampania(c)}
                          {...roProps}
                          className="px-3 py-1 text-xs"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CUMPLIMIENTOS: vendedores que marcaron "Cumplí" */}
      <Card className="p-0 overflow-hidden">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 py-3 px-4 border-b border-slate-700/40 bg-base-700/40">
          Vendedores que marcaron "Cumplí"
        </h3>
        {cumplimientos.length === 0 ? (
          <EmptyState message="Todavía nadie marcó un cumplimiento." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40">
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4">Bono</th>
                  <th className="py-3 px-4">Premio</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Estado</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {cumplimientos.map((cum) => (
                  <tr key={cum.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">{cum.closer_nombre || `#${cum.closer_id}`}</td>
                    <td className="py-3 px-4 text-slate-300 text-xs max-w-[260px] truncate">
                      {cum.campania_titulo || '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-neon">{cum.premio_usd ? fmtUSD(cum.premio_usd) : '—'}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{fmtFecha(cum.created_at)}</td>
                    <td className="py-3 px-4">
                      {cum.estado === 'aprobado' ? (
                        <Badge color="success">Aprobado</Badge>
                      ) : cum.estado === 'rechazado' ? (
                        <Badge color="red">Rechazado</Badge>
                      ) : (
                        <Badge color="amber">Pendiente</Badge>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {cum.estado === 'pendiente' && (
                          <>
                            <Button
                              variant="success"
                              onClick={() => resolverCumplimiento(cum, 'aprobado')}
                              {...roProps}
                              className="px-3 py-1 text-xs mr-2"
                              title="Aprobar: genera el bono pendiente de pago"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Check size={12} /> Aprobar
                              </span>
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => resolverCumplimiento(cum, 'rechazado')}
                              {...roProps}
                              className="px-3 py-1 text-xs"
                            >
                              <span className="inline-flex items-center gap-1">
                                <X size={12} /> Rechazar
                              </span>
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!readOnly && (
        <Card>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Nuevo bono manual</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <Label>Closer</Label>
              <Select value={closerId} onChange={(e) => setCloserId(e.target.value)}>
                <option value="">Elegí…</option>
                {closers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tipo de bono</Label>
              <Select value={tipoBono} onChange={(e) => setTipoBono(e.target.value)}>
                <option>Objetivo mensual</option>
                <option>Venta destacada</option>
                <option>Cliente recurrente</option>
                <option>Extra</option>
              </Select>
            </div>
            <div>
              <Label>Monto (USD)</Label>
              <Input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 50" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Button onClick={crear} disabled={enviando || !closerId || !monto} {...roProps} className="w-full">
                {enviando ? 'Guardando…' : 'Cargar bono'}
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Superó el objetivo de marzo" />
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : lista.length === 0 ? (
          <EmptyState message="No hay bonos cargados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-base-700/40">
                  <th className="py-3 px-4">Closer</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Monto</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Estado</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {lista.map((b) => (
                  <tr key={b.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-100">{nombreCloser(b.closer_id)}</td>
                    <td className="py-3 px-4 text-slate-300">{b.tipo_bono || '—'}</td>
                    <td className="py-3 px-4 font-bold text-neon">{fmtUSD(b.monto_usd)}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs max-w-[220px] truncate">{b.descripcion || '—'}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{b.fecha || '—'}</td>
                    <td className="py-3 px-4">
                      {b.pagado ? <Badge color="success">Pagado</Badge> : <Badge color="amber">Pendiente</Badge>}
                    </td>
                    {!readOnly && (
                      <td className="py-3 px-4 text-right">
                        {!b.pagado && (
                          <Button variant="success" onClick={() => marcarPagado(b)} {...roProps} className="px-3 py-1 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Check size={12} /> Marcar pagado
                            </span>
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// TAB: FICHAJES (últimos 20, admin/oficina)
// ============================================================
function TabFichajes() {
  const [lista, setLista] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Fichaje[]>('/api/fichajes')
      .then((data) => setLista(Array.isArray(data) ? data : []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, []);

  const recientes = lista.slice(0, 20);

  return (
    <Card className="p-0 overflow-hidden">
      {loading ? (
        <Spinner />
      ) : recientes.length === 0 ? (
        <EmptyState message="Todavía no hay fichajes registrados." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-base-700/40">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Fecha y hora</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((f) => (
                <tr key={f.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-100">{f.user_nombre ?? `Usuario #${f.user_id}`}</td>
                  <td className="py-3 px-4">
                    <Badge color={f.tipo === 'entrada' ? 'success' : 'slate'}>
                      {f.tipo === 'entrada' ? '🟢 Entrada' : '⚪ Salida'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{fmtFecha(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// TAB: CLOSERS
// ============================================================
function TabClosers({ closers, onVerMetricas }: { closers: Closer[]; onVerMetricas: (id: number) => void }) {
  return (
    <div>
      {closers.length === 0 ? (
        <Card>
          <EmptyState message="No hay closers registrados." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {closers.map((c) => (
            <div key={c.id} className="glass p-5 transition-all hover:border-neon/50 hover:shadow-glow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-neon/10 border border-neon/40 flex items-center justify-center text-neon font-extrabold">
                  {c.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-bold text-slate-100">{c.nombre}</p>
                  <Badge color="neon">Closer</Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 space-y-1 mb-4">
                <p>{c.email}</p>
                <p>{c.telefono || 'Sin teléfono'}</p>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => onVerMetricas(c.id)}>
                <span className="inline-flex items-center gap-2">
                  <BarChart3 size={14} /> Ver métricas
                </span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: METAS — admin define la meta mensual (USD) de cada usuario
// ============================================================
interface MetaEntry {
  user_id: number;
  nombre: string;
  rol?: string | null;
  monto_usd: number | null;
  vendido_usd: number;
  cumplida: boolean;
}

function TabMetas({ readOnly }: { readOnly: boolean }) {
  const [metas, setMetas] = useState<MetaEntry[]>([]);
  const [mes, setMes] = useState('');
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ mes: string; metas: MetaEntry[] }>('/api/metas');
      setMes(r.mes);
      setMetas(r.metas ?? []);
      const m: Record<number, string> = {};
      for (const x of r.metas ?? []) m[x.user_id] = x.monto_usd ? String(x.monto_usd) : '';
      setMontos(m);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando metas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async (userId: number) => {
    setGuardando(userId);
    setError('');
    try {
      await api.put('/api/metas', { user_id: userId, monto_usd: Number(montos[userId] || 0) });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando meta');
    } finally {
      setGuardando(null);
    }
  };

  if (loading) return <Spinner />;

  const mesLabel = mes
    ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Target size={18} className="text-neon" />
        <h2 className="text-base font-bold text-slate-100">Metas de venta — {mesLabel}</h2>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Definí cuánto tiene que vender cada uno este mes. La barra muestra el progreso real contra las ventas cargadas.
        Poné 0 para quitar la meta.
      </p>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      <div className="space-y-4">
        {metas.map((m) => {
          const pct = m.monto_usd ? Math.min(100, Math.round((m.vendido_usd / m.monto_usd) * 100)) : 0;
          return (
            <div key={m.user_id} className="p-4 rounded-xl bg-base-700/60 border border-slate-600/20 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-100 flex-1 min-w-[120px]">
                  {m.nombre}
                  {m.rol && <span className="text-xs text-slate-500 ml-2">({m.rol})</span>}
                </span>
                {m.cumplida && <Badge color="success">Meta cumplida 🎉</Badge>}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="USD"
                    value={montos[m.user_id] ?? ''}
                    onChange={(e) => setMontos({ ...montos, [m.user_id]: e.target.value })}
                    disabled={readOnly}
                    className="!w-32"
                  />
                  {!readOnly && (
                    <Button onClick={() => void guardar(m.user_id)} disabled={guardando === m.user_id}>
                      {guardando === m.user_id ? 'Guardando…' : 'Guardar'}
                    </Button>
                  )}
                </div>
              </div>
              {m.monto_usd ? (
                <>
                  <div className="h-2.5 rounded-full bg-base-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', m.cumplida ? 'bg-success' : 'bg-neon-grad')}
                      style={{ width: `${Math.max(3, pct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="text-neon font-bold">{fmtUSD(m.vendido_usd)}</span> de {fmtUSD(m.monto_usd)} ({pct}%)
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">Sin meta definida — vendido este mes: {fmtUSD(m.vendido_usd)}</p>
              )}
            </div>
          );
        })}
        {metas.length === 0 && <EmptyState message="No hay usuarios para asignar metas." />}
      </div>
    </Card>
  );
}

// ============================================================
// TAB: ACTIVIDAD — auditoría de movimientos + backup descargable
// ============================================================
interface ActividadEntry {
  id: number;
  user_id: number | null;
  user_nombre: string | null;
  accion: string | null;
  detalle: string | null;
  created_at: string | null;
}

function TabActividad({ esAdmin }: { esAdmin: boolean }) {
  const [items, setItems] = useState<ActividadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<ActividadEntry[]>('/api/actividad?limit=150');
        setItems(Array.isArray(r) ? r : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando actividad');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const descargarBackup = async () => {
    setBajando(true);
    try {
      const res = await fetch('/api/backup', {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iphone-culture-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo descargar el backup');
    } finally {
      setBajando(false);
    }
  };

  const accionColor = (a: string | null): 'neon' | 'amber' | 'red' =>
    a === 'Eliminación' ? 'red' : a === 'Edición' ? 'amber' : 'neon';

  return (
    <div className="space-y-6">
      {esAdmin && (
        <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Download size={20} className="text-neon shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Backup de la base de datos</h2>
              <p className="text-xs text-slate-400">
                Se guarda una copia automática todos los días en la iMac. Además podés descargar una copia manual acá.
              </p>
            </div>
          </div>
          <Button onClick={() => void descargarBackup()} disabled={bajando}>
            <Download size={15} className="inline mr-1 -mt-0.5" />
            {bajando ? 'Descargando…' : 'Descargar backup'}
          </Button>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-admin" />
          <h2 className="text-base font-bold text-slate-100">Últimos movimientos</h2>
        </div>
        {loading ? (
          <Spinner />
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <EmptyState message="Todavía no hay movimientos registrados. Se registran altas, ediciones y borrados de ventas, leads, stock, turnos, catálogo y bonos." />
        ) : (
          <ul className="space-y-2 max-h-[480px] overflow-y-auto">
            {items.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-base-700/60 border border-slate-600/20 text-sm"
              >
                <Badge color={accionColor(a.accion)}>{a.accion || 'Movimiento'}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-200 truncate">{a.detalle || '—'}</p>
                  <p className="text-[11px] text-slate-500">
                    {a.user_nombre || 'Sistema'} · {fmtFecha(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
