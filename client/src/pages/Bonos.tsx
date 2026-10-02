// ============================================================
// pages/Bonos.tsx — Bonos para vendedores (y vista de solo lectura
// para admin/oficina). Muestra:
//   - Mensaje motivacional del día (rota solo cada día).
//   - Campañas de bonos activas: QUÉ es el bono, QUÉ hay que hacer
//     para ganarlo, premio y botón "¡Cumplí!".
//   - Mis bonos (historial con estado de pago).
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { Trophy, Target, CheckCircle2, Clock3, XCircle, Sparkles } from 'lucide-react';
import { api, fmtUSD, fmtFecha } from '../lib/api';
import { useAuth } from '../lib/auth';
import { mensajeDelDia, saludoDelDia } from '../lib/motivacion';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui';

interface Campania {
  id: number;
  titulo: string;
  que_hay_que_hacer: string | null;
  premio_usd: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: number;
  mi_estado?: 'pendiente' | 'aprobado' | 'rechazado' | null;
}

interface Bono {
  id: number;
  tipo_bono: string | null;
  monto_usd: number;
  descripcion: string | null;
  fecha: string | null;
  pagado: number;
}

export default function Bonos() {
  const { user } = useAuth();
  const esCloser = user?.rol === 'closer';

  const [campanias, setCampanias] = useState<Campania[]>([]);
  const [bonos, setBonos] = useState<Bono[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [cs, bs] = await Promise.all([api.get<Campania[]>('/api/bonos/campanias'), api.get<Bono[]>('/api/bonos')]);
      setCampanias(Array.isArray(cs) ? cs : []);
      setBonos(Array.isArray(bs) ? bs : []);
    } catch {
      setCampanias([]);
      setBonos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cumplo = async (c: Campania) => {
    setMarcando(c.id);
    try {
      await api.post(`/api/bonos/campanias/${c.id}/cumplo`, {});
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setMarcando(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Bonos" subtitle="Campañas activas, tus bonos y la motivación del día" />

      {/* Saludo + mensaje motivacional del día */}
      <Card className="border-neon/40 bg-neon/5 shadow-glow">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-neon shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-bold text-neon mb-1">{saludoDelDia(user?.nombre)}</p>
            <p className="text-slate-100 font-semibold leading-relaxed">{mensajeDelDia()}</p>
          </div>
        </div>
      </Card>

      {/* Campañas activas */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-admin" /> Bonos activos — ¡ganatelos!
        </h3>
        {campanias.length === 0 ? (
          <Card>
            <EmptyState message="No hay bonos activos por ahora. ¡Pronto llegan nuevos desafíos!" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campanias.map((c) => (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold text-slate-100 leading-tight">{c.titulo}</p>
                  {c.premio_usd > 0 && <Badge color="neon">{fmtUSD(c.premio_usd)}</Badge>}
                </div>
                {c.que_hay_que_hacer && (
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <Target size={15} className="text-neon shrink-0 mt-0.5" />
                    <p>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
                        Qué hay que hacer
                      </span>
                      {c.que_hay_que_hacer}
                    </p>
                  </div>
                )}
                {(c.fecha_inicio || c.fecha_fin) && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock3 size={12} />
                    {c.fecha_inicio && c.fecha_fin
                      ? `Válido del ${fmtFecha(c.fecha_inicio)} al ${fmtFecha(c.fecha_fin)}`
                      : c.fecha_fin
                        ? `Válido hasta el ${fmtFecha(c.fecha_fin)}`
                        : `Válido desde el ${fmtFecha(c.fecha_inicio)}`}
                  </p>
                )}
                <div className="mt-auto pt-1">
                  {!esCloser ? (
                    <p className="text-xs text-slate-500">Los vendedores marcan "Cumplí" desde su usuario.</p>
                  ) : c.mi_estado === 'aprobado' ? (
                    <Badge color="success">
                      <CheckCircle2 size={12} className="mr-1" /> ¡Bono aprobado! Felicitaciones 🎉
                    </Badge>
                  ) : c.mi_estado === 'pendiente' ? (
                    <Badge color="amber">
                      <Clock3 size={12} className="mr-1" /> Marcaste "Cumplí" — esperando aprobación
                    </Badge>
                  ) : c.mi_estado === 'rechazado' ? (
                    <Badge color="red">
                      <XCircle size={12} className="mr-1" /> No aprobado — consultá con admin
                    </Badge>
                  ) : (
                    <Button onClick={() => void cumplo(c)} disabled={marcando === c.id} className="w-full">
                      {marcando === c.id ? 'Marcando…' : '¡Cumplí! 💪'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Mis bonos */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
          {esCloser ? 'Mis bonos' : 'Bonos cargados'}
        </h3>
        <Card className="p-0 overflow-hidden">
          {bonos.length === 0 ? (
            <EmptyState message="Todavía no hay bonos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-base-700/40">
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Monto</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {bonos.map((b) => (
                    <tr key={b.id} className="border-b border-slate-800/50 hover:bg-base-700/40 transition-colors">
                      <td className="py-3 px-4 text-slate-300">{b.tipo_bono || '—'}</td>
                      <td className="py-3 px-4 font-bold text-neon">{fmtUSD(b.monto_usd)}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs max-w-[260px] truncate">{b.descripcion || '—'}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{b.fecha || '—'}</td>
                      <td className="py-3 px-4">
                        {b.pagado ? <Badge color="success">Pagado</Badge> : <Badge color="amber">Pendiente</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
