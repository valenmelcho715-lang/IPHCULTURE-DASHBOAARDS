// ============================================================
// pages/Facturas.tsx — Comprobantes X (Frontend_Ventas_Facturas)
//  - Tabla de comprobantes emitidos (closer solo los suyos)
//  - Acciones: Ver (pública, nueva pestaña) y PDF (jsPDF)
// ============================================================
import { useEffect, useState } from 'react';
import { Eye, Download } from 'lucide-react';
import { api, fmtUSD, fmtFecha } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, cn } from '../components/ui';
import { descargarFacturaPdf } from '../lib/facturaPdf';

interface Factura {
  id: number;
  venta_id: number;
  closer_id: number;
  numero: string;
  cliente_nombre: string | null;
  cliente_dni: string | null;
  producto: string | null;
  precio_usd: number;
  monto_senado: number;
  falta_pagar: number;
  es_canje: number;
  fecha: string;
  estado: string;
  closer_nombre?: string;
}

function estadoBadgeColor(estado: string): 'success' | 'amber' | 'red' | 'slate' {
  const e = (estado || '').toLowerCase();
  if (e === 'emitida') return 'success';
  if (e === 'anulada' || e === 'cancelada') return 'red';
  if (e) return 'amber';
  return 'slate';
}

export default function Facturas() {
  const { user } = useAuth();
  const esCloser = user?.rol === 'closer';

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Factura[]>('/api/facturas');
        setFacturas(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando comprobantes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ver = (f: Factura) => window.open(`/comprobante/${f.numero}`, '_blank');

  const descargar = async (f: Factura) => {
    setDescargando(f.id);
    try {
      await descargarFacturaPdf({
        numero: f.numero,
        fecha: f.fecha,
        cliente_nombre: f.cliente_nombre ?? '—',
        cliente_dni: f.cliente_dni ?? undefined,
        producto: f.producto ?? 'Producto',
        precio_usd: Number(f.precio_usd || 0),
        monto_senado: Number(f.monto_senado || 0),
        falta_pagar: Number(f.falta_pagar || 0),
        es_canje: f.es_canje,
        closer_nombre: f.closer_nombre,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error generando el PDF');
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Comprobantes X"
        subtitle={esCloser ? 'Comprobantes emitidos de tus ventas — sin validez fiscal' : 'Todos los comprobantes emitidos — sin validez fiscal'}
      />

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : error ? (
          <EmptyState message={error} />
        ) : facturas.length === 0 ? (
          <EmptyState message="Todavía no hay comprobantes emitidos" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40">
                  <th className="px-5 py-3">Número</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3">Precio</th>
                  <th className="px-5 py-3">Falta</th>
                  <th className="px-5 py-3">Estado</th>
                  {!esCloser && <th className="px-5 py-3">Closer</th>}
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-b border-slate-800/40 hover:bg-base-700/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-neon whitespace-nowrap">{f.numero}</td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{fmtFecha(f.fecha)}</td>
                    <td className="px-5 py-3 text-slate-200">
                      {f.cliente_nombre || '—'}
                      {f.cliente_dni && <span className="block text-xs text-slate-500">DNI {f.cliente_dni}</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {f.producto ?? '—'}
                      {!!f.es_canje && (
                        <span className="ml-2">
                          <Badge color="violet">Canje</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-bold text-neon whitespace-nowrap">{fmtUSD(f.precio_usd)}</td>
                    <td
                      className={cn(
                        'px-5 py-3 font-semibold whitespace-nowrap',
                        Number(f.falta_pagar) > 0 ? 'text-red-400' : 'text-slate-500'
                      )}
                    >
                      {fmtUSD(f.falta_pagar)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={estadoBadgeColor(f.estado)}>{f.estado}</Badge>
                    </td>
                    {!esCloser && <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{f.closer_nombre ?? '—'}</td>}
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" className="!px-2.5 !py-1.5" title="Ver comprobante" onClick={() => ver(f)}>
                          <Eye size={15} />
                          <span className="hidden sm:inline ml-1">Ver</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2.5 !py-1.5"
                          title="Descargar PDF"
                          disabled={descargando === f.id}
                          onClick={() => void descargar(f)}
                        >
                          <Download size={15} />
                          <span className="hidden sm:inline ml-1">{descargando === f.id ? 'Generando…' : 'PDF'}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
