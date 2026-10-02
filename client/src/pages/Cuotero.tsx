// ============================================================
// pages/Cuotero.tsx — CALCULADORA ESTRELLA DE CUOTAS
// Fórmula exacta de la SPEC sección 7. Hero neon con la cuota,
// desglose de fees y tabla comparativa de todos los planes.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Calculator, Copy, Check, Sparkles } from 'lucide-react';
import { api, fmtARS, fmtUSD } from '../lib/api';
import { Card, Button, Input, Select, Label, Badge, PageHeader, Spinner, EmptyState, cn } from '../components/ui';

interface Fee {
  id: number;
  plan: string;
  cuotas: number;
  fee_cobro_pct: number;
  fee_cuotas_pct: number;
  iibb_pct: number;
  posnet_pct: number;
}

interface CalcResult {
  plan: string;
  cuotas: number;
  precio_ars: number;
  total_add: number;
  factor_neto: number;
  total_cobrar_ars: number;
  valor_cuota_ars: number;
  neto_final_ars: number;
  neto_final_usd: number;
  fee_cobro_pct: number;
  iibb_pct: number;
  fee_cuotas_pct: number;
  posnet_pct: number;
}

// Replica EXACTA de la fórmula oficial (fallback local y tabla comparativa):
// factor con posnet en cascada, colchón ×1.02 y redondeo a 2 decimales.
const round2 = (x: number): number => Math.round(x * 100) / 100;

function calcLocal(fee: Fee, precioUsd: number, tipoCambio: number): CalcResult {
  const precio_ars = precioUsd * tipoCambio;
  const total_add = Number(fee.fee_cobro_pct) + Number(fee.iibb_pct) + Number(fee.fee_cuotas_pct);
  const factor_neto = (1 - total_add / 100) * (1 - Number(fee.posnet_pct ?? 0) / 100);
  const total_cobrar_ars = round2((precio_ars / factor_neto) * 1.02);
  const valor_cuota_ars = round2(total_cobrar_ars / fee.cuotas);
  const neto_final_ars = round2(total_cobrar_ars * factor_neto);
  const neto_final_usd = round2(neto_final_ars / tipoCambio);
  return {
    plan: fee.plan,
    cuotas: fee.cuotas,
    precio_ars,
    total_add,
    factor_neto,
    total_cobrar_ars,
    valor_cuota_ars,
    neto_final_ars,
    neto_final_usd,
    fee_cobro_pct: Number(fee.fee_cobro_pct),
    iibb_pct: Number(fee.iibb_pct),
    fee_cuotas_pct: Number(fee.fee_cuotas_pct),
    posnet_pct: Number(fee.posnet_pct ?? 0),
  };
}

