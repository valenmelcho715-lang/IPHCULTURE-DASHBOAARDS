import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smartphone, Copy, Check, Star, Search, X, CreditCard, Tag, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Catalogo() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGet('/catalogo').then(data => {
      setItems(Array.isArray(data) ? data : []);
      setFiltered(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = items;
    if (activeCat) {
      result = result.filter(i => i.categoria === activeCat);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i =>
        (i.producto || '').toLowerCase().includes(s) ||
        (i.modelo || '').toLowerCase().includes(s) ||
        (i.categoria || '').toLowerCase().includes(s)
      );
    }
    setFiltered(result);
  }, [search, items, activeCat]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (n: number) => Math.round(n || 0).toLocaleString('es-AR');

  const generateCaption = (item: any) => {
    return `📱 ${item.producto} ${item.modelo}\n💵 PRECIO CONTADO: USD $${fmt(item.precio_contado_usd)}\n💳 PRECIO REGULAR: USD $${fmt(item.precio_regular_usd)}\n\n✅ ${item.descripcion || 'Garantía incluida'} | Envío gratis 🚚`;
  };

  const generateWhatsApp = (item: any) => {
    return `*${item.producto} ${item.modelo}*\n\n💵 *Contado:* USD $${fmt(item.precio_contado_usd)}\n💳 *Regular:* USD $${fmt(item.precio_regular_usd)}\n\n✅ ${item.descripcion || 'Garantía incluida'}\n🚚 Envío gratis`;
  };

  const categoriaColor: Record<string, string> = {
    iPhone: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    iPad: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
    MacBook: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    'Apple Watch': 'from-pink-500/20 to-pink-500/5 border-pink-500/30',
    AirPods: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    Android: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
    Accesorio: 'from-gray-500/20 to-gray-500/5 border-gray-500/30',
  };

  const categorias = ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'AirPods', 'Android', 'Accesorio'];

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Catálogo</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
          <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 w-72 bg-[#0d0d14] border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-500 hover:text-cyan-400" /></button>}
        </div>
      </div>

      {/* Filtros de categoría */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCat(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!activeCat ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#0d0d14] text-gray-400 border border-gray-700 hover:border-cyan-500/30'}`}
        >
          Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat === activeCat ? null : cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeCat === cat ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#0d0d14] text-gray-400 border border-gray-700 hover:border-cyan-500/30'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Cargando catálogo...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Sin productos</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const grad = categoriaColor[item.categoria] || 'from-gray-500/20 to-gray-500/5 border-gray-500/30';
            return (
              <div key={item.id} className={`rounded-xl border bg-gradient-to-b ${grad} p-5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300`}
                style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)' }}>
                {item.destacado ? (
                  <div className="absolute top-3 right-3">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" style={{ filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.6))' }} />
                  </div>
                ) : null}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{item.producto}</h3>
                    <p className="text-cyan-400/60 text-sm">{item.modelo}</p>
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-4">{item.descripcion}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-black/30 border border-cyan-500/10">
                    <p className="text-[10px] text-cyan-400/50 uppercase tracking-wider">Contado</p>
                    <p className="text-lg font-bold text-emerald-400">${fmt(item.precio_contado_usd)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/30 border border-cyan-500/10">
                    <p className="text-[10px] text-cyan-400/50 uppercase tracking-wider">Regular</p>
                    <p className="text-lg font-bold text-gray-300">${fmt(item.precio_regular_usd)}</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-black/30 border border-cyan-500/10 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                    <p className="text-[10px] text-cyan-400/70 uppercase tracking-wider">Cuotas</p>
                  </div>
                  <p className="text-sm text-gray-300">Usá el <span className="text-cyan-400 font-medium cursor-pointer hover:underline" onClick={() => navigate('/cuotero')}>Cuotero</span> para calcular cuotas reales con el dólar de hoy.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => copyText(generateCaption(item), `caption-${item.id}`)}
                    className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                  >
                    {copied === `caption-${item.id}` ? <Check className="w-4 h-4 mr-1" /> : <Tag className="w-4 h-4 mr-1" />}
                    Caption
                  </Button>
                  <Button
                    onClick={() => copyText(generateWhatsApp(item), `wa-${item.id}`)}
                    className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                  >
                    {copied === `wa-${item.id}` ? <Check className="w-4 h-4 mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                    WhatsApp
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
