// ============================================================
// pages/Stock.tsx — INVENTARIO
// Todos ven el stock. Costo solo admin/oficina.
// Agregar/editar: admin u oficina. Ajuste +/- y vaciar: solo admin.
// Eliminar item: admin, oficina o closer (el closer elimina al vender una unidad).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { api, fmtUSD } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, Button, Input, Select, Label, Badge, Modal, ConfirmDialog, PageHeader, Spinner, EmptyState, cn } from '../components/ui';

interface StockItem {
  id: number;
  producto?: string | null;
  modelo?: string | null;
  capacidad?: string | null;
  color?: string | null;
  condicion?: string | null;
  precio_costo_usd?: number | null;
  precio_venta_usd?: number | null;
  cantidad: number; battery_pct?: number|null; repairs?:string|null; warranty_months?:number|null;
  categoria?: string | null;
}

const EMPTY_FORM = {
  producto: '',
  modelo: '',
  capacidad: '',
  color: '',
  condicion: 'Nuevo',
  precio_costo_usd: '',
  precio_venta_usd: '',
  cantidad: '1',
  categoria: 'iPhone', battery_pct:'', repairs:'', warranty_months:'',
};

type FormState = typeof EMPTY_FORM;

const CATEGORIAS = ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'AirPods', 'Android', 'Accesorio', 'Varios'];

