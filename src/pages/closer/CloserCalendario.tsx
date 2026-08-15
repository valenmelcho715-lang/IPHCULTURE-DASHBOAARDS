import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus, Bell, Trash2, Pencil, MessageCircle, Phone,
  AlertTriangle, CheckCircle, XCircle, Clock, Users
} from 'lucide-react';

const MOTIVOS = ['Retiro', 'Plan Canje', 'Reparacion', 'Consulta', 'Garantia', 'Sena', 'Compra'];
const PRODUCTOS = ['iPhone', 'Samsung', 'Motorola', 'Xiaomi', 'MacBook', 'Accesorios', 'Reparacion', 'Otro'];
const MONEDAS = ['USD', 'ARS', 'USDT'];
const FORMAS_PAGO = ['Cuotas', 'Tarjeta', 'Efectivo', 'Transferencia', 'Plan Canje', 'Mixto', 'Efectivo + Tarjeta'];
const SENIAS = ['No aplica', 'Sin sena', 'Seno'];
const CONFIRMADOS = ['Sin confirmar', 'Confirmado', 'No responde', 'Reprograma', 'Cancelado'];
const CANALES = ['Instagram', 'WhatsApp', 'Llamada'];

function accionSugerida(turno: any): { texto: string; color: string; icon: any } {
  const ahora = new Date().getTime();
  const fechaTurno = new Date(turno.fecha_hora).getTime();
  const diffMin = Math.floor((fechaTurno - ahora) / 60000);
  const confirmado = turno.confirmado || 'Sin confirmar';

  if (confirmado === 'Cancelado') return { texto: 'Cancelado - Sin accion', color: 'gray', icon: XCircle };
  if (confirmado === 'Confirmado') return { texto: 'Confirmado - Sin accion necesaria', color: 'green', icon: CheckCircle };
  if (confirmado === 'No responde') return { texto: 'URGENTE: Escribile ahora para confirmar', color: 'orange', icon: AlertTriangle };

  if (diffMin <= 15 && diffMin >= 0) {
    return { texto: 'MANDAR MENSAJE YA: ¿Seguis en camino?', color: 'red', icon: AlertTriangle };
  }
  if (diffMin <= 120 && diffMin >= 0) {
    return { texto: 'URGENTE: Escribile ahora para confirmar asistencia', color: 'orange', icon: AlertTriangle };
  }
  if (diffMin < 0) {
    return { texto: 'Turno pasado', color: 'gray', icon: Clock };
  }
  return { texto: 'Pendiente de confirmacion', color: 'blue', icon: Clock };
}

function waLink(telefono: string, mensaje: string) {
  const num = telefono.replace(/[^0-9+]/g, '').replace(/^0/, '+54');
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}

