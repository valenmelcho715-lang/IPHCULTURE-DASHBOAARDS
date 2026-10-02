// ============================================================
// pages/Turnos.tsx — Agenda semanal de turnos (Frontend_Turnos_Leads)
// Vista agenda 7 días con alertas en vivo (30/15 min) + vista lista
// con filtros. Permisos: admin/closer mutan, oficina solo lectura.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  List,
  Plus,
  Clock,
  User,
  Phone,
  Bell,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { api, fmtFecha } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  Label,
  Spinner,
  EmptyState,
  ConfirmDialog,
  cn,
} from '../components/ui';

// ---------- Tipos ----------
interface Turno {
  id: number;
  closer_id: number;
  closer_nombre?: string | null;
  cliente_nombre: string | null;
  telefono: string | null;
  fecha_hora: string;
  motivo: string | null;
  producto_objetivo: string | null;
  modelo_detalle: string | null;
  que_busca: string | null;
  presupuesto_estimado: number | null;
  moneda: string | null;
  forma_pago: string | null;
  senia: string | null;
  monto_senia: number | null;
  confirmado: string | null;
  canal_contacto: string | null;
  estado: string | null;
  notas: string | null;
  notificar_whatsapp: number | null;
}

interface TurnoForm {
  cliente_nombre: string;
  telefono: string;
  fecha_hora: string; // datetime-local
  motivo: string;
  producto_objetivo: string;
  modelo_detalle: string;
  que_busca: string;
  presupuesto_estimado: string;
  moneda: string;
  forma_pago: string;
  senia: string;
  monto_senia: string;
  canal_contacto: string;
  notas: string;
  notificar_whatsapp: boolean;
}

const MOTIVOS = ['Consulta', 'Compra', 'Canje', 'Entrega', 'Postventa'];
const PRODUCTOS = ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'AirPods', 'Android', 'Otro'];
const FORMAS_PAGO = ['Efectivo', 'Transferencia', 'Cuotas'];
const SENIAS = ['No aplica', 'Señado', 'Pendiente'];
const CANALES = ['WhatsApp', 'Instagram', 'Llamada', 'Local'];
const ESTADOS_TURNO = ['Pendiente', 'Cumplido', 'Cancelado'];

const emptyForm: TurnoForm = {
  cliente_nombre: '',
  telefono: '',
  fecha_hora: '',
  motivo: 'Consulta',
  producto_objetivo: 'iPhone',
  modelo_detalle: '',
  que_busca: '',
  presupuesto_estimado: '',
  moneda: 'USD',
  forma_pago: 'Efectivo',
  senia: 'No aplica',
  monto_senia: '',
  canal_contacto: 'WhatsApp',
  notas: '',
  notificar_whatsapp: false,
};