export default function Stock() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const esOficina = user?.rol === 'oficina';
  const esCloser = user?.rol === 'closer';
  const veCosto = esAdmin;
  // Permisos: agregar/editar → admin u oficina; ajuste +/- → solo admin;
  // eliminar item → admin, oficina o closer; vaciar → solo admin
  const puedeAgregar = esAdmin || esOficina;
  const puedeAjustar = esAdmin;
  const puedeEliminar = esAdmin;
  const muestraAcciones = puedeAgregar || puedeEliminar;

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('Todas');

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<StockItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const data = await api.get<StockItem[]>('/api/stock');
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== 'Todas' && (it.categoria ?? 'Varios') !== cat) return false;
      if (!q) return true;
      return [it.producto ?? '', it.modelo ?? '', it.capacidad ?? '', it.color ?? '', it.condicion ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, busqueda, cat]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const abrirEditar = (it: StockItem) => {
    setEditando(it);
    setForm({
      producto: it.producto ?? '',
      modelo: it.modelo ?? '',
      capacidad: it.capacidad ?? '',
      color: it.color ?? '',
      condicion: it.condicion ?? 'Nuevo',
      precio_costo_usd: it.precio_costo_usd != null ? String(it.precio_costo_usd) : '',
      precio_venta_usd: it.precio_venta_usd != null ? String(it.precio_venta_usd) : '',
      cantidad: String(it.cantidad ?? 0),
      categoria: it.categoria ?? 'iPhone', battery_pct:it.battery_pct==null?'':String(it.battery_pct),repairs:it.repairs||'',warranty_months:it.warranty_months==null?'':String(it.warranty_months),
    });
    setModalOpen(true);
  };

  const guardar = async () => {
    setGuardando(true);
    const body = {
      producto: form.producto,
      modelo: form.modelo,
      capacidad: form.capacidad,
      color: form.color,
      condicion: form.condicion,
      precio_costo_usd: Number(form.precio_costo_usd) || 0,
      precio_venta_usd: Number(form.precio_venta_usd) || 0,
      cantidad: Number(form.cantidad) || 0,
      categoria: form.categoria, battery_pct:form.battery_pct===''?null:Number(form.battery_pct),repairs:form.repairs||null,warranty_months:form.warranty_months===''?null:Number(form.warranty_months),
    };
    try {
      if (editando) await api.put(`/api/stock/${editando.id}`, body);
      else await api.post('/api/stock', body);
      setModalOpen(false);
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const ajustar = async (it: StockItem, delta: 1 | -1) => {
    if (delta === -1 && it.cantidad <= 0) return;
    // Optimista
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, cantidad: Math.max(0, x.cantidad + delta) } : x)));
    try {
      await api.post(`/api/stock/${it.id}/ajustar`, { delta });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      await cargar();
    }
  };

  const [confirm, setConfirm] = useState<{ titulo: string; mensaje: string; onConfirm: () => Promise<void> } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const pedirConfirmacion = (titulo: string, mensaje: string, onConfirm: () => Promise<void>) =>
    setConfirm({ titulo, mensaje, onConfirm });

  const ejecutarConfirmacion = async () => {
    if (!confirm) return;
    setConfirmando(true);
    try {
      await confirm.onConfirm();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setConfirmando(false);
      setConfirm(null);
    }
  };

  const eliminarItem = (it: StockItem) =>
    pedirConfirmacion('Eliminar item', `¿Eliminar "${it.modelo || it.producto}" del stock?`, async () => {
      await api.del(`/api/stock/${it.id}`);
      await cargar();
    });

  const vaciarStock = () =>
    pedirConfirmacion(
      'Vaciar stock',
      '⚠️ Esta acción elimina TODOS los items del inventario. No se puede deshacer. ¿Seguro que querés continuar?',
      async () => {
        await api.del('/api/stock');
        await cargar();
      }
    );

  const badgeCantidad = (n: number) =>
    n <= 1 ? <Badge color="red">{n}</Badge> : n <= 3 ? <Badge color="amber">{n}</Badge> : <Badge color="success">{n}</Badge>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        subtitle="Inventario disponible en tienda"
        actions={
          puedeAgregar || esAdmin ? (
            <>
              {puedeAgregar && (
                <Button onClick={abrirNuevo}>
                  <span className="inline-flex items-center gap-2">
                    <Plus size={16} /> Nuevo item
                  </span>
                </Button>
              )}
              {esAdmin && (
                <Button variant="danger" onClick={vaciarStock}>
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={16} /> Vaciar stock
                  </span>
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {/* Búsqueda + filtro */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input className="pl-8" placeholder="Buscar por modelo, color, capacidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <Select className="w-full sm:w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : error ? (
          <EmptyState message={`No se pudo cargar el stock: ${error}`} />
        ) : filtrados.length === 0 ? (
          <EmptyState message="No hay items en stock con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-base-700/40">
                  <th className="py-3 px-4">Producto / Modelo</th>
                  <th className="py-3 px-4">Capacidad</th>
                  <th className="py-3 px-4">Color</th>
                  <th className="py-3 px-4">Condición</th>
                  {veCosto && <th className="py-3 px-4">Costo</th>}
                  <th className="py-3 px-4">Precio venta</th>
                  <th className="py-3 px-4">Cantidad</th>
                  {muestraAcciones && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((it) => (
                  <tr key={it.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-100">{it.modelo || it.producto || '—'}</p>
                      {it.producto && it.modelo && it.producto !== it.modelo && (
                        <p className="text-xs text-slate-500">{it.producto}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{it.capacidad || '—'}</td>
                    <td className="py-3 px-4 text-slate-300">{it.color || '—'}</td>
                    <td className="py-3 px-4">
                      <Badge color={it.condicion === 'Nuevo' ? 'neon' : 'slate'}>{it.condicion || '—'}</Badge>
                    </td>
                    {veCosto && <td className="py-3 px-4 text-slate-400">{fmtUSD(it.precio_costo_usd)}</td>}
                    <td className="py-3 px-4 font-bold text-neon">{fmtUSD(it.precio_venta_usd)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {puedeAjustar && (
                          <button
                            onClick={() => ajustar(it, -1)}
                            disabled={it.cantidad <= 0}
                            className="w-6 h-6 rounded-lg bg-base-700 border border-slate-600/40 text-slate-300 hover:border-red-500/50 hover:text-red-400 disabled:opacity-30 flex items-center justify-center"
                            title="Restar 1"
                          >
                            <Minus size={12} />
                          </button>
                        )}
                        {badgeCantidad(it.cantidad)}
                        {puedeAjustar && (
                          <button
                            onClick={() => ajustar(it, 1)}
                            className="w-6 h-6 rounded-lg bg-base-700 border border-slate-600/40 text-slate-300 hover:border-success/50 hover:text-success flex items-center justify-center"
                            title="Sumar 1"
                          >
                            <Plus size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    {muestraAcciones && (
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          {puedeAgregar && (
                            <button
                              onClick={() => abrirEditar(it)}
                              className="w-7 h-7 rounded-lg bg-base-700 border border-slate-600/40 text-slate-300 hover:border-neon/50 hover:text-neon flex items-center justify-center"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {puedeEliminar && (
                            <button
                              onClick={() => eliminarItem(it)}
                              className="w-7 h-7 rounded-lg bg-base-700 border border-slate-600/40 text-slate-300 hover:border-red-500/50 hover:text-red-400 flex items-center justify-center"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => !confirmando && setConfirm(null)}
        onConfirm={() => void ejecutarConfirmacion()}
        title={confirm?.titulo ?? ''}
        message={confirm?.mensaje ?? ''}
        loading={confirmando}
      />

      {/* Modal nuevo / editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar item' : 'Nuevo item de stock'} wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Producto</Label>
            <Input value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} placeholder="Ej: iPhone" />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Ej: iPhone 17 Pro Max 256GB" />
          </div>
          <div>
            <Label>Capacidad</Label>
            <Input value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} placeholder="Ej: 256GB" />
          </div>
          <div>
            <Label>Color</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Ej: Titanio Natural" />
          </div>
          <div>
            <Label>Condición</Label>
            <Select value={form.condicion} onChange={(e) => setForm({ ...form, condicion: e.target.value })}>
              <option>Nuevo</option>
              <option>Usado</option>
              <option>Reacondicionado</option>
            </Select>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div><Label>Batería % (dato verificado)</Label><Input type="number" min="1" max="100" value={form.battery_pct} onChange={e=>setForm({...form,battery_pct:e.target.value})} placeholder="Vacío si no está verificado"/></div>
          <div><Label>Garantía comercial en meses</Label><Select value={form.warranty_months} onChange={e=>setForm({...form,warranty_months:e.target.value})}><option value="">Por confirmar</option><option value="3">3 meses · seminuevo</option><option value="6">6 meses · OEM</option><option value="12">12 meses · sellado</option></Select></div>
          <div className="md:col-span-2"><Label>Reparaciones y estado interno</Label><Input value={form.repairs} onChange={e=>setForm({...form,repairs:e.target.value})} placeholder="Información verificada por oficina"/></div>
          <div>
            <Label>Costo (USD) · administración</Label>
            <Input type="number" min={0} disabled={!esAdmin} value={form.precio_costo_usd} onChange={(e) => setForm({ ...form, precio_costo_usd: e.target.value })} />
          </div>
          <div>
            <Label>Precio venta (USD)</Label>
            <Input type="number" min={0} value={form.precio_venta_usd} onChange={(e) => setForm({ ...form, precio_venta_usd: e.target.value })} />
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input type="number" min={0} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !form.producto.trim()}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear item'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
