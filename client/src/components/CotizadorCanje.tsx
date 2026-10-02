// ============================================================
// components/CotizadorCanje.tsx — COTIZADOR DE CANJE
// Valuación automática según plan oficial (lib/planCanje.ts).
// 4 picks: Marca → Modelo → Almacenamiento → Estado
// (+ % batería solo iPhone). Resultado hero estilo Cuotero.
// ============================================================
import { useMemo, useState } from 'react';
import { Calculator, Copy, Check, Repeat, ShieldAlert, Ban, AlertTriangle } from 'lucide-react';
import { fmtUSD } from '../lib/api';
import { Card, Button, Input, Select, Label, Badge, cn } from './ui';
import {
  MARCAS,
  MODELOS_POR_MARCA,
  OTRO_MODELO,
  STORAGE_IPHONE,
  STORAGE_ANDROID,
  ESTADOS_IPHONE,
  ESTADOS_ANDROID,
  ESTADO_NO_COTIZA,
  calcularCanjeiPhone,
  calcularCanjeAndroid,
  type Marca,
  type ResultadoCanje,
} from '../lib/planCanje';

interface Props {
  /** Abre el modal "Nuevo canje" con producto_entregado precargado. */
  onUsarEnCanje: (descripcion: string) => void;
}

export default function CotizadorCanje({ onUsarEnCanje }: Props) {
  const [marca, setMarca] = useState<Marca | ''>('');
  const [modelo, setModelo] = useState('');
  const [storage, setStorage] = useState('');
  const [estado, setEstado] = useState('');
  const [bateria, setBateria] = useState(''); // solo iPhone, opcional
  const [copiado, setCopiado] = useState(false);

  const esIphone = marca === 'iPhone';
  const storageOpciones = esIphone ? STORAGE_IPHONE : STORAGE_ANDROID;
  const estadoOpciones = esIphone ? ESTADOS_IPHONE : ESTADOS_ANDROID;

  const cambiarMarca = (m: Marca | '') => {
    setMarca(m);
    setModelo('');
    setStorage('');
    setEstado('');
    setBateria('');
    setCopiado(false);
  };

  const bateriaNum = useMemo(() => {
    const n = parseInt(bateria, 10);
    return bateria.trim() === '' || Number.isNaN(n) ? null : Math.min(100, Math.max(1, n));
  }, [bateria]);

  const completo = marca !== '' && modelo !== '' && storage !== '' && estado !== '';
  const esOtroModelo = modelo === OTRO_MODELO;

  const resultado: ResultadoCanje | null = useMemo(() => {
    if (marca === '' || modelo === '') return null;
    // Modelo no listado: el cálculo devuelve estado "manual" sin importar el resto
    if (esOtroModelo) {
      return esIphone
        ? calcularCanjeiPhone({ modelo, storage: 'Base', bateriaPct: null, estado: 'Excelente' })
        : calcularCanjeAndroid({ marca: marca as Exclude<Marca, 'iPhone'>, modelo, storage: 'Base', estado: 'Excelente' });
    }
    if (!completo) return null;
    if (esIphone) {
      return calcularCanjeiPhone({
        modelo,
        storage: storage as (typeof STORAGE_IPHONE)[number],
        bateriaPct: bateriaNum,
        estado: estado as (typeof ESTADOS_IPHONE)[number],
      });
    }
    return calcularCanjeAndroid({
      marca: marca as Exclude<Marca, 'iPhone'>,
      modelo,
      storage: storage as (typeof STORAGE_ANDROID)[number],
      estado: estado as (typeof ESTADOS_ANDROID)[number],
    });
  }, [marca, modelo, storage, estado, bateriaNum, completo, esIphone, esOtroModelo]);

  // Descripción client-ready del equipo cotizado
  const descripcion = useMemo(() => {
    if (marca === '' || modelo === '' || esOtroModelo) return '';
    const storageTxt = storage === 'Base' ? 'base' : storage.replace(' ', '');
    const partes = [`${modelo} ${storageTxt}`];
    if (esIphone) partes.push(bateriaNum != null ? `batería ${bateriaNum}%` : 'batería sin dato');
    if (estado) partes.push(estado.toLowerCase());
    return partes.join(' — ');
  }, [marca, modelo, storage, estado, bateriaNum, esIphone, esOtroModelo]);

  const textoCliente =
    resultado?.valorFinal != null ? `Canje ${descripcion} → ${fmtUSD(resultado.valorFinal)}` : '';

  const copiar = async () => {
    if (!textoCliente) return;
    try {
      await navigator.clipboard.writeText(textoCliente);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copiá el texto manualmente:', textoCliente);
    }
  };

  const usarEnCanje = () => {
    if (resultado?.valorFinal == null) return;
    onUsarEnCanje(`${descripcion} (canje cotizado ${fmtUSD(resultado.valorFinal)})`);
  };

  const d = resultado?.desglose;

  return (
    <Card className="relative overflow-hidden mb-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-neon-grad" />

      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={18} className="text-neon" />
        <h2 className="text-lg font-bold text-slate-100">Cotizador de canje</h2>
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Valuación automática según plan oficial de canjes — 4 picks y listo.
      </p>

      {/* ---- 4 pasos ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label>1 · Marca</Label>
          <Select value={marca} onChange={(e) => cambiarMarca(e.target.value as Marca | '')}>
            <option value="">Elegir marca…</option>
            {MARCAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>2 · Modelo</Label>
          <Select value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={marca === ''}>
            <option value="">{marca === '' ? 'Primero la marca…' : 'Elegir modelo…'}</option>
            {marca !== '' &&
              MODELOS_POR_MARCA[marca].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            <option value={OTRO_MODELO}>{OTRO_MODELO}</option>
          </Select>
        </div>
        <div>
          <Label>3 · Almacenamiento</Label>
          <Select
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            disabled={modelo === '' || esOtroModelo}
          >
            <option value="">Elegir…</option>
            {marca !== '' &&
              storageOpciones.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <Label>4 · Estado</Label>
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            disabled={modelo === '' || esOtroModelo}
          >
            <option value="">Elegir…</option>
            {marca !== '' &&
              estadoOpciones.map((e2) => (
                <option key={e2} value={e2}>
                  {e2}
                </option>
              ))}
          </Select>
        </div>
      </div>

      {/* Batería: solo iPhone */}
      {esIphone && modelo !== '' && !esOtroModelo && (
        <div className="mt-4 max-w-xs">
          <Label>% de batería (opcional)</Label>
          <Input
            type="number"
            min={1}
            max={100}
            placeholder="Ej: 86"
            value={bateria}
            onChange={(e) => setBateria(e.target.value)}
          />
          {bateria.trim() === '' && (
            <p className="text-xs text-admin mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              Sin dato de batería se aplica la penalización máxima (−$100).
            </p>
          )}
        </div>
      )}

      {/* ---- Resultado ---- */}
      {resultado && (
        <div className="mt-6 border-t border-slate-700/40 pt-6">
          {resultado.rechazado ? (
            /* Rechazo automático: falla display / touch */
            <div className="text-center py-4">
              <Ban size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-xl font-extrabold text-red-400">No cotiza</p>
              <p className="text-sm text-slate-400 mt-1">{resultado.motivo}</p>
              <div className="mt-3">
                <Badge color="red">{ESTADO_NO_COTIZA}</Badge>
              </div>
            </div>
          ) : resultado.manual ? (
            /* Modelo no listado → valuación manual */
            <div className="text-center py-4">
              <ShieldAlert size={32} className="text-admin mx-auto mb-3" />
              <p className="text-xl font-extrabold text-admin">Valuación manual</p>
              <p className="text-sm text-slate-400 mt-1">{resultado.motivo}</p>
            </div>
          ) : resultado.valorFinal != null ? (
            <>
              {/* Hero */}
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">
                  {descripcion}
                </p>
                <p className="text-4xl md:text-5xl font-extrabold text-neon glow-text leading-tight">
                  Valor de canje: {fmtUSD(resultado.valorFinal)}
                </p>
              </div>

              {/* Desglose */}
              <div className="max-w-md mx-auto mt-6 space-y-1.5 text-sm">
                <DesgloseRow label="Valor base" valor={d?.valorBase ?? 0} neutro />
                <DesgloseRow label={`Storage (${storage})`} valor={d?.ajusteStorage ?? 0} />
                {esIphone && (
                  <DesgloseRow
                    label={`Batería (${bateriaNum != null ? `${bateriaNum}%` : 'sin dato'})`}
                    valor={d?.penalizacionBateria ?? 0}
                  />
                )}
                <DesgloseRow label={`Estado (${estado})`} valor={d?.ajusteEstado ?? 0} />
                {!esIphone && <DesgloseRow label="Descuento fijo de sistema" valor={d?.descuentoFijo ?? -215} />}
                <div className="border-t border-slate-700/40 pt-1.5 flex justify-between font-bold">
                  <span className="text-slate-200">Valor final</span>
                  <span className="text-neon">{fmtUSD(resultado.valorFinal)}</span>
                </div>
              </div>

              {/* Disclaimer regla de negocio */}
              <p className="text-xs text-slate-500 text-center mt-4 max-w-lg mx-auto">
                El valor calculado es el máximo autorizado — no es negociable. Cualquier excepción
                requiere aprobación de gerencia.
              </p>

              {/* Acciones */}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant={copiado ? 'success' : 'ghost'} onClick={() => void copiar()}>
                  <span className="inline-flex items-center gap-2">
                    {copiado ? <Check size={16} /> : <Copy size={16} />}
                    {copiado ? '¡Copiado!' : 'Copiar'}
                  </span>
                </Button>
                <Button onClick={usarEnCanje}>
                  <span className="inline-flex items-center gap-2">
                    <Repeat size={16} /> Usar en nuevo canje
                  </span>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function DesgloseRow({ label, valor, neutro }: { label: string; valor: number; neutro?: boolean }) {
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={cn(
          'font-semibold',
          neutro ? 'text-slate-200' : valor > 0 ? 'text-success' : valor < 0 ? 'text-red-400' : 'text-slate-500'
        )}
      >
        {neutro ? fmtUSD(valor) : valor === 0 ? '$0' : `${signo}$${Math.abs(valor)}`}
      </span>
    </div>
  );
}
