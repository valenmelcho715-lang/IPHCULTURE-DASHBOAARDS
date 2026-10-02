import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { Users, ShoppingCart, Award, DollarSign } from 'lucide-react';

export default function AdminClosers() {
  const [closers, setClosers] = useState<any[]>([]);
  const [metricas, setMetricas] = useState<Record<number, any>>({});

  useEffect(() => {
    loadClosers();
  }, []);

  const loadClosers = async () => {
    const data = await apiGet('/closers');
    setClosers(Array.isArray(data) ? data : []);
    // Cargar metricas de cada closer
    for (const c of (Array.isArray(data) ? data : [])) {
      const m = await apiGet(`/metricas?closer_id=${c.id}`);
      setMetricas(prev => ({ ...prev, [c.id]: m }));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Vendedores</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {closers.map(c => {
          const m = metricas[c.id];
          return (
            <div key={c.id} className="rounded-xl border border-cyan-500/10 bg-[#0d0d14]/50 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-400">{c.nombre.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{c.nombre}</h3>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded-lg bg-black/20 text-center">
                  <p className="text-xs text-gray-500">Ventas Mes</p>
                  <p className="text-lg font-bold text-emerald-400">{m?.mes?.c || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-black/20 text-center">
                  <p className="text-xs text-gray-500">Total Mes</p>
                  <p className="text-lg font-bold text-cyan-400">${(m?.mes?.total || 0).toLocaleString()}</p>
                </div>
                <div className="p-2 rounded-lg bg-black/20 text-center">
                  <p className="text-xs text-gray-500">Comisión</p>
                  <p className="text-lg font-bold text-fuchsia-400">${(m?.mes?.comision || 0).toFixed(2)}</p>
                </div>
                <div className="p-2 rounded-lg bg-black/20 text-center">
                  <p className="text-xs text-gray-500">Leads</p>
                  <p className="text-lg font-bold text-blue-400">{m?.leads?.c || 0}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
