import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Search, X, TrendingUp, Award, DollarSign, FileDown } from 'lucide-react';

export default function AdminVentas() {
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [costoForm, setCostoForm] = useState('');
  const [gananciaForm, setGananciaForm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiGet('/ventas');
    setItems(Array.isArray(data) ? data : []);
    setFiltered(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFiltered(items); return; }
    const s = search.toLowerCase();
    setFiltered(items.filter(i =>
      (i.nombre_comprador || '').toLowerCase().includes(s) ||
      (i.apellido_comprador || '').toLowerCase().includes(s) ||
      (i.producto || '').toLowerCase().includes(s) ||
      (i.closer_nombre || '').toLowerCase().includes(s)
    ));
  }, [search, items]);

  const openEditGanancia = (item: any) => {
    setEditing(item);
    setCostoForm(String(item.costo_usd || 0));
    setGananciaForm(String(item.ganancia_usd || 0));
    setDialogOpen(true);
  };

  const saveGanancia = async () => {
    const payload: any = {};
    const c = parseFloat(costoForm);
    if (!isNaN(c)) payload.costo_usd = c;
    const g = parseFloat(gananciaForm);
    if (!isNaN(g)) payload.ganancia_usd = g;
    await apiPut(`/ventas/${editing.id}`, payload);
    setDialogOpen(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await apiDelete(`/ventas/${id}`);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Todas las Ventas</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 w-64 bg-[#0d0d14] border-cyan-500/20 text-white" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-500 hover:text-cyan-400" /></button>}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white">
          <DialogHeader><DialogTitle className="text-cyan-400">Editar Ganancia y Costo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">Venta: {editing?.producto}</p>
            <p className="text-sm text-gray-400">Vendedor: {editing?.closer_nombre}</p>
            <p className="text-sm text-gray-400">Precio venta: ${editing?.precio_venta_usd}</p>
            <div>
              <label className="text-cyan-300/80 text-sm">Costo del negocio (USD)</label>
              <Input type="number" value={costoForm} onChange={e => setCostoForm(e.target.value)}
                className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
            </div>
            <div>
              <label className="text-cyan-300/80 text-sm">Ganancia real del negocio (USD)</label>
              <Input type="number" value={gananciaForm} onChange={e => setGananciaForm(e.target.value)}
                className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
            </div>
            <p className="text-xs text-gray-500">La comisión del vendedor se recalculará automáticamente (20% de la ganancia, o $15 si es canje).</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-gray-300">Cancelar</Button>
              <Button onClick={saveGanancia} className="bg-cyan-500 text-black font-semibold">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-cyan-500/10 hover:bg-transparent">
              <TableHead className="text-cyan-400/70 text-xs uppercase">Vendedor</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Comprador</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">DNI</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Producto</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Venta</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Costo</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Ganancia</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Comisión</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-500">Cargando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-gray-500">Sin ventas</TableCell></TableRow>
            : filtered.map(item => (
              <TableRow key={item.id} className="border-cyan-500/5 hover:bg-cyan-500/5 transition-colors">
                <TableCell className="text-sm text-violet-300">{item.closer_nombre || `#${item.closer_id}`}</TableCell>
                <TableCell className="text-gray-300 text-sm">{item.nombre_comprador} {item.apellido_comprador}</TableCell>
                <TableCell className="text-gray-400 text-sm">{item.dni || '-'}</TableCell>
                <TableCell className="text-gray-300 text-sm">{item.producto}{item.es_canje ? ' 🔄' : ''}</TableCell>
                <TableCell className="text-emerald-400 text-sm">${item.precio_venta_usd}</TableCell>
                <TableCell className="text-gray-400 text-sm">${item.costo_usd ?? '-'}</TableCell>
                <TableCell>
                  <button onClick={() => openEditGanancia(item)} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm">
                    <TrendingUp className="w-3 h-3" /> ${item.ganancia_usd?.toFixed(2) ?? '-'}
                  </button>
                </TableCell>
                <TableCell className="text-fuchsia-400 text-sm font-medium">${item.comision_usd?.toFixed(2) ?? '0.00'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditGanancia(item)} className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400"><DollarSign className="w-4 h-4" /></button>
                    {item.comprobante_pdf && (
                      <a href={item.comprobante_pdf} target="_blank" download className="p-1.5 rounded hover:bg-violet-500/10 text-violet-400"><FileDown className="w-4 h-4" /></a>
                    )}
                    <button onClick={() => remove(item.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
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
