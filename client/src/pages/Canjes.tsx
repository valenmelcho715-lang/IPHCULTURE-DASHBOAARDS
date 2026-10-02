// ============================================================
// pages/Canjes.tsx — Registro de canjes (trade-ins)
// Equipos entregados como parte de pago. Permisos:
// - GET: todos (closer ve solo los suyos, lo filtra el server)
// - POST: admin y closer (oficina solo lectura)
// - PUT/DELETE: solo admin
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Repeat } from 'lucide-react';
import { api, fmtUSD } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  PageHeader,
  Card,
  StatCard,
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  Input,
  Select,
  Textarea,
  Label,
  Spinner,
  EmptyState,
} from '../components/ui';
import CotizadorCanje from '../components/CotizadorCanje';

// ---------- Tipos ----------
interface Canje {
  id: number;
  cliente_id: number | null;
  producto_entregado: string | null;
  producto_recibido: string | null;
  diferencia_usd: number | null;
  estado: string | null;
  closer_id: number | null;
  notas: string | null;
  cliente_nombre?: string | null;
  closer_nombre?: string | null;
}

interface Cliente {
  id: number;
  nombre: string | null;
}

interface CanjeForm {
  cliente_id: string; // '' = sin cliente
  producto_entregado: string;
  producto_recibido: string;
  diferencia_usd: string;
  estado: string;
  notas: string;
}

const ESTADOS = ['Pendiente', 'Completado', 'Cancelado'];

const emptyForm: CanjeForm = {
  cliente_id: '',
  producto_entregado: '',
  producto_recibido: '',
  diferencia_usd: '',
  estado: 'Pendiente',
  notas: '',
};

function estadoColor(estado: string | null): 'amber' | 'success' | 'red' {
  if (estado === 'Completado') return 'success';
  if (estado === 'Cancelado') return 'red';
  return 'amber';
}

