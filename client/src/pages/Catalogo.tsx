// ============================================================
// pages/Catalogo.tsx — VITRINA PREMIUM tipo Apple Store dark
// Tabs de categorías + búsqueda, grid de cards glass con glow.
// Orden tal cual llega del API.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { api, fmtUSD } from '../lib/api';
import { Card, Input, Badge, PageHeader, Spinner, EmptyState, cn } from '../components/ui';

interface Producto {
  id: number;
  producto: string;
  modelo: string;
  descripcion?: string | null;
  precio_contado_usd?: number | null;
  precio_regular_usd?: number | null;
  precio_promo_contado_usd?: number | null; // defensivo: si el backend lo expone
  categoria?: string | null;
  imagen_url?: string | null;
  destacado?: number | null;
}

const CATEGORIAS = ['Todas', 'iPhone', 'iPad', 'MacBook', 'Apple Watch', 'AirPods', 'Accesorio', 'Varios'];

export default function Catalogo() {
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api
      .get<Producto[]>('/api/catalogo')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((p) => {
      if (cat !== 'Todas' && (p.categoria ?? 'Varios') !== cat) return false;
      if (!q) return true;
      return [p.producto, p.modelo, p.descripcion ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, cat, busqueda]);

  return (
    <div className="space-y-6">
      <PageHeader title="Catálogo" subtitle="Precios vigentes — iPhone Culture Neuquén" />

      {/* Tabs de categorías + búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                cat === c
                  ? 'bg-neon/15 text-neon border-neon/50 shadow-glow'
                  : 'bg-base-700 text-slate-400 border-slate-600/30 hover:text-neon hover:border-neon/40'
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            className="pl-8"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card>
          <EmptyState message={`No se pudo cargar el catálogo: ${error}`} />
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState message="No hay productos que coincidan con la búsqueda." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((p) => {
            // La promo contado ES el precio más barato (viene del backend = precio_contado_usd)
            const promo = p.precio_promo_contado_usd ?? p.precio_contado_usd;
            return (
              <div
                key={p.id}
                className="glass p-5 flex flex-col gap-3 transition-all hover:border-neon/50 hover:shadow-glow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color="neon">{p.categoria ?? 'Varios'}</Badge>
                  {p.destacado ? (
                    <Badge color="amber">
                      <span className="inline-flex items-center gap-1">
                        <Star size={11} /> Destacado
                      </span>
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <p className="font-bold text-slate-100 leading-snug">{p.modelo || p.producto}</p>
                  {p.modelo && p.producto && p.modelo !== p.producto && (
                    <p className="text-xs text-slate-500 mt-0.5">{p.producto}</p>
                  )}
                </div>
                {p.descripcion && <p className="text-xs text-slate-400 line-clamp-2">{p.descripcion}</p>}
                <div className="mt-auto pt-2 border-t border-slate-700/40">
                  {/* Jerarquía clara: precio grande = promo contado (el más barato); tachado = lista */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-2xl font-extrabold text-neon glow-text">{fmtUSD(promo)}</p>
                    {p.precio_regular_usd != null && p.precio_regular_usd > 0 && promo != null && p.precio_regular_usd > promo && (
                      <span className="text-xs text-slate-500">
                        <span className="line-through">{fmtUSD(p.precio_regular_usd)}</span>{' '}
                        <span className="text-[10px] uppercase tracking-wider text-slate-600">lista</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-neon/80 mt-0.5 font-semibold">Promo contado</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
