// ============================================================
// lib/planCanje.ts — PLAN OFICIAL DE VALUACIÓN DE CANJES
// Datos y funciones puras (100% client-side, testeables).
// Fuente: PDFs internos oficiales del negocio.
//
// iPhone:  Valor Final = Base + Bonus Storage − Penal. Batería − Penal. Estado
// Android: Valor Final = Base + Ajuste Storage + Ajuste Estado − $215 (fijo)
// Piso en $0. "Falla display / touch" (Android) → NO COTIZA.
// Modelo no listado → $0, requiere valuación manual.
// ============================================================

export type Marca = 'iPhone' | 'Samsung' | 'Motorola' | 'Xiaomi';
export const MARCAS: Marca[] = ['iPhone', 'Samsung', 'Motorola', 'Xiaomi'];

export const OTRO_MODELO = 'Otro modelo / no listado';

// ---------- Valores base ----------
// Referencia: batería ≥90%, estado excelente, capacidad base.
export const IPHONE_BASE: Record<string, number> = {
  'iPhone XR': 30,
  'iPhone 11': 90,
  'iPhone 11 Pro': 150,
  'iPhone 11 Pro Max': 170,
  'iPhone 12': 130,
  'iPhone 12 Pro': 190,
  'iPhone 12 Pro Max': 210,
  'iPhone 13': 180,
  'iPhone 13 Pro': 240,
  'iPhone 13 Pro Max': 260,
  'iPhone 14': 280,
  'iPhone 14 Plus': 300,
  'iPhone 14 Pro': 350,
  'iPhone 14 Pro Max': 380,
  'iPhone 15': 400,
  'iPhone 15 Plus': 430,
  'iPhone 15 Pro': 500,
  'iPhone 15 Pro Max': 540,
  'iPhone 16': 440,
  'iPhone 16 Plus': 470,
  'iPhone 16 Pro': 540,
  'iPhone 16 Pro Max': 600,
};

const SAMSUNG_BASE: Record<string, number> = {
  // Línea A
  'Galaxy A14': 70,
  'Galaxy A15': 85,
  'Galaxy A23': 95,
  'Galaxy A24': 110,
  'Galaxy A32': 120,
  'Galaxy A33': 135,
  'Galaxy A34': 155,
  'Galaxy A35': 175,
  'Galaxy A52': 175,
  'Galaxy A53': 200,
  'Galaxy A54': 230,
  'Galaxy A55': 270,
  // Línea S
  'Galaxy S20': 200,
  'Galaxy S20+': 220,
  'Galaxy S20 Ultra': 250,
  'Galaxy S21': 260,
  'Galaxy S21+': 300,
  'Galaxy S21 Ultra': 340,
  'Galaxy S22': 320,
  'Galaxy S22+': 370,
  'Galaxy S22 Ultra': 420,
  'Galaxy S23': 400,
  'Galaxy S23+': 460,
  'Galaxy S23 Ultra': 520,
  'Galaxy S24': 480,
  'Galaxy S24+': 540,
  'Galaxy S24 Ultra': 600,
  'Galaxy S25': 560,
  'Galaxy S25+': 630,
  'Galaxy S25 Ultra': 720,
};

const MOTOROLA_BASE: Record<string, number> = {
  // Línea G
  'Moto G14': 70,
  'Moto G23': 85,
  'Moto G32': 100,
  'Moto G52': 120,
  'Moto G53': 140,
  'Moto G54': 170,
  'Moto G73': 190,
  'Moto G84': 220,
  // Línea Edge
  'Edge 20': 200,
  'Edge 30': 240,
  'Edge 30 Pro': 300,
  'Edge 40': 280,
  'Edge 40 Pro': 360,
  'Edge 50': 320,
  'Edge 50 Pro': 420,
  'Edge 50 Ultra': 520,
};

const XIAOMI_BASE: Record<string, number> = {
  // Redmi
  'Redmi 10': 80,
  'Redmi 12': 80,
  'Redmi Note 10': 120,
  'Redmi Note 11': 150,
  'Redmi Note 12': 180,
  'Redmi Note 12 Pro': 230,
  'Redmi Note 13': 210,
  'Redmi Note 13 Pro': 260,
  'Redmi Note 13 Pro+': 300,
  // Mi / flagship
  'Mi 11': 260,
  'Mi 12': 320,
  'Mi 12 Pro': 360,
  'Xiaomi 13': 420,
  'Xiaomi 13 Pro': 480,
  'Xiaomi 14': 500,
  'Xiaomi 14 Pro': 560,
  'Xiaomi 14 Ultra': 650,
};

export const MODELOS_POR_MARCA: Record<Marca, string[]> = {
  iPhone: Object.keys(IPHONE_BASE),
  Samsung: Object.keys(SAMSUNG_BASE),
  Motorola: Object.keys(MOTOROLA_BASE),
  Xiaomi: Object.keys(XIAOMI_BASE),
};

const ANDROID_BASE: Record<Exclude<Marca, 'iPhone'>, Record<string, number>> = {
  Samsung: SAMSUNG_BASE,
  Motorola: MOTOROLA_BASE,
  Xiaomi: XIAOMI_BASE,
};

// ---------- Storage ----------
// iPhone: bonus por capacidad SOBRE la versión base del modelo.
export const STORAGE_IPHONE = ['Base', '+128 GB', '+256 GB', '+512 GB', '+1 TB'] as const;
export type StorageIphone = (typeof STORAGE_IPHONE)[number];
const IPHONE_STORAGE_BONUS: Record<StorageIphone, number> = {
  Base: 0,
  '+128 GB': 20,
  '+256 GB': 40,
  '+512 GB': 70,
  '+1 TB': 100,
};

