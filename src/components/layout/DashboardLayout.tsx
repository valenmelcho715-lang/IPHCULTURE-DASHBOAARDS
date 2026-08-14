import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, ShoppingCart, Package, CalendarDays,
  Repeat, FileText, Wrench, AlertTriangle, Gift, Target, BookOpen,
  LogOut, ChevronLeft, ChevronRight, Smartphone, BarChart3, Mail,
  Newspaper, MessageSquare, Calculator
} from 'lucide-react';

const adminMenu = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/ventas', label: 'Todas las Ventas', icon: ShoppingCart },
  { path: '/admin/closers', label: 'Vendedores', icon: Users },
  { path: '/admin/mensajes', label: 'Mensajes', icon: MessageSquare },
  { path: '/admin/noticias', label: 'Noticias', icon: Newspaper },
  { path: '/stock', label: 'Stock', icon: Package },
  { path: '/leads', label: 'Leads', icon: Target },
  { path: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { path: '/cuotero', label: 'Cuotero', icon: Calculator },
];

const closerMenu = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ventas', label: 'Mis Ventas', icon: ShoppingCart },
  { path: '/metricas', label: 'Mis Métricas', icon: BarChart3 },
  { path: '/calendario', label: 'Calendario', icon: CalendarDays },
  { path: '/mensajes', label: 'Mensajes', icon: Mail },
  { path: '/stock', label: 'Stock', icon: Package },
  { path: '/leads', label: 'Leads', icon: Target },
  { path: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { path: '/cuotero', label: 'Cuotero', icon: Calculator },
  { path: '/facturas', label: 'Facturas', icon: FileText },
  { path: '/canjes', label: 'Canjes', icon: Repeat },
  { path: '/bonos', label: 'Bonos', icon: Gift },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.rol === 'admin';
  const menuItems = isAdmin ? adminMenu : closerMenu;

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
      <aside className={`flex flex-col border-r border-cyan-500/20 bg-[#0d0d14] transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
        style={{ boxShadow: '0 0 30px rgba(0,240,255,0.05)' }}>
        <div className={`flex items-center gap-3 p-4 border-b border-cyan-500/20 ${collapsed ? 'justify-center' : ''}`}>
          <Smartphone className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.6))' }} />
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold tracking-tight text-cyan-400" style={{ textShadow: '0 0 10px rgba(0,240,255,0.5)' }}>iPhone Culture</h1>
              <p className="text-[10px] text-cyan-400/60 uppercase tracking-widest">{isAdmin ? 'Admin' : 'Closer'} Dashboard</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-200 group ${
                  isActive ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/5'
                }`}
                style={isActive ? { boxShadow: '0 0 15px rgba(0,240,255,0.1)' } : {}}>
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`}
                  style={isActive ? { filter: 'drop-shadow(0 0 5px rgba(0,240,255,0.6))' } : {}} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px rgba(0,240,255,0.8)' }} />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-cyan-500/20 p-3 space-y-2">
          {!collapsed && user && (
            <div className="px-2 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
              <p className="text-xs text-cyan-300 font-medium truncate">{user.nombre}</p>
              <p className="text-[10px] text-cyan-400/50 truncate">{user.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] border ${isAdmin ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                {user.rol}
              </span>
            </div>
          )}
          <button onClick={logout} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors ${collapsed ? 'justify-center' : ''}`}>
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="text-sm">Salir</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-gray-500 hover:text-cyan-400 transition-colors ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
