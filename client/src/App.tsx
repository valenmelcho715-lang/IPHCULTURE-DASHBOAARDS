import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import CustomCursor from '@/components/layout/CustomCursor';
const DashboardLayout = lazy(() => import('@/components/layout/DashboardLayout'));
const Login = lazy(() => import('@/pages/Login'));

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminVentas = lazy(() => import('@/pages/admin/AdminVentas'));
const AdminClosers = lazy(() => import('@/pages/admin/AdminClosers'));
const AdminMensajes = lazy(() => import('@/pages/admin/AdminMensajes'));
const AdminNoticias = lazy(() => import('@/pages/admin/AdminNoticias'));

// Closer pages
const CloserDashboard = lazy(() => import('@/pages/closer/CloserDashboard'));
const CloserVentas = lazy(() => import('@/pages/closer/CloserVentas'));
const CloserMetricas = lazy(() => import('@/pages/closer/CloserMetricas'));
const CloserCalendario = lazy(() => import('@/pages/closer/CloserCalendario'));
const CloserMensajes = lazy(() => import('@/pages/closer/CloserMensajes'));

// Shared pages
const Stock = lazy(() => import('@/pages/Stock'));
const Canjes = lazy(() => import('@/pages/Canjes'));
const Facturas = lazy(() => import('@/pages/Facturas'));
const Postventa = lazy(() => import('@/pages/Postventa'));
const Casos = lazy(() => import('@/pages/Casos'));
const Bonos = lazy(() => import('@/pages/Bonos'));
const Leads = lazy(() => import('@/pages/Leads'));
const Catalogo = lazy(() => import('@/pages/Catalogo'));
const Cuotero = lazy(() => import('@/pages/Cuotero'));
const FacturaView = lazy(() => import('@/pages/FacturaView'));
const Atencion = lazy(() => import('@/pages/Atencion'));

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-cyan-400">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.rol !== 'admin' && user.rol !== 'oficina') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const isAdminOrOficina = user?.rol === 'admin' || user?.rol === 'oficina';

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-cyan-400">Cargando…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/factura/:id" element={<FacturaView />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        {/* Admin routes (admin + oficina pueden ver) */}
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/ventas" element={<ProtectedRoute requireAdmin><AdminVentas /></ProtectedRoute>} />
        <Route path="/admin/closers" element={<ProtectedRoute requireAdmin><AdminClosers /></ProtectedRoute>} />
        <Route path="/admin/mensajes" element={<ProtectedRoute requireAdmin><AdminMensajes /></ProtectedRoute>} />
        <Route path="/admin/noticias" element={<ProtectedRoute requireAdmin><AdminNoticias /></ProtectedRoute>} />

        {/* Closer routes */}
        <Route path="/" element={isAdminOrOficina ? <Navigate to="/admin" /> : <CloserDashboard />} />
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
        <Route path="/atencion" element={<Atencion />} />
      </Route>
    </Routes>
    </Suspense>
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
