import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Copy, Check, Calculator, DollarSign, ArrowRightLeft, Receipt, Wallet, Percent } from 'lucide-react';

interface FeePlan {
  plan: string;
  cuotas: number;
  fee_cobro_pct: number;
  fee_cuotas_pct: number;
  iibb_pct: number;
  posnet_pct: number;
}

interface CuotaResult {
  precio_usd: number;
  tipo_cambio: number;
  plan: string;
  cuotas: number;
  ars_neto_deseado: number;
  factor_neto: number;
  total_cobrar_ars: number;
  valor_cuota_ars: number;
  neto_final_ars: number;
  neto_final_usd: number;
  fees: {
    fee_cobro_pct: number;
    fee_cuotas_pct: number;
    iibb_pct: number;
    posnet_pct: number;
  };
}

export default function Cuotero() {
  const [fees, setFees] = useState<FeePlan[]>([]);
  const [precioUsd, setPrecioUsd] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [planSeleccionado, setPlanSeleccionado] = useState('');
  const [resultado, setResultado] = useState<CuotaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiGet('/cuotero/fees').then(data => {
      setFees(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setPlanSeleccionado(data[0].plan);
      }
    });
  }, []);

  const calcular = async () => {
    if (!precioUsd || !tipoCambio || !planSeleccionado) return;
    setLoading(true);
    try {
      const res = await apiPost('/cuotero/calcular', {
        precio_usd: parseFloat(precioUsd),
        tipo_cambio: parseFloat(tipoCambio),
        plan: planSeleccionado
      });
      setResultado(res);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateWhatsApp = (r: CuotaResult) => {
    return `💳 *Cotización en Cuotas*

📱 Precio: USD $${r.precio_usd}
💵 Dólar: $${r.tipo_cambio}
📆 Plan: ${r.plan} (${r.cuotas} cuota${r.cuotas > 1 ? 's' : ''})

💰 *Total a cobrar:* $${r.total_cobrar_ars.toLocaleString('es-AR')}
💵 *Valor de cada cuota:* $${r.valor_cuota_ars.toLocaleString('es-AR')}

✅ Neto final: USD $${r.neto_final_usd}`;
  };

  const fmtARS = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 15px rgba(0,240,255,0.3)' }}>Cuotero</h1>
          <p className="text-cyan-400/50 text-sm">Calculá cuotas con fees reales del POSNET</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="space-y-5">
          <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-transparent p-5">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-cyan-400/70 mb-1.5 block flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Precio en USD
                </label>
                <Input
                  type="number"
                  placeholder="Ej: 1000"
                  value={precioUsd}
                  onChange={e => setPrecioUsd(e.target.value)}
                  className="bg-[#0d0d14] border-cyan-500/20 text-white placeholder:text-gray-600 focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-cyan-400/70 mb-1.5 block flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Tipo de Cambio
                </label>
                <Input
                  type="number"
                  placeholder="Ej: 1650"
                  value={tipoCambio}
                  onChange={e => setTipoCambio(e.target.value)}
                  className="bg-[#0d0d14] border-cyan-500/20 text-white placeholder:text-gray-600 focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-cyan-400/70 mb-1.5 block flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Plan de Cuotas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {fees.map(f => (
                    <button
                      key={f.plan}
                      onClick={() => setPlanSeleccionado(f.plan)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        planSeleccionado === f.plan
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                          : 'bg-[#0d0d14] text-gray-400 border border-gray-700 hover:border-cyan-500/30'
                      }`}
                    >
                      <span className="block text-lg font-bold">{f.cuotas}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-60">cuota{f.cuotas > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={calcular}
                disabled={loading || !precioUsd || !tipoCambio}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              >
                {loading ? 'Calculando...' : <><Calculator className="w-4 h-4 mr-2" /> Calcular</>}
              </Button>
            </div>
          </div>

          {/* Tabla de fees */}
          <div className="rounded-xl border border-gray-700/50 bg-[#0d0d14] p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Percent className="w-4 h-4" /> Fees por plan
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left py-2">Plan</th>
                    <th className="text-right py-2">Cobro</th>
                    <th className="text-right py-2">Cuotas</th>
                    <th className="text-right py-2">IIBB</th>
                    <th className="text-right py-2">Posnet</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map(f => (
                    <tr key={f.plan} className={`border-b border-gray-800/50 ${planSeleccionado === f.plan ? 'text-cyan-400' : 'text-gray-400'}`}>
                      <td className="py-1.5">{f.plan}</td>
                      <td className="text-right">{f.fee_cobro_pct}%</td>
                      <td className="text-right">{f.fee_cuotas_pct}%</td>
                      <td className="text-right">{f.iibb_pct}%</td>
                      <td className="text-right">{f.posnet_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div>
          {resultado ? (
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  <Receipt className="w-5 h-5" /> Resultado
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(generateWhatsApp(resultado))}
                    className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Copiar para WhatsApp"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-black/30 border border-emerald-500/10">
                  <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider">Precio base ARS</p>
                  <p className="text-xl font-bold text-white">{fmtARS(resultado.ars_neto_deseado)}</p>
                </div>
                <div className="p-4 rounded-lg bg-black/30 border border-emerald-500/10">
                  <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider">Factor Neto</p>
                  <p className="text-xl font-bold text-white">{resultado.factor_neto.toFixed(4)}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider mb-1">Total a cobrar al cliente</p>
                <p className="text-3xl font-bold text-emerald-400">{fmtARS(resultado.total_cobrar_ars)}</p>
                <p className="text-sm text-gray-400 mt-1">Incluye margen del 2%</p>
              </div>

              <div className="p-4 rounded-lg bg-black/30 border border-cyan-500/10">
                <p className="text-[10px] text-cyan-400/50 uppercase tracking-wider mb-1">Valor de cada cuota</p>
                <p className="text-2xl font-bold text-cyan-400">{fmtARS(resultado.valor_cuota_ars)}</p>
                <p className="text-sm text-gray-400">{resultado.cuotas} cuota{resultado.cuotas > 1 ? 's' : ''} de {fmtARS(resultado.valor_cuota_ars)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-black/30 border border-emerald-500/10">
                  <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider">Neto Final ARS</p>
                  <p className="text-lg font-bold text-emerald-300">{fmtARS(resultado.neto_final_ars)}</p>
                </div>
                <div className="p-3 rounded-lg bg-black/30 border border-emerald-500/10">
                  <p className="text-[10px] text-emerald-400/50 uppercase tracking-wider">Neto Final USD</p>
                  <p className="text-lg font-bold text-emerald-300">{fmtUSD(resultado.neto_final_usd)}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-emerald-500/10 space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between"><span>Fee Cobro</span><span>{resultado.fees.fee_cobro_pct}%</span></div>
                <div className="flex justify-between"><span>Fee Cuotas</span><span>{resultado.fees.fee_cuotas_pct}%</span></div>
                <div className="flex justify-between"><span>Ingresos Brutos</span><span>{resultado.fees.iibb_pct}%</span></div>
                <div className="flex justify-between"><span>Posnet</span><span>{resultado.fees.posnet_pct}%</span></div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-700/50 bg-[#0d0d14] p-10 text-center text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-lg">Ingresá el precio, el dólar y seleccioná un plan</p>
              <p className="text-sm mt-2">El cálculo se hará con los fees reales del POSNET</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
