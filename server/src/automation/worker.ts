import {processMedia} from './media';
import crypto from 'node:crypto';
import {db} from '../db';
import {processJob} from './engine';
import {conversation,enqueueReply,nowIso,transfer} from './repository';
import {settings,event,notifyTeam} from './schema';
import {windowOpen} from './domain';
import {sendMeta,DeliveryError} from './meta';
const workerId=crypto.randomUUID();let running=false;let lastMaintenance=0;let timer:NodeJS.Timeout|null=null;

export async function deliver(candidate:any){
  const s=await settings();const tx=await db.transaction('write');
  let row:any,c:any,message:any,isTemplate=false,block='';
  try{
    row=(await tx.execute({sql:"SELECT * FROM crm_outbox WHERE id=? AND status='pending' AND ready_at<=?",args:[Number(candidate.id),nowIso()]})).rows[0];
    if(!row){await tx.rollback();return;}
    c=await conversation(Number(row.conversation_id),tx);
    message=(await tx.execute({sql:'SELECT * FROM crm_messages WHERE id=?',args:[Number(row.message_id)]})).rows[0];
    isTemplate=String(row.kind).startsWith('template');
    if(c.sandbox)block='Una simulación no envía mensajes externos';
    if(c.opt_out||c.status==='optout')block='El cliente pidió la baja';
    if(message.author!=='human'&&!s.enabled)block='Atención automática desactivada';
    if(message.author==='ai'&&(c.mode!=='auto'||c.status!=='active'))block='Atención automática pausada o conversación cerrada';
    if(isTemplate){
      if(c.channel!=='whatsapp'||!c.followup_optin||!s.followupTemplateApproved||!s.followupTemplate||c.status!=='active'||c.mode!=='auto'||c.archived_at)block='Seguimiento sin permiso, plantilla aprobada o conversación activa';
      const newer=await tx.execute({sql:"SELECT id FROM crm_messages WHERE conversation_id=? AND direction='in' AND processable=1 AND id>? LIMIT 1",args:[c.id,Number(row.cause_message_id||0)]});
      if(newer.rows.length)block='El cliente ya respondió: seguimiento cancelado';
    }else if(!windowOpen(c.last_inbound))block='Ventana de 24 horas cerrada';
    if(message.author==='ai'&&row.cause_message_id){
      const newer=await tx.execute({sql:"SELECT id FROM crm_messages WHERE conversation_id=? AND id>? AND ((direction='in' AND processable=1) OR author='human') LIMIT 1",args:[c.id,Number(row.cause_message_id)]});
      if(newer.rows.length)block='Respuesta reemplazada por una conversación más reciente';
    }
    if(block){
      await tx.execute({sql:"UPDATE crm_outbox SET status='blocked',error=? WHERE id=?",args:[block,Number(row.id)]});
      await tx.execute({sql:"UPDATE crm_messages SET delivery='blocked' WHERE id=?",args:[Number(row.message_id)]});
    }else await tx.execute({sql:"UPDATE crm_outbox SET status='sending',attempts=attempts+1,leased_at=? WHERE id=?",args:[nowIso(),Number(row.id)]});
    await tx.commit();
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
  if(block){await event(c.id,'delivery_blocked',block);return;}
  try{
    const providerId=await sendMeta(c,String(message.text),isTemplate?'template':'text',row.template?JSON.parse(String(row.template)):undefined);
    const sent=nowIso();
    const updates:any[]=[
      {sql:"UPDATE crm_messages SET provider_id=?,delivery='sent' WHERE id=?",args:[`${c.channel}:0:${providerId}`,Number(row.message_id)]},
      {sql:"UPDATE crm_outbox SET status='sent',error=NULL WHERE id=?",args:[Number(row.id)]},
      {sql:'UPDATE crm_conversations SET last_outbound=?,updated_at=? WHERE id=?',args:[sent,sent,c.id]},
      {sql:"UPDATE crm_followups SET status='sent',sent_at=? WHERE message_id=?",args:[sent,Number(row.message_id)]}
    ];
    if(isTemplate)updates.push({sql:'UPDATE crm_conversations SET followup_attempts=followup_attempts+1 WHERE id=? AND last_inbound=?',args:[c.id,c.last_inbound]});
    await db.batch(updates,'write');
  }catch(e){
    const err=e instanceof DeliveryError?e:new DeliveryError('No se pudo confirmar el envío',false,true);
    const retry=err.retryable&&Number(row.attempts)<4;const state=err.uncertain?'uncertain':retry?'pending':'failed';
    await db.execute({sql:'UPDATE crm_outbox SET status=?,error=?,ready_at=? WHERE id=?',args:[state,err.message,new Date(Date.now()+Math.min(3600,30*2**Number(row.attempts))*1000).toISOString(),Number(row.id)]});
    await db.execute({sql:'UPDATE crm_messages SET delivery=? WHERE id=?',args:[state,Number(row.message_id)]});
    if(!retry)await event(c.id,'delivery_issue',err.message);
  }
}

export async function recoverStalled(){
  const expired=new Date(Date.now()-120000).toISOString();
  await db.batch([
    {sql:"UPDATE crm_messages SET delivery='uncertain' WHERE id IN(SELECT message_id FROM crm_outbox WHERE status='sending' AND leased_at<?)",args:[expired]},
    {sql:"UPDATE crm_outbox SET status='uncertain',error='Proceso interrumpido durante el envío; revisar entrega' WHERE status='sending' AND leased_at<?",args:[expired]},
    {sql:"UPDATE crm_jobs SET status='pending' WHERE status='processing' AND leased_at<?",args:[expired]}
  ],'write');
}

export async function maintenance(){
  await recoverStalled();
  const expired=await db.execute({sql:"SELECT id,conversation_id FROM crm_reservations WHERE status='confirmed' AND expires_at<=?",args:[nowIso()]});
  for(const r of expired.rows){await db.execute({sql:"UPDATE crm_reservations SET status='expired' WHERE id=? AND status='confirmed'",args:[Number(r.id)]});await event(Number(r.conversation_id),'reservation_expired',`La reserva #${r.id} venció y liberó disponibilidad. Revisar la seña con el cliente.`);}
  const due=(await db.execute({sql:"SELECT c.id,c.owner_id,c.next_action_note FROM crm_conversations c JOIN crm_contacts p ON p.id=c.contact_id WHERE c.next_action_at<=? AND c.next_action_notified IS NULL AND c.archived_at IS NULL AND p.opt_out=0",args:[nowIso()]})).rows;
  for(const c of due){const changed=await db.execute({sql:'UPDATE crm_conversations SET next_action_notified=? WHERE id=? AND next_action_notified IS NULL',args:[nowIso(),c.id]});if(changed.rowsAffected)await notifyTeam(Number(c.id),'Retomar consulta: '+String(c.next_action_note||''),Number(c.owner_id)||null,!c.owner_id);}
  const s=await settings();if(!s.enabled)return;
  const list=(await db.execute("SELECT c.* FROM crm_conversations c JOIN crm_contacts p ON p.id=c.contact_id WHERE c.sandbox=0 AND c.mode='auto' AND c.status='active' AND c.archived_at IS NULL AND p.opt_out=0 AND c.followup_optin=1 AND c.last_inbound IS NOT NULL")).rows;
  for(const candidate of list){
    const tx=await db.transaction('write');try{
      const c=await conversation(Number(candidate.id),tx);
      const attempt=Number(c.followup_attempts)+1;
      if(c.archived_at||c.mode!=='auto'||c.status!=='active'||c.opt_out||!c.followup_optin||c.channel!=='whatsapp'||!s.followupTemplateApproved||!s.followupTemplate||attempt>s.maxFollowups||!s.followupHours[attempt-1]||Date.now()-Date.parse(String(c.last_inbound))<s.followupHours[attempt-1]*3600_000){await tx.rollback();continue;}
      const prior=await tx.execute({sql:'SELECT id FROM crm_followups WHERE conversation_id=? AND cycle=? AND attempt=?',args:[c.id,String(c.last_inbound),attempt]});
      if(prior.rows.length){await tx.rollback();continue;}
      if(attempt>1){
        const previous=(await tx.execute({sql:"SELECT sent_at,created_at FROM crm_followups WHERE conversation_id=? AND cycle=? AND attempt=? AND status='sent'",args:[c.id,String(c.last_inbound),attempt-1]})).rows[0];
        const gap=(s.followupHours[attempt-1]-s.followupHours[attempt-2])*3600_000;
        // Tras un corte largo, no mandar de golpe todos los intentos atrasados.
        if(!previous||Date.now()-Date.parse(String(previous.sent_at||previous.created_at))<gap){await tx.rollback();continue;}
      }
      const latest=(await tx.execute({sql:"SELECT MAX(id) AS id FROM crm_messages WHERE conversation_id=? AND direction='in' AND processable=1",args:[c.id]})).rows[0];
      const template=JSON.stringify({name:s.followupTemplate,language:s.followupTemplateLanguage});
      const mid=await enqueueReply(c.id,`Seguimiento ${attempt}: plantilla ${s.followupTemplate}`,'ai',Number(latest.id),`template:${attempt}`,template,tx);
      await tx.execute({sql:"INSERT INTO crm_followups(conversation_id,cycle,attempt,message_id,status,created_at) VALUES(?,?,?,?,'queued',?)",args:[c.id,String(c.last_inbound),attempt,mid,nowIso()]});
      await tx.commit();
    }catch(e){await tx.rollback();throw e;}finally{tx.close();}
  }
}

export async function tick(){
  if(running)return;running=true;
  try{
    const lease=await db.execute({sql:"UPDATE crm_worker_lock SET owner=?,expires_at=? WHERE id=1 AND (owner=? OR expires_at<?)",args:[workerId,new Date(Date.now()+180000).toISOString(),workerId,nowIso()]});
    if(lease.rowsAffected!==1)return;
    // Cuatro conversaciones independientes; una sola tarea por conversación.
    const jobs=(await db.execute({sql:"SELECT * FROM crm_jobs WHERE id IN(SELECT MIN(id) FROM crm_jobs WHERE status='pending' AND ready_at<=? GROUP BY conversation_id) ORDER BY id LIMIT 4",args:[nowIso()]})).rows;
    const results=await Promise.allSettled(jobs.map(async job=>{
      const claimed=await db.execute({sql:"UPDATE crm_jobs SET status='processing',attempts=attempts+1,leased_at=? WHERE id=? AND status='pending'",args:[nowIso(),Number(job.id)]});
      if(!claimed.rowsAffected)return;
      try{await processJob(job);await db.execute({sql:"UPDATE crm_jobs SET status='done' WHERE id=?",args:[Number(job.id)]});}
      catch{await db.execute({sql:"UPDATE crm_jobs SET status='failed',error='Error procesando la conversación' WHERE id=?",args:[Number(job.id)]});await transfer(Number(job.conversation_id),'No se pudo procesar la consulta; revisar la conversación');}
    }));
    if(results.some(r=>r.status==='rejected'))console.error('[atencion] No se pudo completar una tarea de la cola');
    const outbound=(await db.execute({sql:"SELECT * FROM crm_outbox WHERE id IN(SELECT MIN(id) FROM crm_outbox WHERE status='pending' AND ready_at<=? GROUP BY conversation_id) ORDER BY id LIMIT 4",args:[nowIso()]})).rows;
    const deliveries=await Promise.allSettled(outbound.map(deliver));
    if(deliveries.some(r=>r.status==='rejected'))console.error('[atencion] No se pudo completar una entrega de la cola');
    await processMedia();
    if(Date.now()-lastMaintenance>60000){await maintenance();lastMaintenance=Date.now();}
  }finally{running=false;}
}
export async function startWorker(){
  await db.execute('CREATE TABLE IF NOT EXISTS crm_worker_lock(id INTEGER PRIMARY KEY,owner TEXT,expires_at TEXT)');
  await db.execute("INSERT INTO crm_worker_lock(id,owner,expires_at) VALUES(1,'','') ON CONFLICT(id) DO NOTHING");
  await recoverStalled();
  if(!timer){timer=setInterval(()=>void tick().catch(()=>console.error('[atencion] error del procesador; revisar diagnóstico')),1000);timer.unref();}
  return timer;
}
export async function stopWorker(timeoutMs=30000){
  if(timer){clearInterval(timer);timer=null;}
  const deadline=Date.now()+timeoutMs;
  while(running&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  if(running)throw new Error('El procesador no terminó dentro del plazo de apagado');
}
