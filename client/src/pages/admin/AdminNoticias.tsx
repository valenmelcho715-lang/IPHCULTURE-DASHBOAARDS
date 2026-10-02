import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Newspaper, Trash2, AlertTriangle, Package, Info } from 'lucide-react';

export default function AdminNoticias() {
  const [noticias, setNoticias] = useState<any[]>([]);
  const [form, setForm] = useState({ titulo: '', contenido: '', tipo: 'general' });

  useEffect(() => {
    loadNoticias();
  }, []);

  const loadNoticias = async () => {
    const data = await apiGet('/noticias');
    setNoticias(Array.isArray(data) ? data : []);
  };

  const publicar = async () => {
    await apiPost('/noticias', form);
    setForm({ titulo: '', contenido: '', tipo: 'general' });
    loadNoticias();
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar noticia?')) return;
    await apiDelete(`/noticias/${id}`);
    loadNoticias();
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === 'urgente') return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (tipo === 'stock') return <Package className="w-4 h-4 text-amber-400" />;
    return <Info className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Noticias y Anuncios</h1>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Publicar Noticia</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-cyan-300/80 text-sm">Título</Label>
            <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
          </div>
          <div>
            <Label className="text-cyan-300/80 text-sm">Contenido</Label>
            <Textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} rows={3} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
          </div>
          <div>
            <Label className="text-cyan-300/80 text-sm">Tipo</Label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
              <option value="general">General</option>
              <option value="stock">Stock Nuevo</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <Button onClick={publicar} className="bg-cyan-500 text-black font-semibold hover:bg-cyan-400">
            <Newspaper className="w-4 h-4 mr-2" /> Publicar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
        <h3 className="text-sm font-semibold text-cyan-300 mb-4">Noticias Publicadas</h3>
        <div className="space-y-2">
          {noticias.map(n => (
            <div key={n.id} className={`flex items-start justify-between p-3 rounded-lg border ${n.tipo === 'urgente' ? 'border-red-500/20 bg-red-500/5' : n.tipo === 'stock' ? 'border-amber-500/20 bg-amber-500/5' : 'border-cyan-500/10 bg-[#0a0a0f]/50'}`}>
              <div className="flex items-start gap-3">
                {tipoIcon(n.tipo)}
                <div>
                  <p className={`text-sm font-medium ${n.tipo === 'urgente' ? 'text-red-300' : n.tipo === 'stock' ? 'text-amber-300' : 'text-cyan-300'}`}>{n.titulo}</p>
                  <p className="text-sm text-gray-400">{n.contenido}</p>
                </div>
              </div>
              <button onClick={() => eliminar(n.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
