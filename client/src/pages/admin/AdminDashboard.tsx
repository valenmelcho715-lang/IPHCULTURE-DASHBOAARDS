import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  LayoutDashboard, Users, DollarSign, ShoppingCart, Target,
  Plus, Trash2, MessageSquare, Newspaper, Award
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [noticias, setNoticias] = useState<any[]>([]);
  const [mensajes, setMensajes] = useState<any[]>([]);

  useEffect(() => {
    apiGet('/admin/stats').then(setStats);
    apiGet('/noticias').then((d: any[]) => setNoticias(d.slice(0, 5)));
    apiGet('/mensajes').then((d: any[]) => setMensajes(d.slice(0, 5)));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-cyan mb-1">Panel de Administración</h1>
        <p className="text-gray-400 text-sm">Control total del negocio</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Ventas Totales" value={`$${(stats?.totalVentas?.total || 0).toLocaleString()}`} sub={`${stats?.totalVentas?.c || 0} ventas`} icon={DollarSign} color="text-emerald-400" />
        <StatCard label="Ganancia Total" value={`$${(stats?.totalVentas?.ganancia || 0).toLocaleString()}`} icon={ShoppingCart} color="text-cyan-400" />
        <StatCard label="Comisiones Total" value={`$${(stats?.totalVentas?.comisiones || 0).toLocaleString()}`} icon={Award} color="text-fuchsia-400" />
        <StatCard label="Clientes" value={stats?.totalClientes?.c || 0} icon={Users} color="text-blue-400" />
        <StatCard label="Stock" value={stats?.totalStock?.c || 0} icon={Target} color="text-amber-400" />
        <StatCard label="Leads Nuevos" value={stats?.leadsNuevos?.c || 0} icon={Target} color="text-pink-400" />
        <StatCard label="Vendedores" value={stats?.porCloser?.length || 0} icon={Users} color="text-violet-400" />
      </div>

      {/* Por vendedor */}
      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Rendimiento por Vendedor</h3>
        <div className="space-y-3">
          {(stats?.porCloser || []).map((c: any) => (
            <div key={c.nombre} className="flex items-center justify-between p-3 rounded-lg bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-cyan-400">{c.nombre.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{c.nombre}</p>
                  <p className="text-xs text-gray-400">{c.ventas} ventas</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">${(c.total || 0).toLocaleString()}</p>
                <p className="text-xs text-fuchsia-400">+${(c.comisiones || 0).toFixed(2)} comisión</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Noticias y mensajes recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
            <Newspaper className="w-4 h-4" /> Noticias Recientes
          </h3>
          <div className="space-y-2">
            {noticias.map(n => (
              <div key={n.id} className={`p-3 rounded-lg border ${n.tipo === 'urgente' ? 'bg-red-500/5 border-red-500/20' : n.tipo === 'stock' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-cyan-500/5 border-cyan-500/10'}`}>
                <p className={`text-sm font-medium ${n.tipo === 'urgente' ? 'text-red-300' : n.tipo === 'stock' ? 'text-amber-300' : 'text-cyan-300'}`}>{n.titulo}</p>
                <p className="text-xs text-gray-400">{n.contenido}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Mensajes Recientes
          </h3>
          <div className="space-y-2">
            {mensajes.map(m => (
              <div key={m.id} className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-sm font-medium text-cyan-300">Para: {m.closer_nombre || `#${m.closer_id}`}</p>
                <p className="text-xs text-gray-400">{m.titulo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14] p-4 glow-cyan">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