export default function CloserCalendario() {
  const [turnos, setTurnos] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [alertas, setAlertas] = useState<any[]>([]);
  const [alertasUrgentes, setAlertasUrgentes] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userTelefono, setUserTelefono] = useState('');
  const [editTelefono, setEditTelefono] = useState(false);
  const [vista, setVista] = useState<'calendario' | 'hoy' | '48hs' | 'sinConfirmar' | 'todos'>('calendario');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  const [closers, setClosers] = useState<any[]>([]);

  const isAdmin = user?.rol === 'admin';

  useEffect(() => {
    loadUser();
    loadTurnos();
    const interval = setInterval(() => { loadTurnos(); checkAlertas(); }, 60000);
    checkAlertas();
    return () => clearInterval(interval);
  }, []);

  const loadUser = async () => {
    const me = await apiGet('/auth/me');
    if (me) {
      setUser(me);
      setUserTelefono(me.telefono || '');
      if (me.rol === 'admin') loadClosers();
    }
  };

  const loadClosers = async () => {
    try {
      const data = await apiGet('/closers');
      setClosers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const loadTurnos = async () => {
    const data = await apiGet('/turnos');
    const arr = Array.isArray(data) ? data : [];
    setTurnos(arr);
    // Calcular alertas locales
    const ahora = new Date().getTime();
    const en15Min = ahora + 15 * 60000;
    const en30Min = ahora + 30 * 60000;
    const urg = arr.filter((t: any) => {
      const fh = new Date(t.fecha_hora).getTime();
      return fh > ahora && fh <= en15Min && t.estado !== 'Cancelado' && t.estado !== 'Completado';
    });
    const norm = arr.filter((t: any) => {
      const fh = new Date(t.fecha_hora).getTime();
      return fh > en15Min && fh <= en30Min && t.estado !== 'Cancelado' && t.estado !== 'Completado';
    });
    setAlertasUrgentes(urg);
    setAlertas(norm);
  };

  const saveTelefono = async () => {
    await apiPut('/auth/me/telefono', { telefono: userTelefono });
    setEditTelefono(false);
  };

  const checkAlertas = () => {
    if (alertasUrgentes.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      alertasUrgentes.forEach(t => {
        new Notification('TURNO EN 15 MIN', { body: `${t.cliente_nombre} - ${t.motivo}` });
      });
    }
  };

  const openNew = () => {
    setEditId(null);
    setForm({
      cliente_nombre: '', telefono: '', fecha_hora: '',
      motivo: 'Consulta', producto_objetivo: 'Otro', modelo_detalle: '', que_busca: '',
      presupuesto_estimado: '', moneda: 'USD', forma_pago: 'Efectivo',
      senia: 'No aplica', monto_senia: '',
      confirmado: 'Sin confirmar', canal_contacto: 'WhatsApp',
      estado_recordatorio: 'Pendiente', notas: '', notificar_whatsapp: false
    });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({ ...t, notificar_whatsapp: !!t.notificar_whatsapp });
    setDialogOpen(true);
  };

  const save = async () => {
    if (editId) {
      await apiPut(`/turnos/${editId}`, form);
    } else {
      await apiPost('/turnos', form);
    }
    setDialogOpen(false);
    loadTurnos();
  };

  const remove = async (id: number) => {
    if (!confirm('Eliminar turno?')) return;
    await apiDelete(`/turnos/${id}`);
    loadTurnos();
  };

  // Generar dias del mes
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  const turnosPorDia: Record<number, any[]> = {};
  turnos.forEach(t => {
    const d = new Date(t.fecha_hora);
    if (d.getMonth() === month && d.getFullYear() === year) {
      const dia = d.getDate();
      if (!turnosPorDia[dia]) turnosPorDia[dia] = [];
      turnosPorDia[dia].push(t);
    }
  });

  const dias = [];
  for (let i = 0; i < startDay; i++) dias.push(null);
  for (let i = 1; i <= daysInMonth; i++) dias.push(i);

  const ahora = new Date();
  const en48hs = new Date(ahora.getTime() + 48 * 60 * 60000);

  let turnosFiltrados = (() => {
    switch (vista) {
      case 'hoy':
        return turnos.filter(t => {
          const d = new Date(t.fecha_hora);
          return d.toDateString() === ahora.toDateString();
        });
      case '48hs':
        return turnos.filter(t => {
          const d = new Date(t.fecha_hora);
          return d >= ahora && d <= en48hs;
        });
      case 'sinConfirmar':
        return turnos.filter(t => t.confirmado === 'Sin confirmar');
      default:
        return turnos;
    }
  })().sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

  // Filtro por vendedor (solo admin)
  if (isAdmin && filtroVendedor !== 'todos') {
    turnosFiltrados = turnosFiltrados.filter(t => String(t.closer_id) === filtroVendedor);
  }

  const colorPorConfirmado = (c: string) => {
    switch (c) {
      case 'Confirmado': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Sin confirmar': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'No responde': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Reprograma': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Cancelado': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const mensajeWhatsApp = (t: any, tipo: 'cliente' | 'vendedor') => {
    const fecha = new Date(t.fecha_hora).toLocaleDateString('es-AR');
    const hora = new Date(t.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    if (tipo === 'cliente') {
      return `Hola ${t.cliente_nombre}! Te confirmo el turno para ${t.motivo} el ${fecha} a las ${hora}. ¿Confirmas asistencia?`;
    }
    return `Hola ${t.closer_nombre || ''}! Recordatorio: tenes un turno con ${t.cliente_nombre} en 15 min (${t.motivo}). Cliente: ${t.telefono}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>
          Calendario {isAdmin && <span className="text-sm text-gray-400 font-normal">(Admin - Vista total)</span>}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Alertas urgentes (15 min) */}
          {alertasUrgentes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-pulse">
              <AlertTriangle className="w-4 h-4" /> {alertasUrgentes.length} en 15 min
            </div>
          )}
          {/* Alertas normales (30 min) */}
          {alertas.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
              <Bell className="w-4 h-4" /> {alertas.length} en 30 min
            </div>
          )}

          {/* Filtro por vendedor (solo admin) */}
          {isAdmin && (
            <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
              className="rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-1.5 text-xs text-white">
              <option value="todos">Todos los vendedores</option>
              {closers.map((c: any) => (
                <option key={c.id} value={String(c.id)}>{c.nombre}</option>
              ))}
            </select>
          )}

          <div className="flex rounded-lg bg-[#0a0a0f] border border-cyan-500/10 overflow-hidden">
            {([
              { key: 'calendario', label: '📅' },
              { key: 'hoy', label: '📋 Hoy' },
              { key: '48hs', label: '⏰ 48hs' },
              { key: 'sinConfirmar', label: '⚠️ Sin conf.' },
              { key: 'todos', label: 'Todos' },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setVista(v.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  vista === v.key ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-cyan-300'
                }`}>
                {v.label}
              </button>
            ))}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                <Plus className="w-4 h-4 mr-1" /> Nuevo Turno
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-cyan-400">{editId ? 'Editar Turno' : 'Nuevo Turno'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                {!userTelefono && !editTelefono && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-xs text-amber-300 mb-2">⚠️ Configura tu numero de WhatsApp para recibir notificaciones de turnos</p>
                    <Button onClick={() => setEditTelefono(true)} size="sm" className="bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
                      <Phone className="w-3 h-3 mr-1" /> Configurar
                    </Button>
                  </div>
                )}
                {editTelefono && (
                  <div className="flex items-center gap-2">
                    <Input placeholder="+5491123456789" value={userTelefono} onChange={e => setUserTelefono(e.target.value)} className="bg-[#0a0a0f] border-cyan-500/20 text-white" />
                    <Button onClick={saveTelefono} size="sm" className="bg-cyan-500 text-black">Guardar</Button>
                  </div>
                )}

                {/* Asignar vendedor (solo admin) */}
                {isAdmin && (
                  <div><Label className="text-cyan-300/80 text-sm">Vendedor asignado</Label>
                    <select value={form.closer_id || ''} onChange={e => setForm({ ...form, closer_id: parseInt(e.target.value) || null })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      <option value="">Seleccionar...</option>
                      {closers.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
                {isAdmin && (
                  <div><Label className="text-cyan-300/80 text-sm">Vendedor asignado</Label>
                    <select value={form.closer_id || ''} onChange={e => setForm({ ...form, closer_id: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      <option value="">Seleccionar...</option>
                      {closers.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Cliente</Label>
                    <Input value={form.cliente_nombre || ''} onChange={e => setForm({ ...form, cliente_nombre: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Telefono</Label>
                    <Input value={form.telefono || ''} onChange={e => setForm({ ...form, telefono: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Fecha y Hora</Label>
                  <Input type="datetime-local" value={form.fecha_hora || ''} onChange={e => setForm({ ...form, fecha_hora: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Motivo</Label>
                    <select value={form.motivo || ''} onChange={e => setForm({ ...form, motivo: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {MOTIVOS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Producto objetivo</Label>
                    <select value={form.producto_objetivo || ''} onChange={e => setForm({ ...form, producto_objetivo: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {PRODUCTOS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Modelo / Detalle</Label>
                  <Input value={form.modelo_detalle || ''} onChange={e => setForm({ ...form, modelo_detalle: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" placeholder="Ej: iPhone 13 128GB bateria 89%" />
                </div>
                <div><Label className="text-cyan-300/80 text-sm">¿Que busca el cliente?</Label>
                  <textarea value={form.que_busca || ''} onChange={e => setForm({ ...form, que_busca: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white resize-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Presupuesto</Label>
                    <Input type="number" value={form.presupuesto_estimado || ''} onChange={e => setForm({ ...form, presupuesto_estimado: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Moneda</Label>
                    <select value={form.moneda || ''} onChange={e => setForm({ ...form, moneda: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {MONEDAS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Forma de pago</Label>
                    <select value={form.forma_pago || ''} onChange={e => setForm({ ...form, forma_pago: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {FORMAS_PAGO.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Sena</Label>
                    <select value={form.senia || ''} onChange={e => setForm({ ...form, senia: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {SENIAS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Monto sena</Label>
                    <Input type="number" value={form.monto_senia || ''} onChange={e => setForm({ ...form, monto_senia: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Confirmado</Label>
                    <select value={form.confirmado || ''} onChange={e => setForm({ ...form, confirmado: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {CONFIRMADOS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Canal de contacto</Label>
                    <select value={form.canal_contacto || ''} onChange={e => setForm({ ...form, canal_contacto: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {CANALES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Notas</Label>
                  <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white resize-none" />
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <input type="checkbox" id="notificar_whatsapp" checked={form.notificar_whatsapp} onChange={e => setForm({ ...form, notificar_whatsapp: e.target.checked })}
                    className="w-4 h-4 rounded border-green-500/30 bg-[#0a0a0f] text-green-400" />
                  <Label htmlFor="notificar_whatsapp" className="text-green-300 text-sm cursor-pointer flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Notificarme por WhatsApp 30 min antes
                  </Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-gray-300">Cancelar</Button>
                  <Button onClick={save} className="bg-cyan-500 text-black font-semibold">{editId ? 'Guardar cambios' : 'Guardar'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alertas URGENTES (15 min) */}
      {alertasUrgentes.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertasUrgentes.map(a => {
            const msgCliente = mensajeWhatsApp(a, 'cliente');
            const msgVendedor = mensajeWhatsApp(a, 'vendedor');
            const linkCliente = a.telefono ? waLink(a.telefono, msgCliente) : null;
            const linkVendedor = a.closer_telefono ? waLink(a.closer_telefono, msgVendedor) : null;
            return (
              <div key={a.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20 animate-pulse gap-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-300">🚨 TURNO EN 15 MINUTOS</p>
                    <p className="text-xs text-gray-400">
                      {a.cliente_nombre} — {a.motivo} — {new Date(a.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {isAdmin && a.closer_nombre && ` · Vendedor: ${a.closer_nombre}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {linkCliente && (
                    <a href={linkCliente} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-medium">
                      <MessageCircle className="w-3.5 h-3.5" /> Al cliente
                    </a>
                  )}
                  {isAdmin && linkVendedor && (
                    <a href={linkVendedor} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-medium">
                      <Phone className="w-3.5 h-3.5" /> Al vendedor
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alertas normales (30 min) */}
      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.map(a => {
            const msgCliente = mensajeWhatsApp(a, 'cliente');
            const linkCliente = a.telefono ? waLink(a.telefono, msgCliente) : null;
            return (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-sm font-medium text-orange-300">⏰ Turno en 30 minutos</p>
                    <p className="text-xs text-gray-400">
                      {a.cliente_nombre} — {a.motivo} — {new Date(a.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {isAdmin && a.closer_nombre && ` · Vendedor: ${a.closer_nombre}`}
                    </p>
                  </div>
                </div>
                {linkCliente && (
                  <a href={linkCliente} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vista Calendario */}
      {vista === 'calendario' && (
        <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-cyan-500/10 text-cyan-400">←</button>
            <h2 className="text-lg font-semibold text-cyan-300">{selectedDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-cyan-500/10 text-cyan-400">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => (
              <div key={d} className="text-center text-xs text-cyan-400/50 py-2">{d}</div>
            ))}
            {dias.map((dia, i) => (
              <div key={i} className={`min-h-[80px] rounded-lg border p-1 ${dia === new Date().getDate() && month === new Date().getMonth() ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-500/5 bg-[#0a0a0f]/50'}`}>
                {dia && (
                  <>
                    <span className="text-xs text-gray-400 font-medium">{dia}</span>
                    <div className="mt-1 space-y-0.5">
                      {(turnosPorDia[dia] || []).map(t => (
                        <div key={t.id} onClick={() => openEdit(t)}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${colorPorConfirmado(t.confirmado)} border`}
                          title={`${t.cliente_nombre} - ${t.motivo}${isAdmin && t.closer_nombre ? ` (${t.closer_nombre})` : ''}`}>
                          {new Date(t.fecha_hora).getHours()}:00 {t.cliente_nombre.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vistas de lista */}
      {vista !== 'calendario' && (
        <div className="space-y-3">
          {turnosFiltrados.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No hay turnos en esta vista</p>
          )}
          {turnosFiltrados.map(t => {
            const accion = accionSugerida(t);
            const msgCliente = mensajeWhatsApp(t, 'cliente');
            const linkCliente = t.telefono ? waLink(t.telefono, msgCliente) : null;
            return (
              <div key={t.id} className="p-4 rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{t.cliente_nombre}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${colorPorConfirmado(t.confirmado)}`}>{t.confirmado}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{t.motivo}</span>
                      {isAdmin && t.closer_nombre && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {t.closer_nombre}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(t.fecha_hora).toLocaleString('es-AR')} · {t.telefono}
                      {t.producto_objetivo && ` · ${t.producto_objetivo}`}
                      {t.modelo_detalle && ` · ${t.modelo_detalle}`}
                    </p>
                    {t.que_busca && <p className="text-xs text-gray-500 mt-1">📝 {t.que_busca}</p>}
                    {(t.presupuesto_estimado > 0) && (
                      <p className="text-xs text-gray-500 mt-1">
                        💰 Presupuesto: {t.presupuesto_estimado} {t.moneda}
                        {t.senia === 'Seno' && ` · Sena: ${t.monto_senia} ${t.moneda}`}
                      </p>
                    )}
                    <div className={`mt-2 flex items-center gap-2 text-xs px-2 py-1 rounded-lg border ${
                      accion.color === 'red' ? 'bg-red-500/5 border-red-500/20 text-red-400' :
                      accion.color === 'orange' ? 'bg-orange-500/5 border-orange-500/20 text-orange-400' :
                      accion.color === 'green' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                      'bg-gray-500/5 border-gray-500/20 text-gray-400'
                    }`}>
                      <accion.icon className="w-3.5 h-3.5" />
                      {accion.texto}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {linkCliente && (
                      <a href={linkCliente} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-green-500/10 text-green-400" title="WhatsApp al cliente">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
