// ============================================================
// pages/Ventas.tsx — Gestión de ventas (Frontend_Ventas_Facturas)
//  - Tabla glass con filtros (búsqueda + estado)
//  - Modal Nueva/Editar venta (wide) con catálogo, seña, canje
//  - Permisos: closer solo las suyas (sin costo/ganancia),
//    admin todo (+costo_usd/ganancia_usd), oficina crea ventas eligiendo
//    el dueño (closer o venta propia) y puede EDITAR cualquier venta
//    (pagos, señas, estado, comprador) — sin costo/ganancia, sin reasignar
//    dueño y sin eliminar
// ============================================================
import { useEffect, useMemo, useState, ChangeEvent } from 'react';
import { Eye, Pencil, Trash2, Plus, FileText, BadgeDollarSign } from 'lucide-react';
import { api, fmtUSD, fmtARS, fmtFecha } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Label,
  Badge,
  Modal,
  ConfirmDialog,
  Spinner,
  EmptyState,
  cn,
} from '../components/ui';

interface Venta {
  id: number;
  closer_id: number;
  nombre_comprador: string | null;
  apellido_comprador: string | null;
  dni: string | null;
  producto: string | null;
  precio_venta_usd: number;
  costo_usd: number;
  ganancia_usd: number;
  comision_usd: number;
  pago_completo: number;
  monto_senado_usd: number;
  falta_pagar_usd: number;
  metodo_pago: string;
  es_canje: number;
  estado: string;
  notas: string | null;
  comprobante_pdf: string | null;
  created_at: string;
  closer_nombre?: string;
}

interface FacturaRow {
  id: number;
  venta_id: number;
  numero: string;
}

interface CatalogoItem {
  id: number;
  producto: string;
  modelo: string;
  precio_contado_usd: number | null;
  categoria: string | null;
}

interface CuotaFee {
  id: number;
  plan: string;
  cuotas: number;
  fee_cobro_pct: number;
  fee_cuotas_pct: number;
  iibb_pct: number;
  posnet_pct: number;
}

const METODOS_PAGO = ['Efectivo USD', 'Efectivo ARS', 'Transferencia', 'Cuotas', 'Canje'];
const ESTADOS = ['Completada', 'Pendiente', 'Cancelada'];
const OTRO = '__OTRO__';

interface FormState {
  nombre_comprador: string;
  apellido_comprador: string;
  dni: string;
  productoKey: string; // id del catálogo o OTRO
  productoLibre: string;
  precio_venta_usd: string;
  pago_completo: boolean;
  monto_senado_usd: string;
  metodo_pago: string;
  es_canje: boolean;
  estado: string;
  notas: string;
  comprobante_pdf: string | null;
  costo_usd: string;
  ganancia_usd: string;
  closer_id: string; // solo admin/oficina: dueño de la venta
}

interface CloserOption {
  id: number;
  nombre: string;
}

const emptyForm: FormState = {
  nombre_comprador: '',
  apellido_comprador: '',
  dni: '',
  productoKey: '',
  productoLibre: '',
  precio_venta_usd: '',
  pago_completo: false,
  monto_senado_usd: '',
  metodo_pago: 'Efectivo USD',
  es_canje: false,
  estado: 'Completada',
  notas: '',
  comprobante_pdf: null,
  costo_usd: '',
  ganancia_usd: '',
  closer_id: '',
};

function estadoBadgeColor(estado: string): 'success' | 'amber' | 'red' | 'slate' {
  const e = (estado || '').toLowerCase();
  if (e === 'completada') return 'success';
  if (e === 'cancelada') return 'red';
  if (e) return 'amber';
  return 'slate';
}

function Toggle({ checked, onChange, label, disabled=false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled} onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-300 select-none"
    >
      <span
        className={cn(
          'w-10 h-6 rounded-full transition-colors relative border',
          checked ? 'bg-neon/20 border-neon/50' : 'bg-base-700 border-slate-600/40'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full transition-all',
            checked ? 'left-5 bg-neon shadow-glow' : 'left-0.5 bg-slate-500'
          )}
        />
      </span>
      {label}
    </button>
  );
}

