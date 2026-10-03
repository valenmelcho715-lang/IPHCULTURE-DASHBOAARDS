import {Qualification} from './domain';

const compact=(text:string)=>text
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[¡!¿?.,;:]/g,' ')
  .replace(/\s+/g,' ')
  .trim();

/**
 * Respuestas determinísticas para mensajes sociales que no deben volver a
 * ejecutar una cotización ni modificar lo que el cliente ya pidió.
 */
export function courtesyReply(text:string):string|null {
  if(text.length>100)return null;
  const value=compact(text);
  if(/^(hola|hol[ai]+|buen dia|buenas tardes|buenas noches|buenas|hola buen dia|hola buenas)$/.test(value))
    return '¡Hola! Soy el asistente virtual de iPhone Culture. ¿Qué equipo estás buscando o qué te gustaría consultar?';
  if(/^(gracias|muchas gracias|mil gracias|genial gracias|perfecto gracias|dale gracias|listo gracias|gracias genio|gracias crack)$/.test(value))
    return '¡De nada! Cuando quieras, seguimos por acá.';
  return null;
}

export function handoffReply(q:Qualification,text:string,kind:string):string {
  if(!['text','interactive','button'].includes(kind))
    return 'Recibí el archivo. Lo va a revisar una persona del equipo y te responde por acá.';
  if(q.intent==='warranty'||/garant[ií]a/i.test(text))
    return 'Entiendo. Para revisar bien la garantía y el estado del equipo, te paso con una persona de oficina. Te responde por acá.';
  if(q.intent==='payment'||/se[ñn]a|transfer[ií]|comprobante/i.test(text))
    return 'Gracias por avisar. Administración va a verificar el ingreso antes de confirmar el pago o la reserva. Te responden por acá.';
  if(q.intent==='complaint'||/denuncia|estafa|reclamo|no funciona|falla|problema/i.test(text))
    return 'Lamento lo que pasó. Dejo tu caso con una persona del equipo para que lo revise y te ayude por acá.';
  if(/hablar con (alguien|una persona|un vendedor)/i.test(text))
    return 'Claro. Te paso con una persona del equipo para que continúe la conversación por acá.';
  return 'Necesito que una persona del equipo revise este caso. Te responde por acá.';
}

export const responseCopy={
  hours:'Atendemos con turno en Neuquén capital. Lunes, miércoles, viernes y sábados de 11 a 18; martes, jueves y domingos de 13 a 20. Por acá podés escribirnos las 24 horas. ¿Querés que busquemos un turno de 15 minutos?',
  paymentOptions:'Podés pagar en pesos o USD, por transferencia o con tarjeta de crédito hasta en 12 cuotas con interés. Para calcularte el importe exacto, ¿qué modelo te interesa?',
  returns:'Para darte una respuesta correcta sobre cambios o devoluciones, necesito que administración revise tu caso. Te responden por acá.',
  askProduct:'¿Qué modelo te gustaría llevar?',
  firstProductQuestion:'Soy el asistente virtual de iPhone Culture. ¿Qué equipo estás buscando?',
};
