// ============================================================
// lib/motivacion.ts — Saludo + mensaje motivacional del día.
// Rota automáticamente cada día (índice = día del año). Todos
// los vendedores ven el mismo mensaje el mismo día, sin config.
// Los mensajes hablan en segunda persona, de forma individual.
// ============================================================

const MENSAJES: string[] = [
  'Hoy es tu día. Cada "no" que escuches te acerca al próximo "sí". Salí a romperla, 💪',
  'Vos no vendés un iPhone: le regalás a alguien una experiencia. Hacela inolvidable. ✨',
  'La diferencia entre un día común y un gran día sos vos. Hoy lo vas a notar. 🚀',
  'No cuentes las horas: hacé que cada hora cuente. Este puede ser tu mejor día. 🔥',
  'Cada lead que te toque hoy es oro disfrazado. Tratalo como tal. 🏆',
  'Tu éxito es la suma de lo que hagas hoy. Empezá fuerte y no pares. 📈',
  'Ahora mismo hay alguien buscando exactamente lo que vos vendés. Encontralo primero. 🎯',
  'Tu actitud es gratis y vale oro. Entrale al día con la mejor de todas. 😎',
  'Hoy vas a ayudar a varias personas a tomar una gran decisión. Qué lindo laburo tenés. 🤝',
  'Nadie vende como vos cuando creés en lo que hacés. Hoy, a creer. ⚡',
  'Tus objetivos no se cumplen solos: los cumplís vos. Hoy es el día. 🥇',
  'Cada cliente que atiendas bien hoy vuelve y te trae dos más. Cada trato cuenta. 💎',
  'No hay día flojo para vos: hay oportunidades esperando tu actitud. 🔥',
  'La constancia vence al talento. Y vos tenés los dos. Hoy, constancia. 🧱',
  'Pensá en esa comisión extra que querés. Está ahí, esperándote. Andá a buscarla. 💵',
  'Cada mensaje que respondás rápido hoy es media venta ganada. Velocidad. ⚡',
  'El mejor momento para vender fue ayer. El segundo mejor es ahora. Tu momento es ahora. ⏰',
  'Hacé que al final del día tus números hablen por vos. 📊',
  'Sonreí, escuchá, asesorá, cerrá. Vos ya sabés la fórmula: aplicala hoy. 😄',
  'Cada "cumplí" tuyo te acerca al bono. ¿Ya viste qué bonos hay activos? 🎁',
  'Hoy es día de superar tu propio récord. Vos podés. 🏅',
  'La suerte favorece al que trabaja. Vos trabajás: la suerte te va a encontrar. 🍀',
  'Vos no vendés teléfonos: vendés soluciones, estilo y confianza. Eso vale mucho. 📱',
  'Un equipo que se habla, vende más. Compartí tus tips de hoy en el chat. 💬',
  'Cada turno que agendes hoy es una puerta que se abre. Abrilas todas. 🚪',
  'No vendas por vender: enamorá a tu cliente con la mejor opción para él. ❤️',
  'Tu energía se contagia. Hoy contagiá ganas de comprar a cada persona que entre. 🔋',
  'Los grandes vendedores se hacen en días como hoy. Este día es tuyo. 📅',
  'Cerrá el día sabiendo que diste el 100%. Y ese 100% empieza ahora. 🌅',
  'Tu bono no se gana esperando: se gana vendiendo. Hoy vas por él. 🎯',
  'Hoy podés ser vos el mejor del ranking. Demostráselo a todos. 👑',
];

/** Índice del día del año (1..366). */
function diaDelAnio(): number {
  const ahora = new Date();
  const inicioAnio = new Date(ahora.getFullYear(), 0, 0);
  return Math.floor((ahora.getTime() - inicioAnio.getTime()) / 86_400_000);
}

/** Mensaje motivacional del día actual (mismo para todo el equipo). */
export function mensajeDelDia(): string {
  return MENSAJES[diaDelAnio() % MENSAJES.length];
}

/**
 * Saludo según la hora del día, personalizado con el nombre.
 * Ej.: "Buenos días, Ian ☀️" / "Buenas tardes, María 🌤️" / "Buenas noches, Ian 🌙"
 */
export function saludoDelDia(nombre?: string | null): string {
  const hora = new Date().getHours();
  const quien = nombre ? `, ${nombre.split(' ')[0]}` : '';
  if (hora >= 6 && hora < 12) return `Buenos días${quien} ☀️`;
  if (hora >= 12 && hora < 20) return `Buenas tardes${quien} 🌤️`;
  return `Buenas noches${quien} 🌙`;
}
