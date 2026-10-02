import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import {
  DollarSign, TrendingUp, Award, ShoppingCart, CalendarDays,
  Target, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function CloserMetricas() {
  const [metricas, setMetricas] = useState<any>(null);

  useEffect(() => {
    apiGet('/metricas').then(setMetricas);
  }, []);

  if (!metricas) return <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-cyan-400">Cargando...</div>;

  const hoy = metricas.hoy || { c: 0, total: 0, comision: 0 };
  const semana = metricas.semana || { c: 0, total: 0, comision: 0 };
  const mes = metricas.mes || { c: 0, total: 0, comision: 0 };
  const historial = metricas.historial || [];
  const promedio = metricas.promedio?.promedio || 0;
  const totalAcumulado = metricas.totalAcumulado?.total || 0;
  const pendientes = metricas.pendientes || { c: 0, monto: 0 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gradient-cyan mb-1">Mis Métricas</h1>
        <p className="text-gray-400 text-sm">Tu rendimiento en tiempo real</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Hoy" value={`$${(hoy.total || 0).toLocaleString()}`} sub={`${hoy.c} ventas`} trend={hoy.c > 0 ? 'up' : 'neutral'} icon={DollarSign} color="text-emerald-400" />
        <MetricCard label="Semana" value={`$${(semana.total || 0).toLocaleString()}`} sub={`${semana.c} ventas`} trend="up" icon={TrendingUp} color="text-cyan-400" />
        <MetricCard label="Mes" value={`$${(mes.total || 0).toLocaleString()}`} sub={`${mes.c} ventas`} trend="up" icon={ShoppingCart} color="text-violet-400" />
        <MetricCard label="Comisión Mes" value={`$${(mes.comision || 0).toLocaleString()}`} sub={`${((mes.comision / (mes.total || 1)) * 100).toFixed(1)}% del total`} trend="up" icon={Award} color="text-fuchsia-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Promedio y totales */}
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
          <h3 className="text-sm font-semibold text-cyan-300 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Resumen
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-black/20">
              <span className="text-gray-400">Promedio por venta</span>
              <span className="text-lg font-bold text-cyan-400">${promedio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-black/20">
              <span className="text-gray-400">Comisiones acumuladas</span>
              <span className="text-lg font-bold text-fuchsia-400">${totalAcumulado.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-black/20">
              <span className="text-gray-400">Pagos pendientes (señas)</span>
              <span className="text-lg font-bold text-amber-400">${(pendientes.monto || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-black/20">
              <span className="text-gray-400">Leads asignados</span>
              <span className="text-lg font-bold text-blue-400">{metricas.leads?.c || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-black/20">
              <span className="text-gray-400">Turnos hoy</span>
              <span className="text-lg font-bold text-violet-400">{metricas.turnosHoy?.c || 0}</span>
            </div>
          </div>
        </div>

        {/* Historial mensual */}
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
          <h3 className="text-sm font-semibold text-cyan-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Historial Mensual
          </h3>
          <div className="space-y-3">
            {historial.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Sin historial aún</p>
            ) : (
              historial.map((h: any) => (
                <div key={h.mes} className="flex items-center justify-between p-3 rounded-lg bg-black/20">
                  <div>
                    <p className="text-sm text-white font-medium">{h.mes}</p>
                    <p className="text-xs text-gray-400">{h.ventas} ventas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">${h.total.toLocaleString()}</p>
                    <p className="text-xs text-fuchsia-400">+${h.comisiones.toFixed(2)} comisión</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gráfico simple de barras */}
      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Ventas por Mes</h3>
        <div className="flex items-end gap-2 h-40">
          {historial.slice(0, 12).reverse().map((h: any) => {
            const max = Math.max(...historial.map((x: any) => x.total), 1);
            const height = (h.total / max) * 100;
            return (
              <div key={h.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-cyan-500/30 hover:bg-cyan-400/50 transition-colors relative group" style={{ height: `${height}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0d0d14] border border-cyan-500/20 px-2 py-1 rounded text-xs text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${h.total.toLocaleString()}
                  </div>
                </div>
                <span className="text-[10px] text-gray-500">{h.mes.slice(5)}</span>
              </div>
            );
          })}
          {historial.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Sin datos</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, trend, icon: Icon, color }: any) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14] p-4 glow-cyan">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
        <span className="text-xs text-gray-500">{sub}</span>
      </div>
    </div>
  );
}