export default function Ventas() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const esOficina = user?.rol === 'oficina';
  // Todos pueden editar (el closer solo ve las suyas; el server lo refuerza).
  // Oficina edita pero NO elimina; el closer edita/elimina solo las propias.
  const puedeEliminar = !esOficina;
  const eligeDuenio = esAdmin || esOficina; // selector "¿De quién es la venta?" (creación)

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [closers, setClosers] = useState<CloserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Venta | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [ventaAEliminar, setVentaAEliminar] = useState<Venta | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [ventaAPagar, setVentaAPagar] = useState<Venta | null>(null);
  const [pagando, setPagando] = useState(false);

  // Al editar, oficina NO puede reasignar el dueño de la venta
  const muestraDuenio = eligeDuenio && !(esOficina && editando);

  // Planes de cuotas oficiales (para mostrar valor de CADA cuota al elegir "Cuotas")
  const [cuotasFees, setCuotasFees] = useState<CuotaFee[]>([]);
  const [cuotaPlan, setCuotaPlan] = useState<string>('');
  const [cuotaTC, setCuotaTC] = useState<string>('1680');
  useEffect(()=>{void api.get<any>('/api/atencion/status').then(x=>setCuotaTC(String(x.settings.usdArs))).catch(()=>{});},[]);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, f, c] = await Promise.all([
        api.get<Venta[]>('/api/ventas'),
        api.get<FacturaRow[]>('/api/facturas'),
        api.get<any[]>('/api/atencion/stock').then(rows=>rows.filter(x=>Number(x.available)>0).map(x=>({...x,precio_contado_usd:x.precio_venta_usd,precio_regular_usd:x.precio_venta_usd}))),
      ]);
      setVentas(v);
      setFacturas(f);
      setCatalogo(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  // Admin/oficina necesitan la lista de closers para asignar la venta
  useEffect(() => {
    if (!eligeDuenio) return;
    api
      .get<CloserOption[]>('/api/admin/closers')
      .then((data) => setClosers(Array.isArray(data) ? data : []))
      .catch(() => setClosers([]));
  }, [eligeDuenio]);

  useEffect(() => {
    api
      .get<CuotaFee[]>('/api/cuotero/fees')
      .then((lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        setCuotasFees(arr);
        if (arr.length > 0) setCuotaPlan(arr[arr.length - 1].plan);
      })
      .catch(() => setCuotasFees([]));
  }, []);

  const facturaPorVenta = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of facturas) map.set(f.venta_id, f.numero);
    return map;
  }, [facturas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ventas.filter((v) => {
      if (filtroEstado && v.estado !== filtroEstado) return false;
      if (!q) return true;
      const cliente = `${v.nombre_comprador ?? ''} ${v.apellido_comprador ?? ''}`.toLowerCase();
      return cliente.includes(q) || (v.producto ?? '').toLowerCase().includes(q);
    });
  }, [ventas, busqueda, filtroEstado]);

  // ---------- Modal ----------
  const abrirNueva = () => {
    setEditando(null);
    setForm(emptyForm);
    setErrorForm(null);
    setModalOpen(true);
  };

  const abrirEdicion = async (v: Venta) => {
    setEditando(v);
    // El listado no trae el comprobante (pesado): se pide el detalle al editar
    let comprobante: string | null = v.comprobante_pdf ?? null;
    try {
      const det = await api.get<{ venta: Venta }>(`/api/ventas/${v.id}`);
      comprobante = det.venta.comprobante_pdf ?? null;
    } catch { /* si falla, se edita sin precargar el comprobante */ }
    const itemCatalogo = catalogo.find(
      (c) => `${c.producto} ${c.modelo}`.trim() === (v.producto ?? '').trim()
    );
    setForm({
      nombre_comprador: v.nombre_comprador ?? '',
      apellido_comprador: v.apellido_comprador ?? '',
      dni: v.dni ?? '',
      productoKey: itemCatalogo ? String(itemCatalogo.id) : v.producto ? OTRO : '',
      productoLibre: itemCatalogo ? '' : v.producto ?? '',
      precio_venta_usd: String(v.precio_venta_usd ?? ''),
      pago_completo: !!v.pago_completo,
      monto_senado_usd: String(v.monto_senado_usd ?? ''),
      metodo_pago: v.metodo_pago || 'Efectivo USD',
      es_canje: !!v.es_canje,
      estado: v.estado || 'Completada',
      notas: v.notas ?? '',
      comprobante_pdf: comprobante,
      costo_usd: String(v.costo_usd ?? ''),
      ganancia_usd: String(v.ganancia_usd ?? ''),
      closer_id: String(v.closer_id ?? ''),
    });
    setErrorForm(null);
    setModalOpen(true);
  };

  const onSelectProducto = (key: string) => {
    if (key === OTRO) {
      setForm((f) => ({ ...f, productoKey: OTRO }));
      return;
    }
    const item = catalogo.find((c) => String(c.id) === key);
    setForm((f) => ({
      ...f,
      productoKey: key,
      precio_venta_usd: item && item.precio_contado_usd != null ? String(item.precio_contado_usd) : f.precio_venta_usd,
    }));
  };

  const precioNum = Number(form.precio_venta_usd) || 0;
  const senaNum = Number(form.monto_senado_usd) || 0;
  const faltaCalc = form.pago_completo ? 0 : Math.max(0, Math.round((precioNum - senaNum) * 100) / 100);

  // Fórmula oficial del cuotero (PDF): fees sumados, posnet en cascada, colchón ×1.02, round 2
  const cuotaTCNum = Number(cuotaTC) || 0;
  const cuotaCalc = useMemo(() => {
    if (form.metodo_pago !== 'Cuotas') return null;
    const fee = cuotasFees.find((f) => f.plan === cuotaPlan);
    if (!fee || precioNum <= 0 || cuotaTCNum <= 0) return null;
    const precio_ars = precioNum * cuotaTCNum;
    const total_add = Number(fee.fee_cobro_pct) + Number(fee.iibb_pct) + Number(fee.fee_cuotas_pct);
    const factor_neto = (1 - total_add / 100) * (1 - Number(fee.posnet_pct ?? 0) / 100);
    if (factor_neto <= 0) return null;
    const total_cobrar_ars = Math.round((precio_ars / factor_neto) * 1.02 * 100) / 100;
    const valor_cuota_ars = Math.round((total_cobrar_ars / fee.cuotas) * 100) / 100;
    return { cuotas: fee.cuotas, valor_cuota_ars, total_cobrar_ars };
  }, [form.metodo_pago, cuotasFees, cuotaPlan, precioNum, cuotaTCNum]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setForm((f) => ({ ...f, comprobante_pdf: null }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorForm('El comprobante no puede superar 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, comprobante_pdf: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    const productoFinal =
      form.productoKey === OTRO
        ? form.productoLibre.trim()
        : (() => {
            const item = catalogo.find((c) => String(c.id) === form.productoKey);
            return item ? `${item.producto} ${item.modelo}`.trim() : '';
          })();
    if (!form.nombre_comprador.trim()) {
      setErrorForm('Ingresá el nombre del comprador');
      return;
    }
    if (!productoFinal) {
      setErrorForm('Elegí o escribí el producto');
      return;
    }
    if (precioNum <= 0) {
      setErrorForm('Ingresá un precio de venta válido');
      return;
    }
    if (muestraDuenio && !form.closer_id) {
      setErrorForm('Elegí de quién es la venta');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    const body: Record<string, unknown> = {
      nombre_comprador: form.nombre_comprador.trim(),
      apellido_comprador: form.apellido_comprador.trim(),
      dni: form.dni.trim(),
      producto: productoFinal,
      precio_venta_usd: precioNum,
      pago_completo: form.pago_completo ? 1 : 0,
      monto_senado_usd: form.pago_completo ? precioNum : senaNum,
      falta_pagar_usd: faltaCalc,
      metodo_pago: form.metodo_pago,
      es_canje: form.es_canje ? 1 : 0,
      estado: form.estado,
      notas: form.notas.trim(),
      comprobante_pdf: form.comprobante_pdf,
    };
    if (esAdmin) {
      body.costo_usd = Number(form.costo_usd) || 0;
      body.ganancia_usd = Number(form.ganancia_usd) || 0;
    }
    if (muestraDuenio) {
      body.closer_id = Number(form.closer_id);
    }
    try {
      if (editando) await api.put(`/api/ventas/${editando.id}`, body);
      else await api.post('/api/ventas', body);
      setModalOpen(false);
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'Error guardando la venta');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (v: Venta) => setVentaAEliminar(v);

  // Marcar pagada de un toque: el cliente terminó de pagar su seña
  const marcarPagada = (v: Venta) => setVentaAPagar(v);

  const confirmarPagada = async () => {
    if (!ventaAPagar) return;
    setPagando(true);
    try {
      await api.put(`/api/ventas/${ventaAPagar.id}`, {
        monto_senado_usd: Number(ventaAPagar.precio_venta_usd) || 0,
        falta_pagar_usd: 0,
        pago_completo: 1,
      });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error marcando la venta como pagada');
    } finally {
      setPagando(false);
      setVentaAPagar(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!ventaAEliminar) return;
    setEliminando(true);
    try {
      await api.del(`/api/ventas/${ventaAEliminar.id}`);
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error eliminando la venta');
    } finally {
      setEliminando(false);
      setVentaAEliminar(null);
    }
  };

  const verFactura = (v: Venta) => {
    const numero = facturaPorVenta.get(v.id);
    if (numero) window.open(`/comprobante/${numero}`, '_blank');
  };

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={
          esOficina
            ? 'Registrá ventas asignándolas a un closer y actualizá pagos, señas y estados'
            : user?.rol === 'closer'
              ? 'Tus ventas registradas'
              : 'Todas las ventas del equipo'
        }
        actions={
          <Button onClick={abrirNueva}>
            <Plus size={16} className="inline -mt-0.5 mr-1" /> Nueva venta
          </Button>
        }
      />

      {/* Filtros */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-56">
            <Input
              placeholder="Buscar por cliente o producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : error ? (
          <EmptyState message={error} />
        ) : visibles.length === 0 ? (
          <EmptyState message="No hay ventas para mostrar" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3">Precio</th>
                  <th className="px-5 py-3">Señado</th>
                  <th className="px-5 py-3">Falta pagar</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Comisión</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => {
                  const numero = facturaPorVenta.get(v.id);
                  return (
                    <tr key={v.id} className="border-b border-slate-800/40 hover:bg-base-700/40 transition-colors">
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{fmtFecha(v.created_at)}</td>
                      <td className="px-5 py-3 text-slate-200">
                        {[v.nombre_comprador, v.apellido_comprador].filter(Boolean).join(' ') || '—'}
                        {v.dni && <span className="block text-xs text-slate-500">DNI {v.dni}</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {v.producto ?? '—'}
                        {!!v.es_canje && (
                          <span className="ml-2">
                            <Badge color="violet">Canje</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-bold text-neon whitespace-nowrap">{fmtUSD(v.precio_venta_usd)}</td>
                      <td className="px-5 py-3 text-slate-300 whitespace-nowrap">{fmtUSD(v.monto_senado_usd)}</td>
                      <td
                        className={cn(
                          'px-5 py-3 font-semibold whitespace-nowrap',
                          Number(v.falta_pagar_usd) > 0 ? 'text-red-400' : 'text-slate-500'
                        )}
                      >
                        {fmtUSD(v.falta_pagar_usd)}
                      </td>
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{v.metodo_pago}</td>
                      <td className="px-5 py-3">
                        <Badge color={estadoBadgeColor(v.estado)}>{v.estado}</Badge>
                      </td>
                      <td className="px-5 py-3 text-success whitespace-nowrap">{fmtUSD(v.comision_usd)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            className="!px-2.5 !py-1.5"
                            title={numero ? `Ver factura ${numero}` : 'Sin factura'}
                            disabled={!numero}
                            onClick={() => verFactura(v)}
                          >
                            <Eye size={15} />
                            <span className="hidden lg:inline ml-1 font-mono text-xs">{numero ?? ''}</span>
                          </Button>
                          {esAdmin && Number(v.falta_pagar_usd) > 0 && (
                            <Button
                              variant="ghost"
                              className="!px-2.5 !py-1.5 !text-success"
                              title="Marcar como pagada (terminó de pagar)"
                              onClick={() => marcarPagada(v)}
                            >
                              <BadgeDollarSign size={15} />
                            </Button>
                          )}
                          <Button variant="ghost" className="!px-2.5 !py-1.5" title="Editar" onClick={() => abrirEdicion(v)}>
                            <Pencil size={15} />
                          </Button>
                          {puedeEliminar && (
                            <Button variant="danger" className="!px-2.5 !py-1.5" title="Eliminar" onClick={() => eliminar(v)}>
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Nueva / Editar venta */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? `Editar venta #${editando.id}` : 'Nueva venta'}
        wide
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-neon/30 bg-neon/5 px-3 py-2 text-xs text-neon">
          <FileText size={14} className="mt-0.5 shrink-0" />
          Se genera el comprobante X automáticamente
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {esOficina && editando && (
            <div className="md:col-span-2 flex items-start gap-2 rounded-xl border border-oficina/40 bg-oficina/10 px-3 py-2 text-xs text-oficina">
              Actualizá el pago: marcá pago completo, ajustá la seña, el método de pago o el estado.
            </div>
          )}
          {muestraDuenio && (
            <div className="md:col-span-2">
              <Label>¿De quién es la venta?</Label>
              <Select value={form.closer_id} onChange={(e) => setForm((f) => ({ ...f, closer_id: e.target.value }))}>
                <option value="">Elegí el dueño de la venta…</option>
                {closers.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
                {esOficina && user && <option value={String(user.id)}>Oficina (venta propia)</option>}
                {esAdmin && user && <option value={String(user.id)}>Admin (venta propia)</option>}
              </Select>
            </div>
          )}
          <div>
            <Label>Nombre comprador</Label>
            <Input
              value={form.nombre_comprador}
              onChange={(e) => setForm((f) => ({ ...f, nombre_comprador: e.target.value }))}
              placeholder="Juan"
            />
          </div>
          <div>
            <Label>Apellido comprador</Label>
            <Input
              value={form.apellido_comprador}
              onChange={(e) => setForm((f) => ({ ...f, apellido_comprador: e.target.value }))}
              placeholder="Pérez"
            />
          </div>
          <div>
            <Label>DNI</Label>
            <Input value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} placeholder="30.123.456" />
          </div>
          <div>
            <Label>Producto</Label>
            <Select value={form.productoKey} onChange={(e) => onSelectProducto(e.target.value)}>
              <option value="">Elegí del catálogo…</option>
              {catalogo.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.producto} {c.modelo}
                  {c.precio_contado_usd != null ? ` — USD ${c.precio_contado_usd}` : ''}
                </option>
              ))}
              <option value={OTRO}>Otro (escribir manualmente)</option>
            </Select>
            {form.productoKey === OTRO && (
              <Input
                className="mt-2"
                value={form.productoLibre}
                onChange={(e) => setForm((f) => ({ ...f, productoLibre: e.target.value }))}
                placeholder="Descripción del producto"
              />
            )}
          </div>
          <div>
            <Label>Precio venta (USD)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.precio_venta_usd}
              onChange={(e) => setForm((f) => ({ ...f, precio_venta_usd: e.target.value }))}
            />
          </div>
          <div>
            <Label>Método de pago</Label>
            <Select value={form.metodo_pago} onChange={(e) => setForm((f) => ({ ...f, metodo_pago: e.target.value }))}>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          {form.metodo_pago === 'Cuotas' && (
            <div className="md:col-span-2 rounded-xl border border-neon/40 bg-neon/5 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Plan de cuotas</Label>
                  <Select value={cuotaPlan} onChange={(e) => setCuotaPlan(e.target.value)}>
                    {cuotasFees.map((f) => (
                      <option key={f.id} value={f.plan}>
                        {f.plan}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Tipo de cambio</Label>
                  <Input type="number" min="0" value={cuotaTC} onChange={(e) => setCuotaTC(e.target.value)} />
                </div>
              </div>
              {cuotaCalc ? (
                <div className="text-center pt-1">
                  <p className="text-2xl font-extrabold text-neon glow-text leading-tight">
                    {cuotaCalc.cuotas} cuota{cuotaCalc.cuotas > 1 ? 's' : ''} de {fmtARS(cuotaCalc.valor_cuota_ars)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Total a cobrar: {fmtARS(cuotaCalc.total_cobrar_ars)} · {fmtUSD(precioNum)} al dólar ${' '}
                    {cuotaTCNum.toLocaleString('es-AR')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center">
                  Ingresá precio de venta y tipo de cambio para ver el valor de cada cuota.
                </p>
              )}
            </div>
          )}
          <div className="flex items-end pb-1">
            <Toggle
              checked={form.pago_completo} disabled={!esAdmin}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  pago_completo: v,
                  monto_senado_usd: v ? f.precio_venta_usd : f.monto_senado_usd,
                }))
              }
              label="Pago completo"
            />
          </div>
          <div className="flex items-end pb-1">
            <Toggle checked={form.es_canje} onChange={(v) => setForm((f) => ({ ...f, es_canje: v }))} label="Es canje" />
          </div>
          {form.es_canje && (
            <div className="md:col-span-2 rounded-xl border border-oficina/40 bg-oficina/10 px-3 py-2 text-xs text-oficina">
              Comisión fija USD 15
            </div>
          )}
          {!form.pago_completo && (
            <div>
              <Label>Monto señado (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!esAdmin} value={form.monto_senado_usd}
                onChange={(e) => setForm((f) => ({ ...f, monto_senado_usd: e.target.value }))}
              />
            </div>
          )}
          <div>
            <Label>Falta pagar (USD)</Label>
            <Input readOnly value={fmtUSD(faltaCalc)} className="opacity-70 cursor-not-allowed" />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Comprobante de pago (PDF/imagen, opcional)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={onFileChange} className="file:mr-2 file:text-xs" />
            {form.comprobante_pdf && <p className="text-xs text-success mt-1">Comprobante adjunto ✓</p>}
          </div>
          {esAdmin && (
            <>
              <div>
                <Label>Costo (USD) — solo admin</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo_usd}
                  onChange={(e) => setForm((f) => ({ ...f, costo_usd: e.target.value }))}
                />
              </div>
              <div>
                <Label>Ganancia (USD) — solo admin</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ganancia_usd}
                  onChange={(e) => setForm((f) => ({ ...f, ganancia_usd: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">Al cambiarla, la comisión se recalcula (20%).</p>
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>

        {errorForm && <p className="text-sm text-red-400 mt-3">{errorForm}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear venta'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={ventaAEliminar !== null}
        onClose={() => !eliminando && setVentaAEliminar(null)}
        onConfirm={() => void confirmarEliminar()}
        title="Eliminar venta"
        message={`¿Eliminar la venta de ${ventaAEliminar?.nombre_comprador ?? ''} (${ventaAEliminar?.producto ?? ''})? También se elimina su comprobante.`}
        loading={eliminando}
      />

      <ConfirmDialog
        open={ventaAPagar !== null}
        onClose={() => !pagando && setVentaAPagar(null)}
        onConfirm={() => void confirmarPagada()}
        title="Marcar venta como pagada"
        message={`¿${ventaAPagar?.nombre_comprador ?? 'El cliente'} terminó de pagar? Se marca la venta de ${ventaAPagar?.producto ?? ''} como PAGO COMPLETO (falta pagar: USD 0).`}
        confirmLabel="Sí, pagó todo"
        loading={pagando}
      />
    </div>
  );
}