// Android: ajuste por capacidad total.
export const STORAGE_ANDROID = ['Base', '256 GB', '512 GB', '1 TB'] as const;
export type StorageAndroid = (typeof STORAGE_ANDROID)[number];
const ANDROID_STORAGE_AJUSTE: Record<StorageAndroid, number> = {
  Base: 0,
  '256 GB': 50,
  '512 GB': 80,
  '1 TB': 120,
};

// ---------- Estado ----------
export const ESTADOS_IPHONE = ['Excelente', 'Detalles leves', 'Golpes visibles', 'Pantalla dañada'] as const;
export type EstadoIphone = (typeof ESTADOS_IPHONE)[number];
const IPHONE_ESTADO_PENAL: Record<EstadoIphone, number> = {
  Excelente: 0,
  'Detalles leves': -20,
  'Golpes visibles': -50,
  'Pantalla dañada': -70,
};

export const ESTADOS_ANDROID = [
  'Excelente',
  'Detalles leves',
  'Marco golpeado',
  'Pantalla rayada',
  'Pantalla no original',
  'Falla display / touch',
] as const;
export type EstadoAndroid = (typeof ESTADOS_ANDROID)[number];
const ANDROID_ESTADO_AJUSTE: Record<Exclude<EstadoAndroid, 'Falla display / touch'>, number> = {
  Excelente: 0,
  'Detalles leves': -20,
  'Marco golpeado': -30,
  'Pantalla rayada': -40,
  'Pantalla no original': -80,
};

export const ESTADO_NO_COTIZA: EstadoAndroid = 'Falla display / touch';
export const MOTIVO_RECHAZO = 'No cotiza — equipo rechazado por falla de display/touch';
export const MOTIVO_MANUAL = 'Requiere valuación manual — modelo no listado en el plan oficial';

// ---------- Batería (solo iPhone) ----------
// ≥90% → $0 · 85–89% → −$30 · 80–84% → −$60 · <80% o sin dato → −$100
export function penalizacionBateria(pct: number | null | undefined): number {
  if (pct == null || Number.isNaN(pct)) return -100;
  if (pct >= 90) return 0;
  if (pct >= 85) return -30;
  if (pct >= 80) return -60;
  return -100;
}

// ---------- Resultado ----------
export interface DesgloseCanje {
  valorBase: number;
  ajusteStorage: number;
  /** Solo iPhone (negativo o 0). */
  penalizacionBateria?: number;
  ajusteEstado: number;
  /** Solo Android: descuento fijo de sistema (−$215, siempre aplica). */
  descuentoFijo?: number;
}

export interface ResultadoCanje {
  /** null cuando no cotiza (rechazado o valuación manual). */
  valorFinal: number | null;
  rechazado?: boolean;
  manual?: boolean;
  motivo?: string;
  desglose: DesgloseCanje;
}

const DESGLOSE_VACIO: DesgloseCanje = { valorBase: 0, ajusteStorage: 0, ajusteEstado: 0 };

// ---------- Cálculo iPhone ----------
export function calcularCanjeiPhone(params: {
  modelo: string;
  storage: StorageIphone;
  /** 1–100, o null/vacío si se desconoce (aplica penalización máxima −$100). */
  bateriaPct: number | null;
  estado: EstadoIphone;
}): ResultadoCanje {
  const base = IPHONE_BASE[params.modelo];
  if (base == null) {
    return { valorFinal: null, manual: true, motivo: MOTIVO_MANUAL, desglose: { ...DESGLOSE_VACIO } };
  }
  const ajusteStorage = IPHONE_STORAGE_BONUS[params.storage] ?? 0;
  const penBateria = penalizacionBateria(params.bateriaPct);
  const penEstado = IPHONE_ESTADO_PENAL[params.estado] ?? 0;
  const valorFinal = Math.max(0, base + ajusteStorage + penBateria + penEstado);
  return {
    valorFinal,
    desglose: {
      valorBase: base,
      ajusteStorage,
      penalizacionBateria: penBateria,
      ajusteEstado: penEstado,
    },
  };
}

// ---------- Cálculo Android (Samsung / Motorola / Xiaomi) ----------
export function calcularCanjeAndroid(params: {
  marca: Exclude<Marca, 'iPhone'>;
  modelo: string;
  storage: StorageAndroid;
  estado: EstadoAndroid;
}): ResultadoCanje {
  // Falla de display/touch → NO COTIZA (rechazo automático, no es un $0)
  if (params.estado === ESTADO_NO_COTIZA) {
    return { valorFinal: null, rechazado: true, motivo: MOTIVO_RECHAZO, desglose: { ...DESGLOSE_VACIO } };
  }
  const tabla = ANDROID_BASE[params.marca];
  const base = tabla?.[params.modelo];
  if (base == null) {
    return { valorFinal: null, manual: true, motivo: MOTIVO_MANUAL, desglose: { ...DESGLOSE_VACIO } };
  }
  const ajusteStorage = ANDROID_STORAGE_AJUSTE[params.storage] ?? 0;
  const ajusteEstado =
    ANDROID_ESTADO_AJUSTE[params.estado as Exclude<EstadoAndroid, 'Falla display / touch'>] ?? 0;
  const DESCUENTO_FIJO = -215; // descuento fijo de sistema — SIEMPRE aplica (−$65 base + baja general de $150 del 14/9/26)
  const valorFinal = Math.max(0, base + ajusteStorage + ajusteEstado + DESCUENTO_FIJO);
  return {
    valorFinal,
    desglose: {
      valorBase: base,
      ajusteStorage,
      ajusteEstado,
      descuentoFijo: DESCUENTO_FIJO,
    },
  };
}
