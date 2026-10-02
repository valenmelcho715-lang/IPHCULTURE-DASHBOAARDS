// ============================================================
// pages/Leads.tsx — Kanban de leads (Frontend_Turnos_Leads)
// Columnas por estado con movimiento ←/→, modal detalle/edición,
// asignación de closer (admin) y eliminación (admin).
// Permisos: admin todo; closer solo estado/notas de los suyos;
// oficina solo lectura.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Phone,
  Instagram,
  Mail,
  ChevronLeft,
  ChevronRight,
  User,
  Pencil,
  Trash2,
  CalendarClock,
} from 'lucide-react';
import { api, fmtFecha } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  PageHeader,
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  Input,
  Select,
  Textarea,
  Label,
  Spinner,
  cn,
} from '../components/ui';

// ---------- Tipos ----------
interface Lead {
  id: number;
  nombre: string | null;
  telefono: string | null;
  instagram: string | null;
  email: string | null;
  fuente: string | null;
  estado: string | null;
  closer_asignado_id: number | null;
  closer_nombre?: string | null;
  notas: string | null;
  proximo_contacto?: string | null;
  created_at: string | null;
}

interface Closer {
  id: number;
  nombre: string;
}

interface LeadForm {
  nombre: string;
  telefono: string;
  instagram: string;
  email: string;
  fuente: string;
  estado: string;
  closer_asignado_id: string;
  notas: string;
  proximo_contacto: string;
}

const ESTADOS = ['Nuevo', 'Contactado', 'Interesado', 'Negociando', 'Ganado', 'Perdido'] as const;
type Estado = (typeof ESTADOS)[number];

const estadoColor: Record<Estado, 'neon' | 'slate' | 'violet' | 'amber' | 'success' | 'red'> = {
  Nuevo: 'neon',
  Contactado: 'slate',
  Interesado: 'violet',
  Negociando: 'amber',
  Ganado: 'success',
  Perdido: 'red',
};

const estadoBorde: Record<Estado, string> = {
  Nuevo: 'border-neon/40',
  Contactado: 'border-slate-500/40',
  Interesado: 'border-oficina/40',
  Negociando: 'border-admin/40',
  Ganado: 'border-success/40',
  Perdido: 'border-red-500/40',
};

const FUENTES = ['Instagram', 'WhatsApp', 'Local', 'Referido', 'TikTok', 'Otro'];

const fuenteColor = (f: string | null): 'neon' | 'success' | 'amber' | 'violet' | 'red' | 'slate' => {
  switch (f) {
    case 'Instagram':
      return 'violet';
    case 'WhatsApp':
      return 'success';
    case 'Local':
      return 'neon';
    case 'Referido':
      return 'amber';
    case 'TikTok':
      return 'red';
    default:
      return 'slate';
  }
};

const emptyForm: LeadForm = {
  nombre: '',
  telefono: '',
  instagram: '',
  email: '',
  fuente: 'Instagram',
  estado: 'Nuevo',
  closer_asignado_id: '',
  notas: '',
  proximo_contacto: '',
};

/** true si la fecha de próximo contacto ya venció o es hoy */
function tocaRetomar(l: Lead): boolean {
  if (!l.proximo_contacto) return false;
  if (l.estado === 'Ganado' || l.estado === 'Perdido') return false;
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return l.proximo_contacto.slice(0, 10) <= hoyStr;
}

