import {db} from '../db';
import {EMPTY_QUALIFICATION,handoffReason,optedOut} from './domain';
import {conversation,BusinessError,nowIso} from './repository';

export function isNewPurchase(text:string):boolean {
  if(optedOut(text)||handoffReason(EMPTY_QUALIFICATION,text))return false;
  return /\b(quiero|quisiera|necesito|busco|buscando|comprar|comprarme|comprarte|comprarles|cotizar|cotizacion|cotización|precio|stock|disponible|venden|ten[eé]s|tienen)\b/i.test(text)&&!/(no quiero comprar|no voy a comprar|ya compr[eé]|compr[eé] ayer|me compr[eé])/i.test(text);
}
export async function snapshotOpportunity(c:any,tx:any=db){
  if(!c.opportunity_id)return;
  await tx.execute({sql:"UPDATE crm_opportunities SET qualification=?,summary=?,score=?,tier=?,reasons=?,owner_id=? WHERE id=? AND status='active'",args:[JSON.stringify(c.qualification),c.summary||'',c.score||0,c.tier||'Por conocer',JSON.stringify(c.reasons||[]),c.owner_id,c.opportunity_id]});
}
export async function openOpportunity(id:number,reason:string,actor:number|null=null,tx:any=db){
  const c=await conversation(id,tx);
  if(c.opt_out)throw new BusinessError('El contacto pidió la baja');
  if(c.status==='active')return c.opportunity_id;
  const time=nowIso();
  const r=await tx.execute({sql:'INSERT INTO crm_opportunities(conversation_id,created_at,owner_id,opening_reason) VALUES(?,?,?,?)',args:[id,time,c.owner_id,reason.slice(0,1000)]});
  await tx.execute({sql:"UPDATE crm_conversations SET opportunity_id=?,status='active',mode='auto',score=0,tier='Por conocer',reasons='[]',handoff_reason=NULL,qualification=?,summary='',followup_attempts=0,followup_optin=0,consent_evidence=NULL,archived_at=NULL,next_action_at=NULL,next_action_note=NULL,updated_at=? WHERE id=?",args:[Number(r.lastInsertRowid),JSON.stringify(EMPTY_QUALIFICATION),time,id]});
  if(c.lead_id)await tx.execute({sql:"UPDATE leads SET estado='Nuevo' WHERE id=?",args:[c.lead_id]});
  await tx.execute({sql:"INSERT INTO crm_events(conversation_id,actor_id,type,detail,created_at) VALUES(?,?,'opportunity_opened',?,?)",args:[id,actor,reason.slice(0,1000),time]});
  return Number(r.lastInsertRowid);
}
export async function commercialMemory(c:any,viewer?:{id:number;rol:string}){
  // No revela canales de otro vendedor aunque compartan identidad verificada.
  const own=viewer?.rol==='closer'?' AND c.owner_id=?':'';
  const args:any[]=[c.contact_id,c.sandbox];if(own)args.push(viewer!.id);
  const history=(await db.execute({sql:`SELECT o.id,o.status,o.created_at,o.closed_at,o.loss_reason,o.sale_id,o.summary,o.score,o.tier,o.qualification,o.owner_id,c.channel,c.id AS conversation_id FROM crm_opportunities o JOIN crm_conversations c ON c.id=o.conversation_id WHERE c.contact_id=? AND c.sandbox=? ${own} ORDER BY o.id DESC LIMIT 21`,args})).rows;
  const notes=(await db.execute({sql:`SELECT n.id,n.text,n.created_at,n.actor_id FROM crm_contact_notes n JOIN crm_conversations c ON c.id=n.conversation_id WHERE c.contact_id=? AND c.sandbox=? ${own} ORDER BY n.id DESC LIMIT 20`,args})).rows;
  const channels=(await db.execute({sql:`SELECT c.id,c.channel,c.owner_id,c.status FROM crm_conversations c WHERE c.contact_id=? AND c.sandbox=? ${own} ORDER BY c.id`,args})).rows;
  return {opportunities:history.slice(0,20).map(o=>({...o,qualification:JSON.parse(String(o.qualification||'{}'))})),hasMore:history.length>20,notes,channels,verifiedReturning:!!c.verified_returning};
}
export async function mergeContacts(sourceConversation:number,targetConversation:number,evidence:string,actor:number){
  if(evidence.trim().length<15)throw new BusinessError('Explicá cómo verificaste que ambos canales pertenecen a la misma persona');
  const tx=await db.transaction('write');try{
    const source=await conversation(sourceConversation,tx),target=await conversation(targetConversation,tx);
    if(source.sandbox!==target.sandbox)throw new BusinessError('No se pueden vincular datos de prueba con datos reales');
    if(source.contact_id===target.contact_id){await tx.rollback();return {contactId:target.contact_id,alreadyLinked:true};}
    if(source.customer_id&&target.customer_id&&source.customer_id!==target.customer_id)throw new BusinessError('Hay dos clientes de ventas distintos. Revisá las identidades antes de vincular.');
    const customer=target.customer_id||source.customer_id,returned=Number(!!(source.verified_returning||target.verified_returning)),stop=Number(!!(source.opt_out||target.opt_out));
    await tx.execute({sql:'UPDATE crm_contacts SET customer_id=?,verified_returning=?,opt_out=?,phone=COALESCE(phone,?) WHERE id=?',args:[customer,returned,stop,source.phone,target.contact_id]});
    await tx.execute({sql:'UPDATE crm_conversations SET contact_id=?,owner_id=? WHERE contact_id=?',args:[target.contact_id,target.owner_id,source.contact_id]});
    await tx.execute({sql:'UPDATE leads SET closer_asignado_id=? WHERE id IN(SELECT lead_id FROM crm_conversations WHERE contact_id=?)',args:[target.owner_id,target.contact_id]});
    if(stop){
      await tx.execute({sql:"UPDATE crm_conversations SET status='optout',mode='human',followup_optin=0 WHERE contact_id=?",args:[target.contact_id]});
      await tx.execute({sql:"UPDATE crm_messages SET delivery='cancelled' WHERE id IN(SELECT message_id FROM crm_outbox WHERE status='pending' AND conversation_id IN(SELECT id FROM crm_conversations WHERE contact_id=?))",args:[target.contact_id]});
      await tx.execute({sql:"UPDATE crm_outbox SET status='cancelled' WHERE status='pending' AND conversation_id IN(SELECT id FROM crm_conversations WHERE contact_id=?)",args:[target.contact_id]});
    }
    await tx.execute({sql:'INSERT INTO crm_identity_links(source_contact_id,target_contact_id,actor_id,evidence,created_at) VALUES(?,?,?,?,?)',args:[source.contact_id,target.contact_id,actor,evidence.slice(0,1500),nowIso()]});
    for(const id of [source.id,target.id])await tx.execute({sql:"INSERT INTO crm_events(conversation_id,actor_id,type,detail,created_at) VALUES(?,?,'identity_verified',?,?)",args:[id,actor,`Canales vinculados con verificación: ${evidence.slice(0,1000)}`,nowIso()]});
    await tx.commit();return {contactId:target.contact_id};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
export async function messagePage(id:number,before?:number,after?:number){
  const r=(await db.execute({sql:`SELECT id,conversation_id,direction,author,text,kind,delivery,created_at,opportunity_id FROM crm_messages WHERE conversation_id=? ${before?'AND id<?':after?'AND id>?':''} ORDER BY id ${after?'ASC':'DESC'} LIMIT 51`,args:before?[id,before]:after?[id,after]:[id]})).rows;
  const rows=after?r.slice(0,50):r.slice(0,50).reverse();
  const ids=rows.map(m=>Number(m.id));
  const attachments=ids.length?(await db.execute({sql:`SELECT id,message_id,mime,name,status,size_bytes,error,transcript,transcribed_at,transcription_status FROM crm_attachments WHERE message_id IN(${ids.map(()=>'?').join(',')}) ORDER BY id`,args:ids})).rows:[];
  const messages=rows.map(m=>({...m,attachments:attachments.filter(a=>Number(a.message_id)===Number(m.id))}));
  return {messages,hasMore:r.length>50,before:rows.length?Number(rows[0].id):null,after:rows.length?Number(rows[rows.length-1].id):after||null};
}
