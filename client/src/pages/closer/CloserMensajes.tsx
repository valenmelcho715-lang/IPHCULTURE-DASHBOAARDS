import { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { Mail, Check, Bell } from 'lucide-react';

export default function CloserMensajes() {
  const [mensajes, setMensajes] = useState<any[]>([]);

  useEffect(() => {
    loadMensajes();
  }, []);

  const loadMensajes = async () => {
    const data = await apiGet('/mensajes');
    setMensajes(Array.isArray(data) ? data : []);
  };

  const marcarLeido = async (id: number) => {
    await apiPut(`/mensajes/${id}/leido`, {});
    loadMensajes();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Mensajes</h1>
      <div className="space-y-3">
        {mensajes.length === 0 ? (
          <p className="text-gray-500 text-center py-12">Sin mensajes</p>
        ) : (
          mensajes.map(m => (
            <div key={m.id} className={`p-4 rounded-xl border ${m.leido ? 'border-cyan-500/5 bg-[#0d0d14]/30' : 'border-cyan-500/20 bg-cyan-500/5'} transition-colors`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${m.leido ? 'bg-gray-600' : 'bg-cyan-400 animate-pulse'}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{m.titulo}</h3>
                    <p className="text-sm text-gray-400 mt-1">{m.contenido}</p>
                    <p className="text-xs text-gray-600 mt-2">{new Date(m.created_at).toLocaleString('es-AR')}</p>
                  </div>
                </div>
                {!m.leido && (
                  <button onClick={() => marcarLeido(m.id)} className="shrink-0 p-2 rounded-lg hover:bg-cyan-500/10 text-cyan-400 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
