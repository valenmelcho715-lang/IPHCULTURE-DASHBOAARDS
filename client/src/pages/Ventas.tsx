import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Plus, Search, X, TrendingUp, Award } from 'lucide-react';

export default function Ventas() {
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [clientes, setClientes] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, c] = await Promise.all([apiGet('/ventas'), apiGet('/clientes')]);
    setItems(Array.isArray(v) ? v : []);
    setFiltered(Array.isArray(v) ? v : []);
    setClientes(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFiltered(items); return; }
    const s = search.toLowerCase();
    setFiltered(items.filter(i =>
      (i.producto || '').toLowerCase().includes(s) ||
      (i.cliente_nombre || '').toLowerCase().includes(s)
    ));
  }, [search, items]);

  const openCreate = () => {
    setEditing(null);
    setForm({ cliente_id: '', producto: '', precio_venta_usd: '', costo_usd: '', metodo_pago: 'Efectivo USD', estado: 'Pendiente', notas: '' });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      cliente_id: item.cliente_id || '',
      producto: item.producto || '',
      precio_venta_usd: item.precio_venta_usd || '',
      costo_usd: item.costo_usd || '',
      metodo_pago: item.metodo_pago || 'Efectivo USD',
      estado: item.estado || 'Pendiente',
      notas: item.notas || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null,
      producto: form.producto,
      precio_venta_usd: parseFloat(form.precio_venta_usd) || 0,
      costo_usd: parseFloat(form.costo_usd) || 0,
      metodo_pago: form.metodo_pago,
      estado: form.estado,
      notas: form.notas,
    };
    if (editing) {
      await apiPut(`/ventas/${editing.id}`, payload);
    } else {
      await apiPost('/ventas', payload);
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await apiDelete(`/ventas/${id}`);
    load();
  };

  const calcPreview = () => {
    const pv = parseFloat(form.precio_venta_usd) || 0;
    const co = parseFloat(form.costo_usd) || 0;
    const ganancia = pv - co;
    const comision = ganancia * 0.20;
    return { ganancia, comision };
  };

  const preview = calcPreview();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Ventas</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64 bg-[#0d0d14] border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-400" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-500 hover:text-cyan-400" /></button>}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                <Plus className="w-4 h-4 mr-1" /> Nueva Venta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-cyan-400">{editing ? 'Editar' : 'Nueva'} Venta</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-cyan-300/80 text-sm">Cliente</Label>
                  <select value={form.cliente_id || ''} onChange={e => setForm({ ...form, cliente_id: e.target.value })}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none">
                    <option value="">Sin cliente</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Producto</Label>
                  <Input value={form.producto || ''} onChange={e => setForm({ ...form, producto: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white focus:border-cyan-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Precio Venta USD</Label>
                    <Input type="number" value={form.precio_venta_usd || ''} onChange={e => setForm({ ...form, precio_venta_usd: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white focus:border-cyan-400" />
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Costo USD</Label>
                    <Input type="number" value={form.costo_usd || ''} onChange={e => setForm({ ...form, costo_usd: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white focus:border-cyan-400" />
                  </div>
                </div>
                {/* Preview */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-[10px] text-emerald-400/60 uppercase">Ganancia</p>
                      <p className="text-sm font-bold text-emerald-400">${preview.ganancia.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-fuchsia-400" />
                    <div>
                      <p className="text-[10px] text-fuchsia-400/60 uppercase">Comisión (20%)</p>
                      <p className="text-sm font-bold text-fuchsia-400">${preview.comision.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Método de Pago</Label>
                    <select value={form.metodo_pago || ''} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none">
                      {['Efectivo USD', 'Efectivo ARS', 'Transferencia', 'Cuotas'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Estado</Label>
                    <select value={form.estado || ''} onChange={e => setForm({ ...form, estado: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none">
                      {['Pendiente', 'Completada', 'Cancelada'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label className="text-cyan-300/80 text-sm">Notas</Label>
                  <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-800">Cancelar</Button>
                  <Button onClick={save} className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold">Guardar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 overflow-hidden" style={{ boxShadow: '0 0 20px rgba(0,240,255,0.03)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-cyan-500/10 hover:bg-transparent">
              <TableHead className="text-cyan-400/70 text-xs uppercase">Producto</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Cliente</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Venta USD</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Costo USD</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Ganancia</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Comisión 20%</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Estado</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-500">Cargando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-500">Sin ventas</TableCell></TableRow>
            : filtered.map(item => (
              <TableRow key={item.id} className="border-cyan-500/5 hover:bg-cyan-500/5 transition-colors">
                <TableCell className="text-gray-300 text-sm font-medium">{item.producto}</TableCell>
                <TableCell className="text-gray-400 text-sm">{item.cliente_nombre || '-'}</TableCell>
                <TableCell className="text-emerald-400 text-sm">${item.precio_venta_usd}</TableCell>
                <TableCell className="text-gray-400 text-sm">${item.costo_usd}</TableCell>
                <TableCell className="text-emerald-400 text-sm font-medium">${item.ganancia_usd?.toFixed(2)}</TableCell>
                <TableCell className="text-fuchsia-400 text-sm font-medium">${item.comision_usd?.toFixed(2)}</TableCell>
                <TableCell><StatusBadge status={item.estado} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(item.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pendiente: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Completada: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Cancelada: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>{status}</span>;
}