// ---------- Helpers de fecha ----------
// Las fechas vienen como TEXT de SQLite ("YYYY-MM-DD HH:MM:SS") o de
// datetime-local ("YYYY-MM-DDTHH:MM"). Las tratamos como hora local.
function parseFecha(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0)
    );
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputValue(d: Date): string {
  return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fmtHora(d: Date): string {
  // hour12:false evita el wrap feo de "02:02 a. m." dentro de las cards
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type AlertaNivel = 'urgente' | 'pronto' | 'pasado' | 'normal';

function nivelAlerta(t: Turno, now: Date): AlertaNivel {
  const d = parseFecha(t.fecha_hora);
  if (!d) return 'normal';
  const diffMin = (d.getTime() - now.getTime()) / 60000;
  if (diffMin < 0) return 'pasado';
  if (diffMin <= 15) return 'urgente';
  if (diffMin <= 30) return 'pronto';
  return 'normal';
}

// ============================================================
export default function Turnos() {
  const { user } = useAuth();
  const readOnly = user?.rol === 'oficina';
  const esCloser = user?.rol === 'closer';

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'agenda' | 'lista'>('agenda');
  const [now, setNow] = useState(() => new Date());
  const [filtroEstado, setFiltroEstado] = useState('Todos');

  const [detalle, setDetalle] = useState<Turno | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Turno | null>(null);
  const [form, setForm] = useState<TurnoForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [turnoAEliminar, setTurnoAEliminar] = useState<Turno | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api.get<Turno[]>('/api/turnos');
      setTurnos(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando turnos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Reloj en vivo: recalcular alertas cada 30s
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  // ---------- Semana actual (hoy → +6) ----------
  const dias = useMemo(() => {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Array.from({ length: 7 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  }, [now]);

  const turnosPorDia = useMemo(() => {
    const map = new Map<string, Turno[]>();
    for (const t of turnos) {
      const d = parseFecha(t.fecha_hora);
      if (!d) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (parseFecha(a.fecha_hora)?.getTime() ?? 0) - (parseFecha(b.fecha_hora)?.getTime() ?? 0));
    }
    return map;
  }, [turnos]);

  const turnosLista = useMemo(() => {
    const arr = [...turnos].sort(
      (a, b) => (parseFecha(a.fecha_hora)?.getTime() ?? 0) - (parseFecha(b.fecha_hora)?.getTime() ?? 0)
    );
    if (filtroEstado === 'Todos') return arr;
    return arr.filter((t) => (t.estado || 'Pendiente') === filtroEstado);
  }, [turnos, filtroEstado]);

  // ---------- Acciones ----------
  const abrirNuevo = () => {
    setEditando(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const abrirEditar = (t: Turno) => {
    const d = parseFecha(t.fecha_hora);
    setEditando(t);
    setForm({
      cliente_nombre: t.cliente_nombre ?? '',
      telefono: t.telefono ?? '',
      fecha_hora: d ? toInputValue(d) : '',
      motivo: t.motivo ?? 'Consulta',
      producto_objetivo: t.producto_objetivo ?? 'Otro',
      modelo_detalle: t.modelo_detalle ?? '',
      que_busca: t.que_busca ?? '',
      presupuesto_estimado: t.presupuesto_estimado ? String(t.presupuesto_estimado) : '',
      moneda: t.moneda ?? 'USD',
      forma_pago: t.forma_pago ?? 'Efectivo',
      senia: t.senia ?? 'No aplica',
      monto_senia: t.monto_senia ? String(t.monto_senia) : '',
      canal_contacto: t.canal_contacto ?? 'WhatsApp',
      notas: t.notas ?? '',
      notificar_whatsapp: Boolean(t.notificar_whatsapp),
    });
    setFormError('');
    setDetalle(null);
    setFormOpen(true);
  };

  const guardar = async () => {
    if (!form.cliente_nombre.trim()) {
      setFormError('El nombre del cliente es requerido');
      return;
    }
    if (!form.fecha_hora) {
      setFormError('La fecha y hora son requeridas');
      return;
    }
    setGuardando(true);
    setFormError('');
    const body = {
      cliente_nombre: form.cliente_nombre.trim(),
      telefono: form.telefono || null,
      fecha_hora: form.fecha_hora.replace('T', ' ') + (form.fecha_hora.length === 16 ? ':00' : ''),
      motivo: form.motivo,
      producto_objetivo: form.producto_objetivo,
      modelo_detalle: form.modelo_detalle || null,
      que_busca: form.que_busca || null,
      presupuesto_estimado: form.presupuesto_estimado ? Number(form.presupuesto_estimado) : 0,
      moneda: form.moneda,
      forma_pago: form.forma_pago,
      senia: form.senia,
      monto_senia: form.monto_senia ? Number(form.monto_senia) : 0,
      canal_contacto: form.canal_contacto,
      notas: form.notas || null,
      notificar_whatsapp: form.notificar_whatsapp ? 1 : 0,
    };
    try {
      if (editando) {
        await api.put(`/api/turnos/${editando.id}`, body);
      } else {
        await api.post('/api/turnos', body);
      }
      setFormOpen(false);
      await cargar();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error guardando turno');
    } finally {
      setGuardando(false);
    }
  };

  const confirmar = async (t: Turno) => {
    try {
      await api.put(`/api/turnos/${t.id}`, { confirmado: 'Confirmado' });
      setDetalle(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error confirmando turno');
    }
  };

  const marcarCumplido = async (t: Turno) => {
    try {
      await api.put(`/api/turnos/${t.id}`, { estado: 'Cumplido' });
      setDetalle(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error actualizando turno');
    }
  };

  const eliminar = (t: Turno) => setTurnoAEliminar(t);

  const confirmarEliminar = async () => {
    if (!turnoAEliminar) return;
    setEliminando(true);
    try {
      await api.del(`/api/turnos/${turnoAEliminar.id}`);
      setDetalle(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando turno');
    } finally {
      setEliminando(false);
      setTurnoAEliminar(null);
    }
  };

  // ---------- Render: card de turno ----------
  const renderCard = (t: Turno) => {
    const d = parseFecha(t.fecha_hora);
    const nivel = nivelAlerta(t, now);
    const cumplido = t.estado === 'Cumplido';
    const atenuado = (nivel === 'pasado' && !cumplido && t.estado !== 'Cancelado') || cumplido || t.estado === 'Cancelado';
    return (
      <button
        key={t.id}
        onClick={() => setDetalle(t)}
        className={cn(
          'w-full text-left rounded-xl border p-3 transition-all bg-base-800/60 hover:border-neon/50',
          nivel === 'urgente' && 'border-red-500/70 animate-pulse',
          nivel === 'pronto' && 'border-admin/60',
          nivel === 'normal' && 'border-slate-600/30',
          nivel === 'pasado' && 'border-slate-700/40',
          atenuado && 'opacity-45'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-lg font-extrabold', nivel === 'urgente' ? 'text-red-400' : 'text-neon')}>
            {d ? fmtHora(d) : '--:--'}
          </span>
          {nivel === 'urgente' && <Badge color="red">URGENTE</Badge>}
          {nivel === 'pronto' && <Badge color="amber">En 30 min</Badge>}
        </div>
        <p className="text-sm font-semibold text-slate-100 mt-1 truncate">{t.cliente_nombre || 'Sin nombre'}</p>
        <p className="text-xs text-slate-400 truncate">{t.motivo || 'Consulta'}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {t.producto_objetivo && <Badge color="neon">{t.producto_objetivo}</Badge>}
          {t.confirmado === 'Confirmado' ? (
            <Badge color="success">Confirmado</Badge>
          ) : (
            <Badge color="slate">Sin confirmar</Badge>
          )}
          {(t.monto_senia ?? 0) > 0 && <Badge color="amber">Seña {t.monto_senia}</Badge>}
          {t.estado === 'Cumplido' && <Badge color="success">Cumplido</Badge>}
          {t.estado === 'Cancelado' && <Badge color="red">Cancelado</Badge>}
        </div>
        {!esCloser && t.closer_nombre && (
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <User size={11} /> {t.closer_nombre}
          </p>
        )}
      </button>
    );
  };

  // ---------- Render ----------
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Turnos"
        subtitle="Agenda semanal del local"
        actions={
          <>
            <Button variant="ghost" onClick={() => setVista(vista === 'agenda' ? 'lista' : 'agenda')}>
              {vista === 'agenda' ? <List size={16} className="inline mr-1 -mt-0.5" /> : <CalendarDays size={16} className="inline mr-1 -mt-0.5" />}
              {vista === 'agenda' ? 'Lista' : 'Agenda'}
            </Button>
            {!readOnly && (
              <Button onClick={abrirNuevo}>
                <Plus size={16} className="inline mr-1 -mt-0.5" /> Nuevo turno
              </Button>
            )}
          </>
        }
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {vista === 'agenda' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {dias.map((dia, i) => {
            const esHoy = i === 0;
            const items = turnosPorDia.get(dayKey(dia)) ?? [];
            return (
              <div
                key={dayKey(dia)}
                className={cn(
                  'glass p-3 min-h-[180px]',
                  esHoy && 'neon-border shadow-glow'
                )}
              >
                <div className={cn('mb-3 pb-2 border-b', esHoy ? 'border-neon/40' : 'border-slate-700/40')}>
                  <p className={cn('text-xs uppercase tracking-wider font-semibold', esHoy ? 'text-neon glow-text' : 'text-slate-400')}>
                    {esHoy ? 'Hoy' : DIAS_SEMANA[dia.getDay()]}
                  </p>
                  <p className={cn('text-sm font-bold', esHoy ? 'text-neon' : 'text-slate-300')}>
                    {dia.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-4">Sin turnos</p>
                  ) : (
                    items.map(renderCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <div className="flex items-center gap-3 mb-4">
            <Label>Estado</Label>
            <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="max-w-[200px]">
              <option value="Todos">Todos</option>
              {ESTADOS_TURNO.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </div>
          {turnosLista.length === 0 ? (
            <EmptyState message="No hay turnos para este filtro" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700/40">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Hora</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Motivo</th>
                  <th className="py-2 pr-3">Producto</th>
                  {!esCloser && <th className="py-2 pr-3">Closer</th>}
                  <th className="py-2 pr-3">Confirmación</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {turnosLista.map((t) => {
                  const d = parseFecha(t.fecha_hora);
                  const nivel = nivelAlerta(t, now);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setDetalle(t)}
                      className={cn(
                        'border-b border-slate-800/60 cursor-pointer hover:bg-neon/5 transition-colors',
                        nivel === 'pasado' && t.estado !== 'Cumplido' && 'opacity-50'
                      )}
                    >
                      <td className="py-2.5 pr-3 text-slate-300">{d ? d.toLocaleDateString('es-AR') : '—'}</td>
                      <td className={cn('py-2.5 pr-3 font-bold', nivel === 'urgente' ? 'text-red-400' : 'text-neon')}>
                        {d ? fmtHora(d) : '—'}
                        {nivel === 'urgente' && <Badge color="red">URGENTE</Badge>}
                        {nivel === 'pronto' && <Badge color="amber">En 30 min</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-100 font-semibold">{t.cliente_nombre || '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-400">{t.motivo || '—'}</td>
                      <td className="py-2.5 pr-3">{t.producto_objetivo ? <Badge color="neon">{t.producto_objetivo}</Badge> : '—'}</td>
                      {!esCloser && <td className="py-2.5 pr-3 text-slate-400">{t.closer_nombre || '—'}</td>}
                      <td className="py-2.5 pr-3">
                        {t.confirmado === 'Confirmado' ? <Badge color="success">Confirmado</Badge> : <Badge color="slate">Sin confirmar</Badge>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge color={t.estado === 'Cumplido' ? 'success' : t.estado === 'Cancelado' ? 'red' : 'slate'}>
                          {t.estado || 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ---------- Modal detalle ---------- */}
      <Modal open={detalle !== null} onClose={() => setDetalle(null)} title="Detalle del turno" wide>
        {detalle && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-extrabold text-neon flex items-center gap-2">
                <Clock size={18} /> {fmtFecha(detalle.fecha_hora)}
              </span>
              {detalle.confirmado === 'Confirmado' ? <Badge color="success">Confirmado</Badge> : <Badge color="slate">Sin confirmar</Badge>}
              <Badge color={detalle.estado === 'Cumplido' ? 'success' : detalle.estado === 'Cancelado' ? 'red' : 'slate'}>
                {detalle.estado || 'Pendiente'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><Label>Cliente</Label><p className="text-slate-100 font-semibold">{detalle.cliente_nombre || '—'}</p></div>
              <div>
                <Label>Teléfono</Label>
                <p className="text-slate-300 flex items-center gap-1"><Phone size={13} /> {detalle.telefono || '—'}</p>
              </div>
              <div><Label>Motivo</Label><p className="text-slate-300">{detalle.motivo || '—'}</p></div>
              <div><Label>Producto objetivo</Label><p className="text-slate-300">{detalle.producto_objetivo || '—'}{detalle.modelo_detalle ? ` — ${detalle.modelo_detalle}` : ''}</p></div>
              <div><Label>Presupuesto</Label><p className="text-slate-300">{detalle.presupuesto_estimado ? `${detalle.moneda || 'USD'} ${detalle.presupuesto_estimado}` : '—'}</p></div>
              <div><Label>Forma de pago</Label><p className="text-slate-300">{detalle.forma_pago || '—'}</p></div>
              <div><Label>Seña</Label><p className="text-slate-300">{detalle.senia || 'No aplica'}{(detalle.monto_senia ?? 0) > 0 ? ` — ${detalle.monto_senia}` : ''}</p></div>
              <div><Label>Canal</Label><p className="text-slate-300">{detalle.canal_contacto || '—'}</p></div>
              {!esCloser && (
                <div><Label>Closer</Label><p className="text-slate-300">{detalle.closer_nombre || '—'}</p></div>
              )}
              <div>
                <Label>Notificación WhatsApp</Label>
                <p className="text-slate-300 flex items-center gap-1">
                  <Bell size={13} /> {detalle.notificar_whatsapp ? 'Activada' : 'Desactivada'}
                </p>
              </div>
            </div>
            {detalle.que_busca && (
              <div><Label>Qué busca</Label><p className="text-slate-300 text-sm whitespace-pre-wrap">{detalle.que_busca}</p></div>
            )}
            {detalle.notas && (
              <div><Label>Notas</Label><p className="text-slate-300 text-sm whitespace-pre-wrap">{detalle.notas}</p></div>
            )}
            {!readOnly && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/40">
                {detalle.confirmado !== 'Confirmado' && (
                  <Button variant="success" onClick={() => void confirmar(detalle)}>
                    <Check size={15} className="inline mr-1 -mt-0.5" /> Confirmar
                  </Button>
                )}
                {detalle.estado !== 'Cumplido' && (
                  <Button variant="ghost" onClick={() => void marcarCumplido(detalle)}>
                    <CheckCheck size={15} className="inline mr-1 -mt-0.5" /> Marcar cumplido
                  </Button>
                )}
                <Button variant="ghost" onClick={() => abrirEditar(detalle)}>
                  <Pencil size={15} className="inline mr-1 -mt-0.5" /> Editar
                </Button>
                <Button variant="danger" onClick={() => void eliminar(detalle)}>
                  <Trash2 size={15} className="inline mr-1 -mt-0.5" /> Eliminar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- Modal nuevo / editar ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? 'Editar turno' : 'Nuevo turno'}
        wide
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Cliente *</Label>
            <Input value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} placeholder="Nombre del cliente" />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="299 ..." />
          </div>
          <div>
            <Label>Fecha y hora *</Label>
            <Input type="datetime-local" value={form.fecha_hora} onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
              {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <Label>Producto objetivo</Label>
            <Select value={form.producto_objetivo} onChange={(e) => setForm({ ...form, producto_objetivo: e.target.value })}>
              {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label>Modelo / detalle</Label>
            <Input value={form.modelo_detalle} onChange={(e) => setForm({ ...form, modelo_detalle: e.target.value })} placeholder="iPhone 17 Pro 256GB" />
          </div>
          <div className="sm:col-span-2">
            <Label>Qué busca</Label>
            <Textarea value={form.que_busca} onChange={(e) => setForm({ ...form, que_busca: e.target.value })} placeholder="Quiere cambiar su Android por un iPhone..." />
          </div>
          <div>
            <Label>Presupuesto estimado</Label>
            <div className="flex gap-2">
              <Input type="number" min="0" value={form.presupuesto_estimado} onChange={(e) => setForm({ ...form, presupuesto_estimado: e.target.value })} placeholder="0" />
              <Select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className="max-w-[90px]">
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Forma de pago</Label>
            <Select value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}>
              {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
          <div>
            <Label>Seña</Label>
            <Select value={form.senia} onChange={(e) => setForm({ ...form, senia: e.target.value })}>
              {SENIAS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <Label>Monto seña</Label>
            <Input type="number" min="0" value={form.monto_senia} onChange={(e) => setForm({ ...form, monto_senia: e.target.value })} placeholder="0" disabled={form.senia === 'No aplica'} />
          </div>
          <div>
            <Label>Canal de contacto</Label>
            <Select value={form.canal_contacto} onChange={(e) => setForm({ ...form, canal_contacto: e.target.value })}>
              {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.notificar_whatsapp}
                onChange={(e) => setForm({ ...form, notificar_whatsapp: e.target.checked })}
                className="w-4 h-4 accent-cyan-400"
              />
              <Bell size={14} className="text-neon" /> Notificar por WhatsApp
            </label>
          </div>
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Notas internas..." />
          </div>
        </div>
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear turno'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={turnoAEliminar !== null}
        onClose={() => !eliminando && setTurnoAEliminar(null)}
        onConfirm={() => void confirmarEliminar()}
        title="Eliminar turno"
        message={`¿Eliminar el turno de ${turnoAEliminar?.cliente_nombre ?? 'este cliente'}?`}
        loading={eliminando}
      />
    </div>
  );
}