// ============================================================
export default function Canjes() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const esCloser = user?.rol === 'closer';
  const puedeCrear = esAdmin || esCloser; // oficina: solo lectura

  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Canje | null>(null);
  const [form, setForm] = useState<CanjeForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [canjeAEliminar, setCanjeAEliminar] = useState<Canje | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api.get<Canje[]>('/api/canjes');
      setCanjes(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando canjes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Clientes para el picker (opcional, silencioso si falla)
  useEffect(() => {
    api
      .get<Cliente[]>('/api/clientes')
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setClientes([]));
  }, []);

  const visibles = useMemo(() => {
    if (!filtroEstado) return canjes;
    return canjes.filter((c) => (c.estado || 'Pendiente') === filtroEstado);
  }, [canjes, filtroEstado]);

  const stats = useMemo(() => {
    const pendientes = canjes.filter((c) => (c.estado || 'Pendiente') === 'Pendiente').length;
    const completados = canjes.filter((c) => c.estado === 'Completado').length;
    return { total: canjes.length, pendientes, completados };
  }, [canjes]);

  // ---------- Acciones ----------
  const abrirNuevo = () => {
    setEditando(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  // Desde el cotizador: abre "Nuevo canje" con producto_entregado precargado
  const abrirNuevoDesdeCotizador = (descripcion: string) => {
    setEditando(null);
    setForm({ ...emptyForm, producto_entregado: descripcion });
    setFormError('');
    setFormOpen(true);
  };

  const abrirEditar = (c: Canje) => {
    setEditando(c);
    setForm({
      cliente_id: c.cliente_id ? String(c.cliente_id) : '',
      producto_entregado: c.producto_entregado ?? '',
      producto_recibido: c.producto_recibido ?? '',
      diferencia_usd: c.diferencia_usd != null ? String(c.diferencia_usd) : '',
      estado: c.estado || 'Pendiente',
      notas: c.notas ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const guardar = async () => {
    if (!form.producto_entregado.trim()) {
      setFormError('El producto entregado es requerido');
      return;
    }
    if (!form.producto_recibido.trim()) {
      setFormError('El producto recibido es requerido');
      return;
    }
    setGuardando(true);
    setFormError('');
    const body = {
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      producto_entregado: form.producto_entregado.trim(),
      producto_recibido: form.producto_recibido.trim(),
      diferencia_usd: form.diferencia_usd ? Number(form.diferencia_usd) : 0,
      estado: form.estado,
      notas: form.notas || null,
    };
    try {
      if (editando) {
        await api.put(`/api/canjes/${editando.id}`, body);
      } else {
        await api.post('/api/canjes', body);
      }
      setFormOpen(false);
      await cargar();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error guardando canje');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (c: Canje) => setCanjeAEliminar(c);

  const confirmarEliminar = async () => {
    if (!canjeAEliminar) return;
    setEliminando(true);
    try {
      await api.del(`/api/canjes/${canjeAEliminar.id}`);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando canje');
    } finally {
      setEliminando(false);
      setCanjeAEliminar(null);
    }
  };

  // ---------- Render ----------
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Canjes"
        subtitle="Registro de equipos entregados como parte de pago (trade-ins)"
        actions={
          puedeCrear ? (
            <Button onClick={abrirNuevo}>
              <Plus size={16} className="inline mr-1 -mt-0.5" /> Nuevo canje
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Cotizador de canje — valuación automática según plan oficial */}
      <CotizadorCanje onUsarEnCanje={abrirNuevoDesdeCotizador} />

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total canjes" value={stats.total} accent="neon" />
        <StatCard label="Pendientes" value={stats.pendientes} accent="amber" />
        <StatCard label="Completados" value={stats.completados} accent="success" />
      </div>

      <Card className="overflow-x-auto">
        {/* Filtro por estado (patrón de Ventas) */}
        <div className="flex items-center gap-3 mb-4">
          <Label>Estado</Label>
          <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="max-w-[200px]">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>

        {visibles.length === 0 ? (
          <EmptyState message="No hay canjes para mostrar" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/40">
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Entregado</th>
                <th className="py-2 pr-3">Recibido</th>
                <th className="py-2 pr-3">Diferencia</th>
                <th className="py-2 pr-3">Estado</th>
                {!esCloser && <th className="py-2 pr-3">Closer</th>}
                <th className="py-2 pr-3">Notas</th>
                {esAdmin && <th className="py-2 pr-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/60 hover:bg-neon/5 transition-colors">
                  <td className="py-2.5 pr-3 text-slate-100 font-semibold">{c.cliente_nombre || '—'}</td>
                  <td className="py-2.5 pr-3 text-slate-300">{c.producto_entregado || '—'}</td>
                  <td className="py-2.5 pr-3 text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Repeat size={12} className="text-neon shrink-0" />
                      {c.producto_recibido || '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-neon font-semibold">{fmtUSD(c.diferencia_usd)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge color={estadoColor(c.estado)}>{c.estado || 'Pendiente'}</Badge>
                  </td>
                  {!esCloser && <td className="py-2.5 pr-3 text-slate-400">{c.closer_nombre || '—'}</td>}
                  <td className="py-2.5 pr-3 text-slate-400 max-w-[200px] truncate">{c.notas || '—'}</td>
                  {esAdmin && (
                    <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-neon hover:bg-neon/10 transition-all"
                        aria-label="Editar canje"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => void eliminar(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        aria-label="Eliminar canje"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---------- Modal nuevo / editar ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? 'Editar canje' : 'Nuevo canje'}
        wide
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Cliente</Label>
            <Select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre || `Cliente #${c.id}`}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Producto entregado *</Label>
            <Input
              value={form.producto_entregado}
              onChange={(e) => setForm({ ...form, producto_entregado: e.target.value })}
              placeholder="iPhone 13 128GB usado"
            />
          </div>
          <div>
            <Label>Producto recibido *</Label>
            <Input
              value={form.producto_recibido}
              onChange={(e) => setForm({ ...form, producto_recibido: e.target.value })}
              placeholder="iPhone 17 256GB"
            />
          </div>
          <div>
            <Label>Diferencia a pagar (USD)</Label>
            <Input
              type="number"
              min="0"
              value={form.diferencia_usd}
              onChange={(e) => setForm({ ...form, diferencia_usd: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Estado del equipo, detalles del canje..."
            />
          </div>
        </div>
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear canje'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={canjeAEliminar !== null}
        onClose={() => !eliminando && setCanjeAEliminar(null)}
        onConfirm={() => void confirmarEliminar()}
        title="Eliminar canje"
        message={`¿Eliminar el canje de ${canjeAEliminar?.producto_entregado ?? 'este equipo'}?`}
        loading={eliminando}
      />
    </div>
  );
}
