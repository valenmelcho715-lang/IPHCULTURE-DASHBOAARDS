import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Plus, Search, X, FileText, Info, Upload, FileDown } from 'lucide-react';

export default function CloserVentas() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

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
      (i.dni || '').includes(s)
    ));
  }, [search, items]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      nombre_comprador: '', apellido_comprador: '', dni: '', producto: '',
      precio_venta_usd: '', metodo_pago: 'Efectivo USD',
      pago_completo: true, monto_senado_usd: '', falta_pagar_usd: '',
      es_canje: false, estado: 'Completada', notas: '', comprobante_pdf: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      nombre_comprador: item.nombre_comprador || '',
      apellido_comprador: item.apellido_comprador || '',
      dni: item.dni || '', producto: item.producto || '',
      precio_venta_usd: item.precio_venta_usd || '',
      metodo_pago: item.metodo_pago || 'Efectivo USD',
      pago_completo: item.pago_completo === 1,
      monto_senado_usd: item.monto_senado_usd || '',
      falta_pagar_usd: item.falta_pagar_usd || '',
      es_canje: item.es_canje === 1,
      estado: item.estado || 'Completada', notas: item.notas || '',
      comprobante_pdf: item.comprobante_pdf || ''
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      precio_venta_usd: parseFloat(form.precio_venta_usd) || 0,
      pago_completo: form.pago_completo ? 1 : 0,
      monto_senado_usd: form.pago_completo ? 0 : (parseFloat(form.monto_senado_usd) || 0),
      falta_pagar_usd: form.pago_completo ? 0 : (parseFloat(form.falta_pagar_usd) || 0),
      es_canje: form.es_canje ? 1 : 0,
    };
    if (editing) {
      await apiPut(`/ventas/${editing.id}`, payload);
    } else {
      const result = await apiPost('/ventas', payload);
      if (result.factura) {
        alert(`Factura generada: ${result.factura}`);
      }
    }
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
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Mis Ventas</h1>
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
            <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-cyan-400">{editing ? 'Editar' : 'Nueva'} Venta</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                {/* Datos del comprador */}
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-cyan-300/80 text-sm">Nombre</Label>
                    <Input value={form.nombre_comprador || ''} onChange={e => setForm({ ...form, nombre_comprador: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Apellido</Label>
                    <Input value={form.apellido_comprador || ''} onChange={e => setForm({ ...form, apellido_comprador: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">DNI</Label>
                    <Input value={form.dni || ''} onChange={e => setForm({ ...form, dni: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                </div>

                <div><Label className="text-cyan-300/80 text-sm">Producto</Label>
                  <Input value={form.producto || ''} onChange={e => setForm({ ...form, producto: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Precio Venta USD</Label>
                    <Input type="number" value={form.precio_venta_usd || ''} onChange={e => setForm({ ...form, precio_venta_usd: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                  </div>
                </div>

                {/* Es canje */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <input type="checkbox" id="es_canje" checked={form.es_canje} onChange={e => setForm({ ...form, es_canje: e.target.checked })}
                    className="w-4 h-4 rounded border-cyan-500/30 bg-[#0a0a0f] text-cyan-400" />
                  <Label htmlFor="es_canje" className="text-orange-300 text-sm cursor-pointer">Es canje (comisión fija $15 USD)</Label>
                </div>

                {/* Info comisión */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <p className="text-xs text-blue-300/80">
                    {form.es_canje
                      ? 'Canje: comisión fija de $15 USD.'
                      : 'La comisión se calculará automáticamente (20% de la ganancia) una vez que el admin defina la ganancia real de esta venta.'}
                  </p>
                </div>

                {/* Pago */}
                <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="pago_completo" checked={form.pago_completo} onChange={e => setForm({ ...form, pago_completo: e.target.checked })}
                      className="w-4 h-4 rounded border-cyan-500/30 bg-[#0a0a0f] text-cyan-400" />
                    <Label htmlFor="pago_completo" className="text-cyan-300 text-sm cursor-pointer">Pagó completo</Label>
                  </div>
                  {!form.pago_completo && (
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-cyan-300/80 text-xs">Señó USD</Label>
                        <Input type="number" value={form.monto_senado_usd || ''} onChange={e => setForm({ ...form, monto_senado_usd: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                      </div>
                      <div><Label className="text-cyan-300/80 text-xs">Falta pagar USD</Label>
                        <Input type="number" value={form.falta_pagar_usd || ''} onChange={e => setForm({ ...form, falta_pagar_usd: e.target.value })} className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-cyan-300/80 text-sm">Método de Pago</Label>
                    <select value={form.metodo_pago || ''} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {['Efectivo USD', 'Efectivo ARS', 'Transferencia', 'Cuotas'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><Label className="text-cyan-300/80 text-sm">Estado</Label>
                    <select value={form.estado || ''} onChange={e => setForm({ ...form, estado: e.target.value })}
                      className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white">
                      {['Completada', 'Pendiente', 'Cancelada'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Comprobante PDF (transferencia) */}
                {form.metodo_pago === 'Transferencia' && (
                  <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                    <Label className="text-violet-300/80 text-sm flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" /> Comprobante de transferencia (PDF)
                    </Label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setForm({ ...form, comprobante_pdf: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="mt-2 block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-violet-500/10 file:text-violet-400 hover:file:bg-violet-500/20"
                    />
                    {form.comprobante_pdf && (
                      <p className="text-[10px] text-violet-400 mt-1">✓ PDF cargado</p>
                    )}
                  </div>
                )}

                <div><Label className="text-cyan-300/80 text-sm">Notas</Label>
                  <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white resize-none" />
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

      {/* Tabla de ventas */}
      <div className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 overflow-hidden" style={{ boxShadow: '0 0 20px rgba(0,240,255,0.03)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-cyan-500/10 hover:bg-transparent">
              <TableHead className="text-cyan-400/70 text-xs uppercase">Comprador</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">DNI</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Producto</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Venta</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Pago</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase">Comisión</TableHead>
              <TableHead className="text-cyan-400/70 text-xs uppercase w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-500">Cargando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-500">Sin ventas</TableCell></TableRow>
            : filtered.map(item => (
              <TableRow key={item.id} className="border-cyan-500/5 hover:bg-cyan-500/5 transition-colors">
                <TableCell className="text-gray-300 text-sm">{item.nombre_comprador} {item.apellido_comprador}</TableCell>
                <TableCell className="text-gray-400 text-sm">{item.dni || '-'}</TableCell>
                <TableCell className="text-gray-300 text-sm">{item.producto}{item.es_canje ? ' 🔄' : ''}</TableCell>
                <TableCell className="text-emerald-400 text-sm">${item.precio_venta_usd}</TableCell>
                <TableCell>
                  {item.pago_completo ? <span className="text-xs text-emerald-400">✓ Completo</span> : <span className="text-xs text-amber-400">Señó ${item.monto_senado_usd} | Falta ${item.falta_pagar_usd}</span>}
                </TableCell>
                <TableCell className="text-fuchsia-400 text-sm font-medium">
                  {item.es_canje
                    ? `$${item.comision_usd?.toFixed(2) ?? '0.00'}`
                    : (item.ganancia_usd === 0 || item.ganancia_usd == null)
                      ? <span className="text-gray-500 italic text-xs">Pendiente</span>
                      : `$${item.comision_usd?.toFixed(2) ?? '0.00'}`}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(item.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    {item.factura && (
                      <a href={`/factura/${item.factura}`} target="_blank" className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400"><FileText className="w-4 h-4" /></a>
                    )}
                    {item.comprobante_pdf && (
                      <a href={item.comprobante_pdf} target="_blank" download className="p-1.5 rounded hover:bg-violet-500/10 text-violet-400"><FileDown className="w-4 h-4" /></a>
                    )}
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
