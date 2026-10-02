import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mail, Check } from 'lucide-react';

export default function AdminMensajes() {
  const [closers, setClosers] = useState<any[]>([]);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [form, setForm] = useState({ closer_id: '', titulo: '', contenido: '' });

  useEffect(() => {
    apiGet('/closers').then((d: any[]) => setClosers(Array.isArray(d) ? d : []));
    loadMensajes();
  }, []);

  const loadMensajes = async () => {
    const data = await apiGet('/mensajes');
    setMensajes(Array.isArray(data) ? data : []);
  };

  const enviar = async () => {
    await apiPost('/mensajes', form);
    setForm({ closer_id: '', titulo: '', contenido: '' });
    loadMensajes();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Enviar Mensajes</h1>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Nuevo Mensaje</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-cyan-300/80 text-sm">Vendedor</Label>
            <select value={form.closer_id} onChange={e => setForm({ ...form, closer_id: e.target.value })}
              className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
              <option value="">Seleccionar...</option>
              {closers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-cyan-300/80 text-sm">Título</Label>
            <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
          </div>
          <div>
            <Label className="text-cyan-300/80 text-sm">Contenido</Label>
            <Textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} rows={3} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
          </div>
          <Button onClick={enviar} className="bg-cyan-500 text-black font-semibold hover:bg-cyan-400">
            <Send className="w-4 h-4 mr-2" /> Enviar Mensaje
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Mensajes Enviados</h3>
        <div className="space-y-2">
          {mensajes.map(m => (
            <div key={m.id} className={`p-3 rounded-lg border ${m.leido ? 'border-cyan-500/5 bg-[#0a0a0f]/50' : 'border-cyan-500/20 bg-cyan-500/5'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">{m.titulo}</p>
                {m.leido ? <Check className="w-4 h-4 text-emerald-400" /> : <Mail className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-gray-400">Para: {m.closer_nombre || `#${m.closer_id}`}</p>
              <p className="text-sm text-gray-300 mt-1">{m.contenido}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