export default function Cuotero() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [loadingFees, setLoadingFees] = useState(true);
  const [precioUsd, setPrecioUsd] = useState<string>('');
  const [tipoCambio, setTipoCambio] = useState<string>('1680');
  useEffect(()=>{void api.get<any>('/api/atencion/status').then(x=>setTipoCambio(String(x.settings.usdArs))).catch(()=>{});},[]);
  const [plan, setPlan] = useState<string>('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api
      .get<Fee[]>('/api/cuotero/fees')
      .then((data) => {
        const lista = Array.isArray(data) ? data : [];
        setFees(lista);
        if (lista.length > 0) setPlan(lista[lista.length - 1].plan);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingFees(false));
  }, []);

  const feeSel = useMemo(() => fees.find((f) => f.plan === plan) ?? null, [fees, plan]);
  const precioNum = Number(precioUsd) || 0;
  const tcNum = Number(tipoCambio) || 0;

  // Tabla comparativa de TODOS los planes, calculada en cliente con la fórmula de la SPEC
  const tabla = useMemo<CalcResult[]>(() => {
    if (precioNum <= 0 || tcNum <= 0) return [];
    return fees.map((f) => calcLocal(f, precioNum, tcNum));
  }, [fees, precioNum, tcNum]);

  const calcular = async () => {
    if (!feeSel || precioNum <= 0 || tcNum <= 0) return;
    setCalculando(true);
    setError(null);
    const local = calcLocal(feeSel, precioNum, tcNum);
    try {
      const server = await api.post<Partial<CalcResult>>('/api/cuotero/calcular', {
        precio_usd: precioNum,
        tipo_cambio: tcNum,
        plan: feeSel.plan,
      });
      // Merge defensivo: solo pisa campos que el server efectivamente devuelva
      const merged: CalcResult = { ...local };
      (Object.keys(local) as Array<keyof CalcResult>).forEach((k) => {
        const v = server?.[k];
        if (v !== undefined && v !== null && !Number.isNaN(v)) {
          (merged as unknown as Record<string, unknown>)[k] = v;
        }
      });
      setResult(merged);
    } catch {
      // Fallback local si el endpoint aún no responde
      setResult(local);
    } finally {
      setCalculando(false);
    }
  };

  const copiarTexto = async () => {
    if (!result) return;
    const texto = [
      `📱 iPhone Culture — Neuquén`,
      ``,
      `Producto: ${fmtUSD(precioNum)}`,
      `Plan elegido: ${result.cuotas} cuota${result.cuotas > 1 ? 's' : ''} de ${fmtARS(result.valor_cuota_ars)}`,
      `Total a cobrar: ${fmtARS(result.total_cobrar_ars)}`,
      `(Tipo de cambio: $${tcNum.toLocaleString('es-AR')})`,
      ``,
      `¡Consultanos por stock y colores disponibles! 🚀`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copiá el texto manualmente:', texto);
    }
  };

  if (loadingFees) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuotero"
        subtitle="Calculadora de planes en cuotas — fórmula oficial iPhone Culture"
      />

      {error && fees.length === 0 && (
        <Card>
          <EmptyState message={`No se pudieron cargar los planes: ${error}`} />
        </Card>
      )}

      {/* ---- Inputs ---- */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Precio (USD)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Ej: 900"
              value={precioUsd}
              onChange={(e) => setPrecioUsd(e.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de cambio</Label>
            <Input
              type="number"
              min={0}
              value={tipoCambio}
              onChange={(e) => setTipoCambio(e.target.value)}
            />
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {fees.map((f) => (
                <option key={f.id} value={f.plan}>
                  {f.plan}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <button
              onClick={calcular}
              disabled={calculando || !feeSel || precioNum <= 0 || tcNum <= 0}
              className="w-full px-4 py-2 rounded-xl text-sm font-bold bg-neon-grad text-base-900 hover:brightness-110 hover:shadow-glow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2">
                <Calculator size={16} /> {calculando ? 'Calculando…' : 'Calcular'}
              </span>
            </button>
          </div>
        </div>
      </Card>

      {/* ---- Resultado hero ---- */}
      {result && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-neon-grad" />
          <div className="text-center py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
              {result.plan} · {fmtUSD(precioNum)} al dólar $ {tcNum.toLocaleString('es-AR')}
            </p>
            <p className="text-4xl md:text-6xl font-extrabold text-neon glow-text leading-tight">
              {result.cuotas} cuota{result.cuotas > 1 ? 's' : ''} de {fmtARS(result.valor_cuota_ars)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="glass p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Total a cobrar</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{fmtARS(result.total_cobrar_ars)}</p>
            </div>
            <div className="glass p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Neto final</p>
              <p className="text-xl font-bold text-success mt-1">{fmtARS(result.neto_final_ars)}</p>
            </div>
            <div className="glass p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-slate-400">Neto final USD</p>
              <p className="text-xl font-bold text-success mt-1">{fmtUSD(result.neto_final_usd)}</p>
            </div>
          </div>

          {/* Desglose de fees */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <Badge color="neon">Fee cobro {result.fee_cobro_pct}%</Badge>
            <span className="text-slate-500">+</span>
            <Badge color="amber">IIBB {result.iibb_pct}%</Badge>
            <span className="text-slate-500">+</span>
            <Badge color="violet">Fee cuotas {result.fee_cuotas_pct}%</Badge>
            <span className="text-slate-500">=</span>
            <Badge color="red">Total {result.total_add}%</Badge>
            <span className="text-slate-600 mx-1">·</span>
            <Badge color="slate">Factor neto {result.factor_neto.toFixed(4)}</Badge>
            {result.posnet_pct > 0 && <Badge color="slate">Posnet {result.posnet_pct}%</Badge>}
          </div>

          <div className="mt-6 flex justify-center">
            <Button variant={copiado ? 'success' : 'ghost'} onClick={copiarTexto}>
              <span className="inline-flex items-center gap-2">
                {copiado ? <Check size={16} /> : <Copy size={16} />}
                {copiado ? '¡Copiado!' : 'Copiar texto para cliente'}
              </span>
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Tabla comparativa de planes ---- */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-neon" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Comparativa de todos los planes
          </h2>
        </div>
        {tabla.length === 0 ? (
          <EmptyState message="Ingresá un precio en USD para comparar todos los planes." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/40">
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Cuotas</th>
                  <th className="py-2 pr-4">Valor cuota</th>
                  <th className="py-2 pr-4">Total a cobrar</th>
                  <th className="py-2">Neto USD</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map((r) => {
                  const activa = r.plan === plan && result?.plan === r.plan;
                  return (
                    <tr
                      key={r.plan}
                      onClick={() => setPlan(r.plan)}
                      className={cn(
                        'border-b border-slate-800/50 cursor-pointer transition-colors',
                        activa ? 'bg-neon/10 text-neon' : 'text-slate-300 hover:bg-base-700/60'
                      )}
                    >
                      <td className="py-2.5 pr-4 font-semibold">{r.plan}</td>
                      <td className="py-2.5 pr-4">{r.cuotas}</td>
                      <td className={cn('py-2.5 pr-4 font-bold', activa && 'glow-text')}>{fmtARS(r.valor_cuota_ars)}</td>
                      <td className="py-2.5 pr-4">{fmtARS(r.total_cobrar_ars)}</td>
                      <td className="py-2.5 text-success">{fmtUSD(r.neto_final_usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
