import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, X, Bell, CalendarDays, Clock, Trash2, Pencil, MessageCircle, Phone } from 'lucide-react';

export default function CloserCalendario() {
  const [turnos, setTurnos] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [alertas, setAlertas] = useState<any[]>([]);
  const [userTelefono, setUserTelefono] = useState('');
  const [editTelefono, setEditTelefono] = useState(false);

  useEffect(() => {
    loadTurnos();
    loadUserTelefono();
    const interval = setInterval(checkAlertas, 60000); // revisar cada minuto
    checkAlertas();
    return () => clearInterval(interval);
  }, []);

  const loadUserTelefono = async () => {
    const me = await apiGet('/auth/me');
    if (me?.telefono) setUserTelefono(me.telefono);
  };

  const saveTelefono = async () => {
    await apiPut('/auth/me/telefono', { telefono: userTelefono });
    setEditTelefono(false);
  };

  const loadTurnos = async () => {
    const data = await apiGet('/turnos');
    setTurnos(Array.isArray(data) ? data : []);
  };

  const waLink = (telefono: string, mensaje: string) => {
    const num = telefono.replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
  };

  const checkAlertas = () => {
    const ahora = new Date();
    const en30Min = new Date(ahora.getTime() + 30 * 60000);
    const alertasPendientes = turnos.filter(t => {
      const fechaTurno = new Date(t.fecha_hora);
      return fechaTurno > ahora && fechaTurno <= en30Min && t.alerta_enviada === 0;
    });
    setAlertas(alertasPendientes);
    // En una app real, acá se enviaría push notification
    if (alertasPendientes.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      alertasPendientes.forEach(t => {
        new Notification('⏰ Turno en 30 min', { body: `${t.cliente_nombre} - ${t.tipo}` });
      });
    }
  };

  const save = async () => {
    await apiPost('/turnos', form);
    setDialogOpen(false);
    loadTurnos();
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar turno?')) return;
    await apiDelete(`/turnos/${id}`);
    loadTurnos();
  };

  // Generar días del mes
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Calendario</h1>
        <div className="flex items-center gap-3">
          {alertas.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-pulse">
              <Bell className="w-4 h-4" /> {alertas.length} alerta{alertas.length > 1 ? 's' : ''}
            </div>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm({ cliente_nombre: '', telefono: '', fecha_hora: '', tipo: 'Venta', notas: '' })}
                className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                <Plus className="w-4 h-4 mr-1" /> Nuevo Turno
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white">
              <DialogHeader><DialogTitle className="text-cyan-400">Nuevo Turno</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                {/* Config teléfono propio */}
                {!userTelefono && !editTelefono && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-xs text-amber-300 mb-2">⚠️ Configurá tu número de WhatsApp para recibir notificaciones de turnos</p>
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
                <div><Label className="text-cyan-300/80 text-sm">Cliente</Label>
                  <Input value={form.cliente_nombre || ''} onChange={e => setForm({ ...form, cliente_nombre: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Teléfono del cliente</Label>
                  <Input value={form.telefono || ''} onChange={e => setForm({ ...form, telefono: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Fecha y Hora</Label>
                  <Input type="datetime-local" value={form.fecha_hora || ''} onChange={e => setForm({ ...form, fecha_hora: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Tipo</Label>
                  <select value={form.tipo || ''} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                    {['Venta', 'Entrega', 'Canje', 'Consulta', 'Seguimiento'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <input type="checkbox" id="notificar_whatsapp" checked={form.notificar_whatsapp} onChange={e => setForm({ ...form, notificar_whatsapp: e.target.checked })}
                    className="w-4 h-4 rounded border-green-500/30 bg-[#0a0a0f] text-green-400" />
                  <Label htmlFor="notificar_whatsapp" className="text-green-300 text-sm cursor-pointer flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Notificarme por WhatsApp 30 min antes
                  </Label>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Notas</Label>
                  <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-gray-300">Cancelar</Button>
                  <Button onClick={save} className="bg-cyan-500 text-black font-semibold">Guardar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="mb-4 space-y-2">
          {alertas.map(a => {
            const mensaje = `⏰ Recordatorio: turno con ${a.cliente_nombre} en 30 min (${a.tipo}). Tel: ${a.telefono || 'no cargado'}`;
            const link = userTelefono ? waLink(userTelefono, mensaje) : null;
            return (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20 animate-pulse">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-300">⏰ Turno en 30 minutos</p>
                    <p className="text-xs text-gray-400">{a.cliente_nombre} — {a.tipo} — {new Date(a.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendario */}
      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-cyan-500/10 text-cyan-400">←</button>
          <h2 className="text-lg font-semibold text-cyan-300">{selectedDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h2>
          <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-cyan-500/10 text-cyan-400">→</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs text-cyan-400/50 py-2">{d}</div>
          ))}
          {dias.map((dia, i) => (
            <div key={i} className={`min-h-[80px] rounded-lg border p-1 ${dia === new Date().getDate() && month === new Date().getMonth() ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-500/5 bg-[#0a0a0f]/50'}`}>
              {dia && (
                <>
                  <span className="text-xs text-gray-400 font-medium">{dia}</span>
                  <div className="mt-1 space-y-0.5">
                    {(turnosPorDia[dia] || []).map(t => (
                      <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer ${
                        t.tipo === 'Venta' ? 'bg-emerald-500/10 text-emerald-400' :
                        t.tipo === 'Entrega' ? 'bg-blue-500/10 text-blue-400' :
                        t.tipo === 'Canje' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-violet-500/10 text-violet-400'
                      }`} title={`${t.cliente_nombre} - ${t.tipo}`}>
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

      {/* Lista de turnos */}
      <div className="mt-6 rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-4">
        <h3 className="text-sm font-semibold text-cyan-300 mb-3">Próximos Turnos</h3>
        <div className="space-y-2">
          {turnos.filter(t => new Date(t.fecha_hora) >= new Date()).sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()).map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-cyan-500/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${new Date(t.fecha_hora) <= new Date(Date.now() + 30*60000) ? 'bg-red-400 animate-pulse' : 'bg-cyan-400'}`} />
                <div>
                  <p className="text-sm text-white">{t.cliente_nombre}</p>
                  <p className="text-xs text-gray-400">{t.tipo} — {new Date(t.fecha_hora).toLocaleString('es-AR')}</p>
                </div>
              </div>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {turnos.filter(t => new Date(t.fecha_hora) >= new Date()).length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Sin turnos próximos</p>
          )}
        </div>
      </div>
    </div>
  );
}
