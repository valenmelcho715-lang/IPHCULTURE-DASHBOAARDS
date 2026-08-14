import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  LayoutDashboard, Users, ShoppingCart, Package, CalendarDays,
  Target, DollarSign, TrendingUp, Award, Repeat, FileText, Wrench, AlertTriangle, Gift, BookOpen
} from 'lucide-react';

const quickLinks = [
  { path: '/clientes', label: 'Clientes', icon: Users, color: 'from-cyan-500/20 to-cyan-500/5', border: 'border-cyan-500/20' },
  { path: '/ventas', label: 'Ventas', icon: ShoppingCart, color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20' },
  { path: '/stock', label: 'Stock', icon: Package, color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20' },
  { path: '/turnos', label: 'Turnos', icon: CalendarDays, color: 'from-violet-500/20 to-violet-500/5', border: 'border-violet-500/20' },
  { path: '/canjes', label: 'Canjes', icon: Repeat, color: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/20' },
  { path: '/facturas', label: 'Facturas', icon: FileText, color: 'from-pink-500/20 to-pink-500/5', border: 'border-pink-500/20' },
  { path: '/postventa', label: 'Postventa', icon: Wrench, color: 'from-teal-500/20 to-teal-500/5', border: 'border-teal-500/20' },
  { path: '/casos', label: 'Casos', icon: AlertTriangle, color: 'from-red-500/20 to-red-500/5', border: 'border-red-500/20' },
  { path: '/bonos', label: 'Bonos', icon: Gift, color: 'from-yellow-500/20 to-yellow-500/5', border: 'border-yellow-500/20' },
  { path: '/leads', label: 'Leads', icon: Target, color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/20' },
  { path: '/catalogo', label: 'Catálogo', icon: BookOpen, color: 'from-fuchsia-500/20 to-fuchsia-500/5', border: 'border-fuchsia-500/20' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiGet('/stats').then(setStats);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gradient-cyan mb-1">Dashboard</h1>
        <p className="text-gray-400 text-sm">Panel de control de iPhone Culture</p>
      </div>

      {/* Priority Alert */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3 animate-pulse-glow">
        <Award className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" style={{ filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.5))' }} />
        <div>
          <h3 className="text-amber-300 font-semibold text-sm">🥇 PRIORIDAD ALTA</h3>
          <p className="text-amber-200/70 text-sm mt-1">
            <strong>EDUARDO RONDON</strong> dejó <strong>300 USD</strong> a favor para un 15 Pro Max / 16 Pro Max.
            Contactarlo PRIMERO que a cualquier otra persona.
          </p>
          <div className="flex gap-4 mt-2 text-xs text-amber-300/60">
            <span>IG: <strong className="text-amber-300">EDUARDO2676</strong></span>
            <span>WPP: <strong className="text-amber-300">2993332164</strong></span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Ventas del Mes" value={`$${(stats?.ventasMes || 0).toLocaleString()}`} icon={DollarSign} color="text-emerald-400" />
        <StatCard label="Ganancia Mes" value={`$${(stats?.gananciaMes || 0).toLocaleString()}`} icon={TrendingUp} color="text-cyan-400" />
        <StatCard label="Comisiones Mes" value={`$${(stats?.comisionesMes || 0).toLocaleString()}`} icon={Award} color="text-fuchsia-400" />
        <StatCard label="Total Clientes" value={stats?.totalClientes || 0} icon={Users} color="text-blue-400" />
        <StatCard label="Stock Total" value={stats?.totalStock || 0} icon={Package} color="text-amber-400" />
        <StatCard label="Turnos Hoy" value={stats?.turnosHoy || 0} icon={CalendarDays} color="text-violet-400" />
        <StatCard label="Leads Nuevos" value={stats?.leadsNuevos || 0} icon={Target} color="text-pink-400" />
        <StatCard label="Total Ventas" value={stats?.totalVentas || 0} icon={ShoppingCart} color="text-teal-400" />
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-cyan-300 mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${link.border} bg-gradient-to-b ${link.color} hover:scale-105 transition-all duration-200 group`}
                style={{ boxShadow: '0 0 15px rgba(0,0,0,0.3)' }}
              >
                <Icon className="w-6 h-6 text-white/80 group-hover:text-white transition-colors" />
                <span className="text-xs font-medium text-white/80 group-hover:text-white">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14] p-4 glow-cyan">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} style={{ filter: `drop-shadow(0 0 4px currentColor)` }} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
