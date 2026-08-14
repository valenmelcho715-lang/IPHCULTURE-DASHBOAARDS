import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import CustomCursor from '@/components/layout/CustomCursor';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Login from '@/pages/Login';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminVentas from '@/pages/admin/AdminVentas';
import AdminClosers from '@/pages/admin/AdminClosers';
import AdminMensajes from '@/pages/admin/AdminMensajes';
import AdminNoticias from '@/pages/admin/AdminNoticias';

// Closer pages
import CloserDashboard from '@/pages/closer/CloserDashboard';
import CloserVentas from '@/pages/closer/CloserVentas';
import CloserMetricas from '@/pages/closer/CloserMetricas';
import CloserCalendario from '@/pages/closer/CloserCalendario';
import CloserMensajes from '@/pages/closer/CloserMensajes';

// Shared pages
import Stock from '@/pages/Stock';
import Canjes from '@/pages/Canjes';
import Facturas from '@/pages/Facturas';
import Postventa from '@/pages/Postventa';
import Casos from '@/pages/Casos';
import Bonos from '@/pages/Bonos';
import Leads from '@/pages/Leads';
import Catalogo from '@/pages/Catalogo';
import Cuotero from '@/pages/Cuotero';
import FacturaView from '@/pages/FacturaView';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-cyan-400">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.rol !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/factura/:id" element={<FacturaView />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/ventas" element={<ProtectedRoute requireAdmin><AdminVentas /></ProtectedRoute>} />
        <Route path="/admin/closers" element={<ProtectedRoute requireAdmin><AdminClosers /></ProtectedRoute>} />
        <Route path="/admin/mensajes" element={<ProtectedRoute requireAdmin><AdminMensajes /></ProtectedRoute>} />
        <Route path="/admin/noticias" element={<ProtectedRoute requireAdmin><AdminNoticias /></ProtectedRoute>} />

        {/* Closer routes */}
        <Route path="/" element={user?.rol === 'admin' ? <Navigate to="/admin" /> : <CloserDashboard />} />
        <Route path="/ventas" element={<CloserVentas />} />
        <Route path="/metricas" element={<CloserMetricas />} />
        <Route path="/calendario" element={<CloserCalendario />} />
        <Route path="/mensajes" element={<CloserMensajes />} />

        {/* Shared */}
        <Route path="/stock" element={<Stock />} />
        <Route path="/canjes" element={<Canjes />} />
        <Route path="/facturas" element={<Facturas />} />
        <Route path="/postventa" element={<Postventa />} />
        <Route path="/casos" element={<Casos />} />
        <Route path="/bonos" element={<Bonos />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/cuotero" element={<Cuotero />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CustomCursor />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
