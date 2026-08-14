import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';
import {
  DollarSign, TrendingUp, Award, ShoppingCart, CalendarDays, Target,
  Mail, AlertCircle, ArrowRight, Smartphone, MessageCircle
} from 'lucide-react';

export default function CloserDashboard() {
  const { user } = useAuth();
  const [metricas, setMetricas] = useState<any>(null);
  const [noticias, setNoticias] = useState<any[]>([]);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [proximosTurnos, setProximosTurnos] = useState<any[]>([]);
  const [userTelefono, setUserTelefono] = useState('');

  useEffect(() => {
    apiGet('/metricas').then(setMetricas);
    apiGet('/noticias').then((d: any[]) => setNoticias(d.slice(0, 3)));
    apiGet('/mensajes').then((d: any[]) => setMensajes(d.filter((m: any) => !m.leido).slice(0, 3)));
    apiGet('/turnos').then((d: any[]) => {
      const hoy = new Date();
      const filtrados = d.filter((t: any) => new Date(t.fecha_hora) >= hoy).sort((a: any, b: any) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
      setProximosTurnos(filtrados.slice(0, 3));
    });
    apiGet('/auth/me').then((me: any) => {
      if (me?.telefono) setUserTelefono(me.telefono);
    });
  }, []);

  const waLink = (telefono: string, mensaje: string) => {
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-cyan mb-1">¡Hola, {user?.nombre}!</h1>
        <p className="text-gray-400 text-sm">Tu panel de control personal</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Hoy" value={`$${(metricas?.hoy?.total || 0).toLocaleString()}`} sub={`${metricas?.hoy?.c || 0} ventas`} icon={DollarSign} color="text-emerald-400" />
        <StatCard label="Semana" value={`$${(metricas?.semana?.total || 0).toLocaleString()}`} sub={`${metricas?.semana?.c || 0} ventas`} icon={TrendingUp} color="text-cyan-400" />
        <StatCard label="Mes" value={`$${(metricas?.mes?.total || 0).toLocaleString()}`} sub={`${metricas?.mes?.c || 0} ventas`} icon={ShoppingCart} color="text-violet-400" />
        <StatCard label="Comisión Mes" value={`$${(metricas?.mes?.comision || 0).toLocaleString()}`} icon={Award} color="text-fuchsia-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mensajes no leídos */}
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Mensajes
            </h3>
            {mensajes.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">{mensajes.length} nuevos</span>}
          </div>
          {mensajes.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay mensajes nuevos</p>
          ) : (
            <div className="space-y-2">
              {mensajes.map(m => (
                <div key={m.id} className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                  <p className="text-sm font-medium text-cyan-300">{m.titulo}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.contenido}</p>
                </div>
              ))}
            </div>
          )}
          <Link to="/mensajes" className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></Link>
        </div>

        {/* Noticias */}
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Noticias
          </h3>
          <div className="space-y-2">
            {noticias.map(n => (
              <div key={n.id} className={`p-3 rounded-lg border ${n.tipo === 'urgente' ? 'bg-red-500/5 border-red-500/20' : n.tipo === 'stock' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-cyan-500/5 border-cyan-500/10'}`}>
                <p className={`text-sm font-medium ${n.tipo === 'urgente' ? 'text-red-300' : n.tipo === 'stock' ? 'text-amber-300' : 'text-cyan-300'}`}>{n.titulo}</p>
                <p className="text-xs text-gray-400 mt-1">{n.contenido}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Próximos turnos */}
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <h3 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Próximos Turnos
          </h3>
          {proximosTurnos.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin turnos próximos</p>
          ) : (
            <div className="space-y-2">
              {proximosTurnos.map(t => {
                const mensaje = `⏰ Recordatorio de turno con ${t.cliente_nombre} (${t.tipo}). Fecha: ${new Date(t.fecha_hora).toLocaleString('es-AR')}`;
                const link = userTelefono ? waLink(userTelefono, mensaje) : null;
                const en30Min = new Date(t.fecha_hora).getTime() <= Date.now() + 30 * 60000;
                return (
                  <div key={t.id} className={`p-3 rounded-lg border ${en30Min ? 'bg-red-500/5 border-red-500/20' : 'bg-violet-500/5 border-violet-500/10'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{t.cliente_nombre}</p>
                        <p className={`text-xs ${en30Min ? 'text-red-300' : 'text-violet-300'}`}>{new Date(t.fecha_hora).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">{t.tipo}</span>
                      </div>
                      {link && en30Min && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/calendario" className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-flex items-center gap-1">Ver calendario <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/ventas', label: 'Nueva Venta', icon: ShoppingCart, color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/20' },
          { to: '/calendario', label: 'Nuevo Turno', icon: CalendarDays, color: 'from-violet-500/20 to-violet-500/5', border: 'border-violet-500/20' },
          { to: '/metricas', label: 'Mis Métricas', icon: TrendingUp, color: 'from-cyan-500/20 to-cyan-500/5', border: 'border-cyan-500/20' },
          { to: '/catalogo', label: 'Catálogo', icon: Smartphone, color: 'from-fuchsia-500/20 to-fuchsia-500/5', border: 'border-fuchsia-500/20' },
        ].map(link => {
          const Icon = link.icon;
          const waLink = (telefono: string, mensaje: string) => {
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  };

  return (
            <Link key={link.to} to={link.to} className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${link.border} bg-gradient-to-b ${link.color} hover:scale-105 transition-all`}>
              <Icon className="w-6 h-6 text-white/80" />
              <span className="text-xs font-medium text-white/80">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  const waLink = (telefono: string, mensaje: string) => {
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  };

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
