// ============================================================
// pages/Reportes.tsx — Estadísticas del negocio (admin/oficina)
// Ventas por vendedor y por día, embudo de leads, fuentes,
// top productos, ticket promedio y cobros pendientes.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  BarChart3, TrendingUp, Users, Target, ShoppingBag, AlertCircle, Filter,
} from 'lucide-react';
import { api, fmtUSD } from '../lib/api';
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from '../components/ui';

interface Reporte {
  ventas_por_vendedor: Array<{ nombre: string; total_usd: number; cantidad: number }>;
  ventas_por_dia: Array<{ dia: string; total_usd: number; cantidad: number }>;
  leads_por_estado: Array<{ estado: string; cantidad: number }>;
  leads_por_fuente: Array<{ fuente: string; cantidad: number }>;
  top_productos: Array<{ producto: string; cantidad: number; total_usd: number }>;
  mes_actual: { ticket_promedio_usd: number; total_usd: number; cantidad: number; ganancia_usd: number };
  conversion_leads: { ganados: number; total: number; pct: number };
  cobros_pendientes: { cantidad: number; total_usd: number };
}

const tooltipStyle = {
  backgroundColor: '#101018',
  border: '1px solid rgba(0,240,255,0.25)',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 13,
} as const;

const COLORES = ['#00f0ff', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#94a3b8'];

const estadoColor = (e: string): string => {
  switch (e) {
    case 'Ganado': return '#34d399';
    case 'Perdido': return '#f87171';
    case 'Negociando': return '#f59e0b';
    case 'Interesado': return '#a78bfa';
    case 'Contactado': return '#94a3b8';
    default: return '#00f0ff';
  }
};

export default function Reportes() {
  const [data, setData] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<Reporte>('/api/reportes/resumen');
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando reportes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartDias = useMemo(
    () =>
      (data?.ventas_por_dia ?? []).map((d) => ({
        dia: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7),
        total: d.total_usd,
        cantidad: d.cantidad,
      })),
    [data]
  );

  if (loading) return <Spinner />;
  if (error || !data) return <EmptyState message={`No se pudieron cargar los reportes: ${error ?? ''}`} />;

  return (
    <div className="space-y-8">
      <PageHeader title="Reportes" subtitle="Estadísticas del negocio en tiempo real" />

      {/* KPIs del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas del mes" value={fmtUSD(data.mes_actual.total_usd)} accent="neon" />
        <StatCard label="Ticket promedio" value={fmtUSD(data.mes_actual.ticket_promedio_usd)} accent="success" />
        <StatCard label="Cierre cobrado · Atención IA" value={`${data.conversion_leads.pct}%`} accent="violet" />
        <StatCard
          label="Por cobrar (señas)"
          value={fmtUSD(data.cobros_pendientes.total_usd)}
          accent="amber"
          hint={`${data.cobros_pendientes.cantidad} ventas incompletas`}
        />
      </div>

      {/* Ventas últimos 30 días */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-neon" />
          <h2 className="text-base font-bold text-slate-100">Ventas — últimos 30 días</h2>
        </div>
        {chartDias.length === 0 ? (
          <EmptyState message="Sin ventas en los últimos 30 días." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDias" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="dia" stroke="#64748b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} width={44}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtUSD(v), 'Ventas']} />
                <Area type="monotone" dataKey="total" stroke="#00f0ff" strokeWidth={2.5} fill="url(#gradDias)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ventas por vendedor */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-admin" />
            <h2 className="text-base font-bold text-slate-100">Ventas del mes por vendedor</h2>
          </div>
          {data.ventas_por_vendedor.length === 0 ? (
            <EmptyState message="Sin ventas este mes." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ventas_por_vendedor} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} width={44}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => (name === 'total_usd' ? [fmtUSD(v), 'Vendido'] : [v, 'Ventas'])}
                  />
                  <Bar dataKey="total_usd" radius={[6, 6, 0, 0]}>
                    {data.ventas_por_vendedor.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Embudo de leads */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-oficina" />
            <h2 className="text-base font-bold text-slate-100">Embudo de leads</h2>
            <Badge color="neon">{data.conversion_leads.ganados}/{data.conversion_leads.total} oportunidades IA cobradas</Badge>
          </div>
          <div className="space-y-2.5">
            {data.leads_por_estado.map((l) => {
              const max = Math.max(1, ...data.leads_por_estado.map((x) => x.cantidad));
              return (
                <div key={l.estado} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">{l.estado}</span>
                    <span className="text-slate-400">{l.cantidad}</span>
                  </div>
                  <div className="h-2 rounded-full bg-base-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(3, (l.cantidad / max) * 100)}%`, backgroundColor: estadoColor(l.estado) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag size={18} className="text-success" />
            <h2 className="text-base font-bold text-slate-100">Productos más vendidos</h2>
          </div>
          {data.top_productos.length === 0 ? (
            <EmptyState message="Sin ventas registradas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-600/30">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Producto</th>
                    <th className="pb-2 pr-4">Uds.</th>
                    <th className="pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_productos.map((p, i) => (
                    <tr key={i} className="border-b border-slate-600/10 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-500">{i + 1}</td>
                      <td className="py-2.5 pr-4 text-slate-200">{p.producto}</td>
                      <td className="py-2.5 pr-4">{p.cantidad}</td>
                      <td className="py-2.5 font-semibold text-neon">{fmtUSD(p.total_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Leads por fuente */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-neon" />
            <h2 className="text-base font-bold text-slate-100">De dónde vienen los leads</h2>
          </div>
          <div className="space-y-2.5">
            {data.leads_por_fuente.map((f, i) => {
              const total = Math.max(1, data.leads_por_fuente.reduce((a, b) => a + b.cantidad, 0));
              return (
                <div key={f.fuente} className="flex items-center gap-3">
                  <span className="w-24 text-xs font-semibold text-slate-300 truncate">{f.fuente}</span>
                  <div className="flex-1 h-2 rounded-full bg-base-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(f.cantidad / total) * 100}%`, backgroundColor: COLORES[i % COLORES.length] }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-16 text-right">
                    {f.cantidad} ({Math.round((f.cantidad / total) * 100)}%)
                  </span>
                </div>
              );
            })}
          </div>
          {data.cobros_pendientes.cantidad > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-700/40 flex items-start gap-2 text-xs text-amber-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>
                Hay <b>{data.cobros_pendientes.cantidad}</b> ventas con saldo pendiente por un total de{' '}
                <b>{fmtUSD(data.cobros_pendientes.total_usd)}</b>. Conviene retomar esos cobros.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Ganancia del mes */}
      <Card className="flex items-center gap-3">
        <Target size={20} className="text-success shrink-0" />
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Ganancia del mes</p>
          <p className="text-lg font-bold text-slate-100">{fmtUSD(data.mes_actual.ganancia_usd)}</p>
        </div>
      </Card>
    </div>
  );
}
