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
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';

interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  readonly?: boolean;
  hidden?: boolean;
  render?: (val: any, row: any) => React.ReactNode;
}

interface CrudPageProps {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  filterFields?: string[];
}

export default function CrudPage({ title, endpoint, fields, filterFields }: CrudPageProps) {
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiGet(endpoint);
    setItems(Array.isArray(data) ? data : []);
    setFiltered(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFiltered(items); return; }
    const s = search.toLowerCase();
    const ff = filterFields || fields.map(f => f.key);
    setFiltered(items.filter(item =>
      ff.some(key => String(item[key] || '').toLowerCase().includes(s))
    ));
  }, [search, items, filterFields, fields]);

  const openCreate = () => {
    setEditing(null);
    const initial: Record<string, any> = {};
    fields.forEach(f => { if (!f.readonly && !f.hidden) initial[f.key] = ''; });
    setForm(initial);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    const initial: Record<string, any> = {};
    fields.forEach(f => { if (!f.hidden) initial[f.key] = item[f.key] ?? ''; });
    setForm(initial);
    setDialogOpen(true);
  };

  const save = async () => {
    const payload: Record<string, any> = {};
    fields.forEach(f => {
      if (!f.hidden) payload[f.key] = form[f.key];
    });
    if (editing) {
      await apiPut(`${endpoint}/${editing.id}`, payload);
    } else {
      await apiPost(endpoint, payload);
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    await apiDelete(`${endpoint}/${id}`);
    load();
  };

  const visibleFields = fields.filter(f => !f.hidden);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>
          {title}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64 bg-[#0d0d14] border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-500 hover:text-cyan-400" />
              </button>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300">
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d0d14] border border-cyan-500/30 text-white max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">{editing ? 'Editar' : 'Nuevo'} {title.slice(0, -1)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {visibleFields.filter(f => !f.readonly).map(f => (
                  <div key={f.key}>
                    <Label className="text-cyan-300/80 text-sm">{f.label}</Label>
                    {f.options ? (
                      <select
                        value={form[f.key] || ''}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={form[f.key] || ''}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        rows={3}
                        className="mt-1 w-full rounded-md bg-[#0a0a0f] border border-cyan-500/20 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none resize-none"
                      />
                    ) : (
                      <Input
                        type={f.type || 'text'}
                        value={form[f.key] || ''}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="mt-1 bg-[#0a0a0f] border-cyan-500/20 text-white focus:border-cyan-400"
                      />
                    )}
                  </div>
                ))}
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
              {visibleFields.map(f => (
                <TableHead key={f.key} className="text-cyan-400/70 text-xs uppercase tracking-wider">{f.label}</TableHead>
              ))}
              <TableHead className="text-cyan-400/70 text-xs uppercase tracking-wider w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={visibleFields.length + 1} className="text-center py-12 text-gray-500">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={visibleFields.length + 1} className="text-center py-12 text-gray-500">Sin registros</TableCell></TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={item.id} className="border-cyan-500/5 hover:bg-cyan-500/5 transition-colors">
                  {visibleFields.map(f => (
                    <TableCell key={f.key} className="text-gray-300 text-sm">
                      {f.render ? f.render(item[f.key], item) : String(item[f.key] ?? '-')}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-cyan-500/10 text-cyan-400 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(item.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
