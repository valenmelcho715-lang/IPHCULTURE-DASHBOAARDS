import {snapshotOpportunity} from './history';
import {db} from '../db';
import {extract} from './intelligence';
import {settings,event,notifyTeam} from './schema';
import {conversation,enqueueReply,transfer,nowIso,stopContact} from './repository';
import {qualify,handoffReason,normalizePhone,EMPTY_QUALIFICATION,optedOut,windowOpen} from './domain';
import {stockAvailable,matchingStock,tradeValue,quote,quoteText,slots,bookAppointment,money} from './commerce';
export async function processJob(job:any){
  let c=await conversation(Number(job.conversation_id));
  const latest=(await db.execute({sql:"SELECT id FROM crm_messages WHERE conversation_id=? AND direction='in' AND processable=1 ORDER BY id DESC LIMIT 1",args:[c.id]})).rows[0];
  if(Number(latest?.id)!==Number(job.message_id))return;
  const history=(await db.execute({sql:'SELECT * FROM crm_messages WHERE conversation_id=? AND processable=1 ORDER BY id DESC LIMIT 20',args:[c.id]})).rows.reverse();
  const last:any=history.find(m=>Number(m.id)===Number(job.message_id));if(!last)return;
  // Bajas y reclamos se interpretan también durante la atención humana.
  if(optedOut(String(last.text))){
    await stopContact(c.id);
    await event(c.id,'optout','El cliente pidió no recibir más mensajes');return;
  }
  if(c.mode!=='auto'||c.opt_out||['won','lost','optout'].includes(c.status))return;
  const s=await settings();if(!c.sandbox&&!s.enabled)return;
  if(!c.sandbox&&!windowOpen(c.last_inbound)){await transfer(c.id,'Mensaje recibido fuera de la ventana de respuesta; revisar el canal');return;}
  let q={...EMPTY_QUALIFICATION,...c.qualification};
  const immediateReason=handoffReason(q,String(last.text));
  let handoff:string|null=immediateReason;
  if(!['text','interactive','button'].includes(String(last.kind)))handoff='Adjunto recibido: revisión del equipo';
  if(!handoff){try{q=await extract(c,history);}catch(e){await transfer(c.id,(e as Error).message);return;}}
  if(q.intent==='opt_out'){await stopContact(c.id);await event(c.id,'optout','Solicitud de baja identificada en la conversación');return;}
  handoff=handoff||handoffReason(q,String(last.text));
  if(!handoff&&q.confidence<.65)handoff='Consulta ambigua: necesita un closer';
  const rating=qualify(q,!!c.verified_returning);let reply='';
  if(handoff){reply=q.intent==='warranty'?'Te paso con oficina para revisar la garantía y ayudarte con el equipo.':q.intent==='payment'||/se[ñn]a|transfer[ií]|comprobante/i.test(String(last.text))?'Recibí tu aviso. Administración va a verificar el ingreso del dinero antes de confirmar el pago o la reserva.':'Te paso con el equipo para revisar esto y ayudarte.';}
  else if(q.topic==='hours')reply='Atendemos con turno en Neuquén capital. Lunes, miércoles, viernes y sábados de 11 a 18; martes, jueves y domingos de 13 a 20. Por acá puedo ayudarte las 24 horas. ¿Querés que veamos un turno de 15 minutos?';
  else if(q.topic==='location'){if(s.storeAddress)reply=`Estamos en ${s.storeAddress}, Neuquén capital. La atención es con turno de 15 minutos. ¿Qué día te queda cómodo?`;else{handoff='Confirmar dirección del local';reply='Estamos en Neuquén capital y atendemos con turno. Te paso con el equipo para compartirte la ubicación exacta.';}}
  else if(q.topic==='payment_options')reply='Aceptamos pesos, USD, transferencia y tarjeta de crédito hasta en 12 cuotas con interés. Para decirte el valor de cada cuota, ¿qué modelo te interesa?';
  else if(q.topic==='returns'){handoff='Condiciones de cambio o devolución';reply='Te paso con administración para revisar las condiciones y ayudarte con tu caso.';}
  else if(q.intent==='appointment'){
    if(!c.owner_id){handoff='No hay un closer activo para asignar el turno';reply='Recibí tu pedido de turno. El equipo va a coordinar el horario con vos.';}
    else if(q.appointmentAt){
      // Volver a comprobar el control humano antes de efectuar una acción comercial.
      const fresh=await conversation(c.id);if(fresh.mode!=='auto')return;
      try{const booked=await bookAppointment(c.id,q.appointmentAt,Number(job.message_id));reply=`${booked.preview?'En esta simulación se agendaría':'Te agendé'} un turno de 15 minutos para ${new Date(q.appointmentAt).toLocaleString('es-AR',{timeZone:s.timezone,dateStyle:'short',timeStyle:'short'})}. El turno no reserva un equipo: para eso hace falta la seña confirmada.`;q.appointmentAt=null;q.intent='question';}
      catch{reply='Ese horario ya no está disponible. ¿Te sirve alguno de estos? '+(await slots(Number(c.owner_id))).map(x=>new Date(x).toLocaleString('es-AR',{timeZone:s.timezone,dateStyle:'short',timeStyle:'short'})).join(' · ');}
    }else{const options=await slots(Number(c.owner_id));reply=options.length?'Tengo estos turnos de 15 minutos: '+options.map(x=>new Date(x).toLocaleString('es-AR',{timeZone:s.timezone,dateStyle:'short',timeStyle:'short'})).join(' · ')+'. ¿Cuál te queda mejor?':'No veo turnos libres en los próximos días. Te paso con el equipo para coordinar.';if(!options.length)handoff='Agenda sin disponibilidad';}
  }else{
    let tradeCredit=0;let tradeQuestion='';
    if(q.intent==='trade_in'||q.tradeModel){const trade=tradeValue(q,s);if(trade.manual){handoff='Canje para revisión de oficina';reply='Para cotizar ese canje correctamente necesito que lo revise oficina. Te paso con el equipo.';}else if(trade.question)tradeQuestion=trade.question;else tradeCredit=trade.value||0;}
    if(!handoff){
      if(tradeQuestion)reply=tradeQuestion;
      else if(!q.product)reply=q.tradeModel?`El canje se estima en ${money(tradeCredit)}, sujeto a revisión física. ¿Qué modelo te gustaría llevar?`:'Hola, soy el asistente virtual de iPhone Culture. ¿Qué equipo estás buscando?';
      else{
        const available=await stockAvailable();const matches=matchingStock(available,q.product);
        if(!matches.length){const alternatives=available.filter(x=>Number(x.available)>0&&(!q.budgetUsd||Number(x.precio_venta_usd)<=q.budgetUsd)).slice(0,3);reply=`No veo ${q.product} disponible en este momento.`+(alternatives.length?' Tenemos '+alternatives.map(x=>`${x.modelo} ${x.capacidad||''}`).join(', ')+'. ¿Querés que te cotice alguno?':' Te paso con el equipo para consultar una alternativa.');if(!alternatives.length)handoff='Sin stock para la consulta';}
        else if(matches.length>1){reply='Para ese modelo tengo estas opciones: '+matches.slice(0,4).map(x=>`${x.modelo} ${x.capacidad||''} ${x.color||''} (${x.condicion||'estado a confirmar'})`).join(' · ')+'. ¿Cuál preferís?';}
        else{const estimate=await quote(c.id,Number(matches[0].id),q.priceObjection,tradeCredit,q);reply=quoteText(estimate)+(q.timeframe==='later'&&!c.followup_optin?' ¿Me autorizás a escribirte por acá en 48 horas para retomar esta consulta?':q.payment?' ¿Querés que veamos un turno para que lo conozcas?':' ¿Preferís abonar al contado o en cuotas?');}
      }
    }
  }
  const tx=await db.transaction('write');try{
    c=await conversation(c.id,tx);
    const lastNow=(await tx.execute({sql:"SELECT MAX(id) AS id FROM crm_messages WHERE conversation_id=? AND direction='in' AND processable=1",args:[c.id]})).rows[0];
    if(c.mode!=='auto'||c.opt_out||Number(lastNow.id)!==Number(job.message_id)){await tx.rollback();return;}
    await tx.execute({sql:'UPDATE crm_conversations SET qualification=?,score=?,tier=?,reasons=?,summary=?,updated_at=?,followup_optin=CASE WHEN ? IS NULL THEN followup_optin ELSE ? END,consent_evidence=CASE WHEN ? IS NULL THEN consent_evidence ELSE ? END WHERE id=?',args:[JSON.stringify(q),rating.score,rating.tier,JSON.stringify(rating.reasons),q.summary,nowIso(),q.consent==null?null:Number(q.consent),Number(q.consent),q.consent==null?null:1,String(last.text).slice(0,1000),c.id]});
    if(q.phone){const phone=normalizePhone(q.phone);if(phone)await tx.execute({sql:'UPDATE crm_contacts SET phone=? WHERE id=?',args:[phone,c.contact_id]});}
    if(c.lead_id){await tx.execute({sql:"UPDATE leads SET estado=?,notas=? WHERE id=? AND estado NOT IN('Ganado','Perdido')",args:[rating.score>=65?'Negociando':rating.score>=35?'Interesado':'Contactado',`${q.summary}\nPrioridad: ${rating.tier}. ${rating.reasons.join('. ')}`,c.lead_id]});}
    await snapshotOpportunity(await conversation(c.id,tx),tx);
    if(reply)await enqueueReply(c.id,reply,handoff?'system':'ai',Number(job.message_id),'text',null,tx);
    if(handoff)await tx.execute({sql:"UPDATE crm_conversations SET mode='human',handoff_reason=? WHERE id=?",args:[handoff,c.id]});
    await tx.commit();if(handoff){await event(c.id,'handoff',handoff);await notifyTeam(c.id,handoff,c.owner_id,true);}else if(rating.score>=65&&Number(c.score)<65)await notifyTeam(c.id,'Alta intención de compra: '+q.summary,c.owner_id);await event(c.id,'qualified',`${rating.score}/100 · ${rating.reasons.join(', ')}`);
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
