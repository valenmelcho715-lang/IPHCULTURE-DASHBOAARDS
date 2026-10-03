import {snapshotOpportunity} from './history';
import {db} from '../db';
import {extract} from './intelligence';
import {settings,event,notifyTeam} from './schema';
import {conversation,enqueueReply,transfer,nowIso,stopContact} from './repository';
import {qualify,handoffReason,normalizePhone,EMPTY_QUALIFICATION,optedOut,windowOpen} from './domain';
import {stockAvailable,matchingStock,tradeValue,quote,quoteText,slots,bookAppointment,money} from './commerce';
import {courtesyReply,handoffReply,outOfStockReply,responseCopy,tradeEstimateReply} from './response-copy';
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
  const socialReply=courtesyReply(String(last.text));
  const immediateReason=handoffReason(q,String(last.text));
  let handoff:string|null=immediateReason;
  if(!['text','interactive','button'].includes(String(last.kind)))handoff='Adjunto recibido: revisión del equipo';
  if(!handoff&&!socialReply){try{q=await extract(c,history);}catch(e){await transfer(c.id,(e as Error).message);return;}}
  if(q.intent==='opt_out'){await stopContact(c.id);await event(c.id,'optout','Solicitud de baja identificada en la conversación');return;}
  handoff=handoff||handoffReason(q,String(last.text));
  if(!handoff&&!socialReply&&q.confidence<.65)handoff='Consulta ambigua: necesita un closer';
  const rating=qualify(q,!!c.verified_returning);let reply=socialReply||'';
  if(handoff){reply=handoffReply(q,String(last.text),String(last.kind));}
  else if(reply){/* Un saludo o agradecimiento no vuelve a disparar la venta anterior. */}
  else if(q.topic==='hours')reply=responseCopy.hours;
  else if(q.topic==='location'){if(s.storeAddress)reply=`Estamos en ${s.storeAddress}, Neuquén capital. La atención es con turno de 15 minutos. ¿Qué día te queda cómodo?`;else{handoff='Confirmar dirección del local';reply='Estamos en Neuquén capital y atendemos con turno. Te paso con el equipo para compartirte la ubicación exacta.';}}
  else if(q.topic==='payment_options')reply=responseCopy.paymentOptions;
  else if(q.topic==='returns'){handoff='Condiciones de cambio o devolución';reply=responseCopy.returns;}
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
      else if(!q.product)reply=q.tradeModel?`${tradeEstimateReply(money(tradeCredit))} ${responseCopy.askProduct}`:responseCopy.firstProductQuestion;
      else{
        const available=await stockAvailable();const matches=matchingStock(available,q.product);
        if(!matches.length){const alternatives=available.filter(x=>Number(x.available)>0&&(!q.budgetUsd||Number(x.precio_venta_usd)<=q.budgetUsd)).slice(0,3);const firstContact=history.filter(m=>m.direction==='in').length===1;reply=outOfStockReply(q.product,alternatives,firstContact);if(!alternatives.length)handoff='Sin stock para la consulta';}
        else if(matches.length>1){reply='Para ese modelo tengo estas opciones: '+matches.slice(0,4).map(x=>`${x.modelo} ${x.capacidad||''} ${x.color||''} (${x.condicion||'estado a confirmar'})`).join(' · ')+'. ¿Cuál preferís?';}
        else{const estimate=await quote(c.id,Number(matches[0].id),q.priceObjection,tradeCredit,q);const cardPayment=/tarjeta|cuotas?/i.test(String(q.payment||''));reply=quoteText(estimate)+(q.timeframe==='later'&&!c.followup_optin?' ¿Me autorizás a escribirte por acá en 48 horas para retomar esta consulta?':q.installments?'\n¿Te sirve esa opción?':cardPayment?'\n¿Cuál opción te sirve?':q.payment?' ¿Querés que veamos un turno para que lo conozcas?':' ¿Preferís abonar al contado o en cuotas?');}
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
