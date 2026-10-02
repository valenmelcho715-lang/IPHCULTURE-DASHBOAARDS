// ============================================================
// pages/ComprobantePublico.tsx — Verificación pública (SIN auth)
//  - GET /api/comprobante/:numero con fetch directo (sin token;
//    NO usar api.get porque redirige a /login en 401)
//  - Vista receipt elegante: card blanca tipo ticket sobre fondo
//    dark, badge legal amber, botón Descargar PDF
// ============================================================
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, AlertTriangle } from 'lucide-react';
import { Badge, Spinner, Button } from '../components/ui';
import { fmtUSD, fmtFecha } from '../lib/api';
import { descargarFacturaPdf } from '../lib/facturaPdf';

interface FacturaPublica {
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

interface VentaPublica {
  metodo_pago?: string;
}

interface ApiResponse {
  factura: FacturaPublica;
  venta: VentaPublica | null;
}

export default function ComprobantePublico() {
  const { numero } = useParams<{ numero: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Fetch manual: ruta pública, sin token y sin redirect a /login
        const res = await fetch(`/api/comprobante/${encodeURIComponent(numero ?? '')}`);
        if (res.status === 404) {
          setNoEncontrado(true);
          return;
        }
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error obteniendo el comprobante');
      } finally {
        setLoading(false);
      }
    })();
  }, [numero]);

  const descargar = async () => {
    if (!data) return;
    setDescargando(true);
    const f = data.factura;
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
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-900 flex flex-col items-center justify-center p-4">
      {loading ? (
        <Spinner />
      ) : noEncontrado ? (
        <div className="glass p-8 max-w-md w-full text-center">
          <AlertTriangle size={32} className="mx-auto text-admin mb-3" />
          <h1 className="text-lg font-bold text-slate-100">Comprobante no encontrado</h1>
          <p className="text-sm text-slate-400 mt-2">
            No existe ningún comprobante con el número <span className="font-mono text-neon">{numero}</span>.
          </p>
        </div>
      ) : error ? (
        <div className="glass p-8 max-w-md w-full text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400 mb-3" />
          <h1 className="text-lg font-bold text-slate-100">Error</h1>
          <p className="text-sm text-slate-400 mt-2">{error}</p>
        </div>
      ) : data ? (
        <div className="w-full max-w-sm">
          {/* Ticket blanco */}
          <div className="bg-white text-slate-900 rounded-2xl shadow-glow-lg overflow-hidden">
            <div className="px-6 pt-7 pb-5 text-center border-b border-dashed border-slate-300">
              <h1 className="text-xl font-extrabold tracking-tight">iPhone Culture</h1>
              <p className="text-xs text-slate-500 mt-0.5">Neuquén, Argentina</p>
              <div className="mt-3 flex justify-center">
                <Badge color="amber">Comprobante X — Sin validez fiscal</Badge>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-baseline justify-between border-b border-dashed border-slate-300 pb-3">
                <span className="font-mono font-bold">{data.factura.numero}</span>
                <span className="font-mono text-xs text-slate-500">{fmtFecha(data.factura.fecha)}</span>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Cliente</p>
                <p className="font-bold mt-0.5">{data.factura.cliente_nombre || '—'}</p>
                {data.factura.cliente_dni && <p className="text-xs text-slate-500">DNI: {data.factura.cliente_dni}</p>}
                {data.factura.closer_nombre && (
                  <p className="text-xs text-slate-500">Vendedor: {data.factura.closer_nombre}</p>
                )}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3">
                <div className="flex justify-between gap-3">
                  <span className="text-sm">{data.factura.producto ?? 'Producto'}</span>
                  <span className="text-sm font-bold whitespace-nowrap">{fmtUSD(data.factura.precio_usd)}</span>
                </div>
                {!!data.factura.es_canje && (
                  <p className="text-xs font-bold text-violet-600 mt-1">OPERACIÓN CON CANJE</p>
                )}
                {data.venta?.metodo_pago && (
                  <p className="text-xs text-slate-500 mt-1">Método de pago: {data.venta.metodo_pago}</p>
                )}
              </div>

              {(Number(data.factura.monto_senado) > 0 || Number(data.factura.falta_pagar) > 0) && (
                <div className="text-sm space-y-1 border-t border-dashed border-slate-300 pt-3">
                  {Number(data.factura.monto_senado) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Seña entregada</span>
                      <span>{fmtUSD(data.factura.monto_senado)}</span>
                    </div>
                  )}
                  {Number(data.factura.falta_pagar) > 0 && (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <span>Falta pagar</span>
                      <span>{fmtUSD(data.factura.falta_pagar)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-baseline border-t border-dashed border-slate-300 pt-3">
                <span className="text-sm font-bold">TOTAL</span>
                <span className="text-xl font-extrabold">{fmtUSD(data.factura.precio_usd)}</span>
              </div>

              <p className="text-[10px] leading-relaxed text-slate-400 text-center border-t border-dashed border-slate-300 pt-3">
                Este documento es un comprobante de operación (Factura X). No tiene validez fiscal.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <Button onClick={() => void descargar()} disabled={descargando}>
              <Download size={15} className="inline -mt-0.5 mr-1" />
              {descargando ? 'Generando…' : 'Descargar PDF'}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-600 mt-3">
            iphoneculture · verificación de comprobante
          </p>
        </div>
      ) : null}
    </div>
  );
}
