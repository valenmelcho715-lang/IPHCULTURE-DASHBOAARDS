export type Channel = 'whatsapp' | 'instagram';
export type Mode = 'auto' | 'human';
export interface Settings {
  enabled: boolean; usdArs: number; maxDiscountUsd: number; returningDiscountUsd: number;
  stackReturningDiscount: boolean; androidDeductionUsd: number; reservationPercent: number;
  reservationDays: number; followupHours: number[]; maxFollowups: number;
  aiMonthlyBudgetUsd: number; aiInputUsdPerMillion: number; aiOutputUsdPerMillion: number;
  followupTemplate: string; followupTemplateLanguage: string; followupTemplateApproved: boolean;
  closerIds: number[]; timezone: string; storeAddress:string;
}
export const DEFAULT_SETTINGS: Settings = {
  enabled: false, usdArs: 1680, maxDiscountUsd: 15, returningDiscountUsd: 30,
  stackReturningDiscount: false, androidDeductionUsd: 215, reservationPercent: 30,
  reservationDays: 7, followupHours: [48, 96, 168, 240, 336], maxFollowups: 5,
  aiMonthlyBudgetUsd: 100, aiInputUsdPerMillion: 0.4, aiOutputUsdPerMillion: 1.6,
  followupTemplate: '', followupTemplateLanguage: 'es_AR', followupTemplateApproved: false,
  closerIds: [], timezone: 'America/Argentina/Salta', storeAddress:'',
};
export interface Qualification {
  intent: 'buy' | 'trade_in' | 'appointment' | 'payment' | 'complaint' | 'warranty' | 'question' | 'opt_out';
  topic:'product'|'hours'|'location'|'payment_options'|'returns'|'other';
  product: string | null; budgetUsd: number | null; payment: string | null;
  timeframe: 'today' | 'week' | 'later' | 'unknown'; installments: number | null;
  tradeModel: string | null; tradeBrand: string | null; tradeStorage: string | null;
  tradeBattery: number | null; tradeCondition: string | null; tradeRepaired: boolean | null;
  tradeInternalOk: boolean | null; appointmentAt: string | null; phone: string | null;
  consent: boolean | null; priceObjection: boolean; confidence: number;
  summary: string; evidence: string[];
}
export const EMPTY_QUALIFICATION: Qualification = {
  intent: 'question', topic:'product', product: null, budgetUsd: null, payment: null, timeframe: 'unknown',
  installments: null, tradeModel: null, tradeBrand: null, tradeStorage: null,
  tradeBattery: null, tradeCondition: null, tradeRepaired: null, tradeInternalOk: null,
  appointmentAt: null, phone: null, consent: null, priceObjection: false,
  confidence: 0, summary: '', evidence: [],
};
export function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('299')) digits = `549${digits}`;
  if (digits.startsWith('54') && digits.length === 12) digits = `549${digits.slice(2)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}
export function optedOut(text: string): boolean {
  return /\b(baja|stop|no me escribas|no me contacten|no quiero mensajes|dej[aá] de escribirme|no me mandes m[aá]s)\b/i.test(text);
}
export function handoffReason(q: Qualification, text: string): string | null {
  if (['payment', 'complaint', 'warranty'].includes(q.intent)) return ({payment:'Confirmación de dinero o seña',complaint:'Reclamo',warranty:'Garantía'} as Record<string,string>)[q.intent];
  if (/\b(se[ñn]a|transfer[ií]|comprobante|denuncia|estafa|reclamo|garant[ií]a|no funciona|falla|problema|hablar con (alguien|una persona|un vendedor))\b/i.test(text)) return 'Requiere atención de una persona';
  if (q.tradeRepaired === true || q.tradeInternalOk === false) return 'Canje con reparación o falla: revisión de oficina';
  return null;
}
export function qualify(q: Qualification, returning = false): {score:number; tier:string; reasons:string[]} {
  let score = 0; const reasons: string[] = [];
  const add = (n:number, why:string) => { score += n; reasons.push(why); };
  if(q.product) add(20, 'Producto definido');
  if(q.budgetUsd != null) add(15, 'Presupuesto informado');
  if(q.payment) add(15, 'Medio de pago definido');
  if(q.timeframe === 'today') add(25, 'Quiere comprar hoy');
  if(q.timeframe === 'week') add(15, 'Compra prevista esta semana');
  if(q.intent === 'appointment' || q.appointmentAt) add(20, 'Pidió un turno');
  if(q.tradeModel && q.tradeBattery != null && q.tradeCondition) add(10, 'Canje detallado');
  if(returning) add(10, 'Compra anterior verificada');
  if(q.intent === 'opt_out') return {score:0,tier:'No contactar',reasons:['Solicitó la baja']};
  return {score:Math.min(100,score),tier:score>=65?'Listo para avanzar':score>=35?'En evaluación':'Por conocer',reasons};
}
export function discountFor(s: Settings, returning: boolean, requested: boolean): number {
  return returning ? s.returningDiscountUsd + (requested && s.stackReturningDiscount ? s.maxDiscountUsd : 0) : requested ? s.maxDiscountUsd : 0;
}
export function finance(usd:number, fx:number, fee:Record<string,any>) {
  const n=Number(fee.cuotas); const factor=(1-(Number(fee.fee_cobro_pct)+Number(fee.fee_cuotas_pct)+Number(fee.iibb_pct))/100)*(1-Number(fee.posnet_pct)/100);
  if(!Number.isFinite(usd)||usd<0||!Number.isFinite(fx)||fx<=0||!Number.isFinite(factor)||factor<=0||!Number.isInteger(n)||n<1) throw new Error('Plan de cuotas inválido');
  const total=round2(usd*fx/factor*1.02); return {cuotas:n,totalArs:total,cuotaArs:round2(total/n),fx};
}
export function windowOpen(lastInbound:string|null, now=Date.now()): boolean {
  const time=lastInbound ? Date.parse(lastInbound) : NaN;
  return Number.isFinite(time) && now-time>=0 && now-time<24*3600_000;
}
export function validateSettings(value: Partial<Settings>, prior: Settings): Settings {
  const s={...prior,...value};
  for(const key of ['enabled','stackReturningDiscount','followupTemplateApproved'] as const) if(typeof s[key]!=='boolean') throw new Error(`${key}: valor inválido`);
  for(const key of ['usdArs','reservationPercent','reservationDays','maxFollowups','aiMonthlyBudgetUsd'] as const) if(!Number.isFinite(s[key])||s[key]<=0) throw new Error(`${key}: debe ser positivo`);
  for(const key of ['maxDiscountUsd','returningDiscountUsd','androidDeductionUsd','aiInputUsdPerMillion','aiOutputUsdPerMillion'] as const) if(!Number.isFinite(s[key])||s[key]<0) throw new Error(`${key}: valor inválido`);
  if(s.reservationPercent>100||s.reservationDays>30||s.maxFollowups>5) throw new Error('Límites de reserva o seguimiento inválidos');
  if(!Array.isArray(s.closerIds)||s.closerIds.some(x=>!Number.isInteger(x)||x<1)) throw new Error('Vendedores inválidos');
  if(!Array.isArray(s.followupHours)||s.followupHours.length>5||s.followupHours.some((x,i,a)=>!Number.isFinite(x)||x<48||(i>0&&x<=a[i-1]))) throw new Error('Seguimientos: desde 48 h, intervalos crecientes, máximo cinco');
  if(typeof s.followupTemplate!=='string'||!/^[a-z0-9_]*$/.test(s.followupTemplate)||!/^es(?:_[A-Z]{2})?$/.test(s.followupTemplateLanguage)) throw new Error('Plantilla inválida');
  if(typeof s.storeAddress!=='string'||s.storeAddress.length>400)throw new Error('Dirección inválida');
  s.timezone=DEFAULT_SETTINGS.timezone; return s;
}