// ============================================================
export default function Leads() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const readOnly = user?.rol === 'oficina';
  const esCloser = user?.rol === 'closer';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detalle, setDetalle] = useState<Lead | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [leadAEliminar, setLeadAEliminar] = useState<Lead | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [soloRetomar, setSoloRetomar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await api.get<Lead[]>('/api/leads');
      setLeads(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Lista de closers para asignación (solo admin la necesita)
  useEffect(() => {
    if (!esAdmin) return;
    (async () => {
      try {
        const data = await api.get<Closer[]>('/api/admin/closers');
        setClosers(Array.isArray(data) ? data : []);
      } catch {
        try {
          const data = await api.get<Closer[]>('/api/closers');
          setClosers(Array.isArray(data) ? data : []);
        } catch {
          /* sin lista de closers disponible */
        }
      }
    })();
  }, [esAdmin]);

  const porEstado = useMemo(() => {
    const map = new Map<Estado, Lead[]>();
    for (const e of ESTADOS) map.set(e, []);
    for (const l of leads) {
      if (soloRetomar && !tocaRetomar(l)) continue;
      const est = (ESTADOS as readonly string[]).includes(l.estado ?? '') ? (l.estado as Estado) : 'Nuevo';
      map.get(est)!.push(l);
    }
    return map;
  }, [leads, soloRetomar]);

  const cantRetomar = useMemo(() => leads.filter(tocaRetomar).length, [leads]);

  // ---------- Acciones ----------
  const mover = async (lead: Lead, dir: -1 | 1) => {
    const idx = ESTADOS.indexOf((lead.estado as Estado) ?? 'Nuevo');
    const nuevo = ESTADOS[Math.min(Math.max(idx + dir, 0), ESTADOS.length - 1)];
    if (nuevo === lead.estado) return;
    try {
      await api.put(`/api/leads/${lead.id}`, { estado: nuevo });
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error moviendo lead');
    }
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...emptyForm, closer_asignado_id: esCloser && user ? String(user.id) : '' });
    setFormError('');
    setFormOpen(true);
  };

  const abrirEditar = (l: Lead) => {
    setEditando(l);
    setForm({
      nombre: l.nombre ?? '',
      telefono: l.telefono ?? '',
      instagram: l.instagram ?? '',
      email: l.email ?? '',
      fuente: l.fuente ?? 'Otro',
      estado: l.estado ?? 'Nuevo',
      closer_asignado_id: l.closer_asignado_id ? String(l.closer_asignado_id) : '',
      notas: l.notas ?? '',
      proximo_contacto: l.proximo_contacto ? l.proximo_contacto.slice(0, 10) : '',
    });
    setFormError('');
    setDetalle(null);
    setEditMode(false);
    setFormOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    setGuardando(true);
    setFormError('');
    try {
      if (editando) {
        // Closer solo puede enviar estado/notas/proximo_contacto; admin puede todo
        const body = esAdmin
          ? {
              nombre: form.nombre.trim(),
              telefono: form.telefono || null,
              instagram: form.instagram || null,
              email: form.email || null,
              fuente: form.fuente,
              estado: form.estado,
              closer_asignado_id: form.closer_asignado_id ? Number(form.closer_asignado_id) : null,
              notas: form.notas || null,
              proximo_contacto: form.proximo_contacto || null,
            }
          : { estado: form.estado, notas: form.notas || null, proximo_contacto: form.proximo_contacto || null };
        await api.put(`/api/leads/${editando.id}`, body);
      } else {
        await api.post('/api/leads', {
          nombre: form.nombre.trim(),
          telefono: form.telefono || null,
          instagram: form.instagram || null,
          email: form.email || null,
          fuente: form.fuente,
          estado: form.estado,
          closer_asignado_id: form.closer_asignado_id ? Number(form.closer_asignado_id) : undefined,
          notas: form.notas || null,
          proximo_contacto: form.proximo_contacto || null,
        });
      }
      setFormOpen(false);
      await cargar();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error guardando lead');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = (l: Lead) => setLeadAEliminar(l);

  const confirmarEliminar = async () => {
    if (!leadAEliminar) return;
    setEliminando(true);
    try {
      await api.del(`/api/leads/${leadAEliminar.id}`);
      setDetalle(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando lead');
    } finally {
      setEliminando(false);
      setLeadAEliminar(null);
    }
  };

  // ---------- Render: card ----------
  const renderCard = (l: Lead, estado: Estado) => {
    const idx = ESTADOS.indexOf(estado);
    return (
      <div
        key={l.id}
        onClick={() => {
          setDetalle(l);
          setEditMode(false);
        }}
        className="rounded-xl border border-slate-600/30 bg-base-800/60 p-3 cursor-pointer hover:border-neon/50 transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">{l.nombre || 'Sin nombre'}</p>
          {l.fuente && <Badge color={fuenteColor(l.fuente)}>{l.fuente}</Badge>}
        </div>
        <div className="mt-2 space-y-1">
          {l.telefono && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Phone size={12} className="text-neon" /> {l.telefono}
            </p>
          )}
          {l.instagram && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Instagram size={12} className="text-oficina" /> @{l.instagram.replace(/^@/, '')}
            </p>
          )}
        </div>
        {!esCloser && (
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <User size={11} /> {l.closer_nombre || 'Sin asignar'}
          </p>
        )}
        {tocaRetomar(l) ? (
          <p className="text-[11px] mt-1.5 flex items-center gap-1 font-bold text-red-400">
            <CalendarClock size={11} /> Retomar hoy
          </p>
        ) : (
          l.proximo_contacto && (
            <p className="text-[11px] mt-1.5 flex items-center gap-1 text-admin">
              <CalendarClock size={11} /> Retomar: {l.proximo_contacto.slice(0, 10).split('-').reverse().join('/')}
            </p>
          )
        )}
        {l.notas && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.notas}</p>}
        {!readOnly && (
          <div className="flex justify-between mt-2 pt-2 border-t border-slate-700/40">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void mover(l, -1);
              }}
              disabled={idx === 0}
              className="text-slate-400 hover:text-neon disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Mover a estado anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void mover(l, 1);
              }}
              disabled={idx === ESTADOS.length - 1}
              className="text-slate-400 hover:text-neon disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title="Mover a estado siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---------- Render ----------
  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Pipeline de prospectos"
        actions={
          <div className="flex items-center gap-2">
            {cantRetomar > 0 && (
              <button
                onClick={() => setSoloRetomar((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                  soloRetomar
                    ? 'bg-red-500/15 border-red-500/50 text-red-400'
                    : 'border-red-500/30 text-red-400/80 hover:bg-red-500/10'
                )}
              >
                <CalendarClock size={14} />
                {cantRetomar} para retomar
              </button>
            )}
            {!readOnly && (
              <Button onClick={abrirNuevo}>
                <Plus size={16} className="inline mr-1 -mt-0.5" /> Nuevo lead
              </Button>
            )}
          </div>
        }
      />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {ESTADOS.map((estado) => {
          const items = porEstado.get(estado) ?? [];
          return (
            <div key={estado} className={cn('glass p-3 min-h-[200px] border', estadoBorde[estado])}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/40">
                <Badge color={estadoColor[estado]}>{estado}</Badge>
                <span className="text-xs font-bold text-slate-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-6">Sin leads</p>
                ) : (
                  items.map((l) => renderCard(l, estado))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Modal detalle ---------- */}
      <Modal
        open={detalle !== null}
        onClose={() => {
          setDetalle(null);
          setEditMode(false);
        }}
        title={editMode ? 'Editar lead' : 'Detalle del lead'}
      >
        {detalle && !editMode && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-extrabold text-slate-100">{detalle.nombre || 'Sin nombre'}</span>
              <Badge color={estadoColor[(detalle.estado as Estado) ?? 'Nuevo']}>{detalle.estado || 'Nuevo'}</Badge>
              {detalle.fuente && <Badge color={fuenteColor(detalle.fuente)}>{detalle.fuente}</Badge>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <Label>Teléfono</Label>
                <p className="text-slate-300 flex items-center gap-1.5">
                  <Phone size={13} className="text-neon" /> {detalle.telefono || '—'}
                </p>
              </div>
              <div>
                <Label>Instagram</Label>
                <p className="text-slate-300 flex items-center gap-1.5">
                  <Instagram size={13} className="text-oficina" /> {detalle.instagram ? `@${detalle.instagram.replace(/^@/, '')}` : '—'}
                </p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="text-slate-300 flex items-center gap-1.5">
                  <Mail size={13} className="text-admin" /> {detalle.email || '—'}
                </p>
              </div>
              {!esCloser && (
                <div>
                  <Label>Closer asignado</Label>
                  <p className="text-slate-300">{detalle.closer_nombre || 'Sin asignar'}</p>
                </div>
              )}
              <div>
                <Label>Creado</Label>
                <p className="text-slate-300">{fmtFecha(detalle.created_at)}</p>
              </div>
              <div>
                <Label>Próximo contacto</Label>
                <p className={cn('flex items-center gap-1.5', tocaRetomar(detalle) ? 'text-red-400 font-bold' : 'text-slate-300')}>
                  <CalendarClock size={13} />
                  {detalle.proximo_contacto
                    ? detalle.proximo_contacto.slice(0, 10).split('-').reverse().join('/')
                    : '—'}
                  {tocaRetomar(detalle) && ' · ¡retomar hoy!'}
                </p>
              </div>
            </div>
            {detalle.notas && (
              <div>
                <Label>Notas</Label>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{detalle.notas}</p>
              </div>
            )}
            {!readOnly && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/40">
                <Button variant="ghost" onClick={() => setEditMode(true)}>
                  <Pencil size={15} className="inline mr-1 -mt-0.5" /> Editar
                </Button>
                {esAdmin && (
                  <Button variant="danger" onClick={() => void eliminar(detalle)}>
                    <Trash2 size={15} className="inline mr-1 -mt-0.5" /> Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {detalle && editMode && (
          <LeadEditor
            lead={detalle}
            esAdmin={esAdmin}
            closers={closers}
            onCancel={() => setEditMode(false)}
            onSaved={async () => {
              setEditMode(false);
              setDetalle(null);
              await cargar();
            }}
          />
        )}
      </Modal>

      {/* ---------- Modal nuevo lead ---------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editando ? 'Editar lead' : 'Nuevo lead'}>
        <LeadFormFields form={form} setForm={setForm} esAdmin={esAdmin} closers={closers} editando={editando} />
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear lead'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={leadAEliminar !== null}
        onClose={() => !eliminando && setLeadAEliminar(null)}
        onConfirm={() => void confirmarEliminar()}
        title="Eliminar lead"
        message={`¿Eliminar el lead "${leadAEliminar?.nombre ?? ''}"?`}
        loading={eliminando}
      />
    </div>
  );
}

// ---------- Formulario compartido (nuevo / editar) ----------
function LeadFormFields({
  form,
  setForm,
  esAdmin,
  closers,
  editando,
}: {
  form: LeadForm;
  setForm: (f: LeadForm) => void;
  esAdmin: boolean;
  closers: Closer[];
  editando: Lead | null;
}) {
  const soloEstadoNotas = editando !== null && !esAdmin; // closer editando
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <Label>Nombre *</Label>
        <Input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Nombre del lead"
          disabled={soloEstadoNotas}
        />
      </div>
      <div>
        <Label>Teléfono</Label>
        <Input
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          placeholder="299 ..."
          disabled={soloEstadoNotas}
        />
      </div>
      <div>
        <Label>Instagram</Label>
        <Input
          value={form.instagram}
          onChange={(e) => setForm({ ...form, instagram: e.target.value })}
          placeholder="@usuario"
          disabled={soloEstadoNotas}
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="mail@ejemplo.com"
          disabled={soloEstadoNotas}
        />
      </div>
      <div>
        <Label>Fuente</Label>
        <Select value={form.fuente} onChange={(e) => setForm({ ...form, fuente: e.target.value })} disabled={soloEstadoNotas}>
          {FUENTES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Estado</Label>
        <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
          {ESTADOS.map((e2) => (
            <option key={e2} value={e2}>
              {e2}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Próximo contacto</Label>
        <Input
          type="date"
          value={form.proximo_contacto}
          onChange={(e) => setForm({ ...form, proximo_contacto: e.target.value })}
        />
        <p className="text-[10px] text-slate-500 mt-1">Te marca el lead en rojo cuando llegue el día</p>
      </div>
      {esAdmin && (
        <div>
          <Label>Closer asignado</Label>
          <Select
            value={form.closer_asignado_id}
            onChange={(e) => setForm({ ...form, closer_asignado_id: e.target.value })}
          >
            <option value="">Sin asignar</option>
            {closers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="sm:col-span-2">
        <Label>Notas</Label>
        <Textarea
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          placeholder="Notas sobre el lead..."
        />
      </div>
    </div>
  );
}

// ---------- Editor inline dentro del modal detalle ----------
function LeadEditor({
  lead,
  esAdmin,
  closers,
  onCancel,
  onSaved,
}: {
  lead: Lead;
  esAdmin: boolean;
  closers: Closer[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<LeadForm>({
    nombre: lead.nombre ?? '',
    telefono: lead.telefono ?? '',
    instagram: lead.instagram ?? '',
    email: lead.email ?? '',
    fuente: lead.fuente ?? 'Otro',
    estado: lead.estado ?? 'Nuevo',
    closer_asignado_id: lead.closer_asignado_id ? String(lead.closer_asignado_id) : '',
    notas: lead.notas ?? '',
    proximo_contacto: lead.proximo_contacto ? lead.proximo_contacto.slice(0, 10) : '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const body = esAdmin
        ? {
            nombre: form.nombre.trim(),
            telefono: form.telefono || null,
            instagram: form.instagram || null,
            email: form.email || null,
            fuente: form.fuente,
            estado: form.estado,
            closer_asignado_id: form.closer_asignado_id ? Number(form.closer_asignado_id) : null,
            notas: form.notas || null,
            proximo_contacto: form.proximo_contacto || null,
          }
        : { estado: form.estado, notas: form.notas || null, proximo_contacto: form.proximo_contacto || null };
      await api.put(`/api/leads/${lead.id}`, body);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando lead');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <LeadFormFields form={form} setForm={setForm} esAdmin={esAdmin} closers={closers} editando={lead} />
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
