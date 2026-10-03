// ============================================================
// App.tsx — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// Router completo. Las páginas viven en src/pages/*.
// ============================================================
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ventas from './pages/Ventas';
import Canjes from './pages/Canjes';
import Chat from './pages/Chat';
import Atencion from './pages/Atencion';
import Facturas from './pages/Facturas';
import Turnos from './pages/Turnos';
import Leads from './pages/Leads';
import Cuotero from './pages/Cuotero';
import Catalogo from './pages/Catalogo';
import Stock from './pages/Stock';
import Bonos from './pages/Bonos';
import Admin from './pages/Admin';
import Reportes from './pages/Reportes';
import ComprobantePublico from './pages/ComprobantePublico';
import WhatsAppSetup from './pages/WhatsAppSetup';
import { ReactNode } from 'react';

function Protected({ children, roles }: { children: ReactNode; roles?: Array<'admin' | 'oficina' | 'closer'> }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/comprobante/:numero" element={<ComprobantePublico />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/canjes" element={<Canjes />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/atencion" element={<Atencion />} />
        <Route path="/facturas" element={<Facturas />} />
        <Route path="/turnos" element={<Turnos />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/cuotero" element={<Cuotero />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/bonos" element={<Bonos />} />
        <Route
          path="/reportes"
          element={
            <Protected roles={['admin', 'oficina']}>
              <Reportes />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected roles={['admin', 'oficina']}>
              <Admin />
            </Protected>
          }
        />
        <Route
          path="/admin/whatsapp"
          element={
            <Protected roles={['admin']}>
              <WhatsAppSetup />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
