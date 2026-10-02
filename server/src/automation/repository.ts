import {registerAttachments,IncomingAttachment} from './media';
import {isNewPurchase,openOpportunity} from './history';
import {db} from '../db';
import {settings, event, notifyTeam} from './schema';
import {Channel, EMPTY_QUALIFICATION, normalizePhone, optedOut} from './domain';
export class BusinessError extends Error { constructor(message:string, public status=400){super(message);} }
export const nowIso=()=>new Date().toISOString();
export async function conversation(id:number, tx:any=db):Promise<any> {
  const r=await tx.execute({sql:`SELECT c.*, p.name, p.phone, p.customer_id, p.verified_returning, p.opt_out, u.nombre AS owner_name
    FROM crm_conversations c JOIN crm_contacts p ON p.id=c.contact_id LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=?`,args:[id]});
  if(!r.rows[0]) throw new BusinessError('Conversación no encontrada',404);
  return {...r.rows[0],qualification:JSON.parse(String(r.rows[0].qualification)),reasons:JSON.parse(String(r.rows[0].reasons))};
}
export async function receive(input:{channel:Channel;externalId:string;providerId:string;name?:string;text:string;kind?:string;sandbox?:boolean;timestamp?:string;attachments?:IncomingAttachment[]}) {
  if(!['whatsapp','instagram'].includes(input.channel)||!input.externalId||!input.providerId) throw new BusinessError('Identificador de mensaje inválido');
  if(input.text.length>12000) input.text=input.text.slice(0,12000);
  const s=await settings(); const tx=await db.transaction('write'); const now=nowIso();
  const time=input.timestamp&&Number.isFinite(Date.parse(input.timestamp))&&Date.parse(input.timestamp)<=Date.now()+60000?new Date(input.timestamp).toISOString():now;
  const sandbox=input.sandbox?1:0;
  const providerId=`${input.channel}:${sandbox}:${input.providerId}`;
  try {
    const duplicate=await tx.execute({sql:'SELECT conversation_id FROM crm_messages WHERE provider_id=?',args:[providerId]});
    if(duplicate.rows.length){await tx.rollback();return {id:Number(duplicate.rows[0].conversation_id),duplicate:true};}
    let existing=await tx.execute({sql:'SELECT * FROM crm_conversations WHERE channel=? AND external_id=? AND sandbox=?',args:[input.channel,input.externalId,sandbox]});
    let id:number;let processable=true;
    if(!existing.rows.length){
      const pool=(await tx.execute("SELECT id FROM users WHERE rol='closer' ORDER BY id")).rows.map(x=>Number(x.id)).filter(x=>!s.closerIds.length||s.closerIds.includes(x));
      const counts=(await tx.execute({sql:'SELECT owner_id,COUNT(*) AS n FROM crm_conversations WHERE sandbox=? GROUP BY owner_id',args:[sandbox]})).rows;
      pool.sort((a,b)=>Number(counts.find(x=>Number(x.owner_id)===a)?.n||0)-Number(counts.find(x=>Number(x.owner_id)===b)?.n||0)||a-b);
      let owner=pool[0]??null; let leadId:number|null=null;
      const phone=input.channel==='whatsapp'?normalizePhone(input.externalId):null;
      if(!sandbox){
        const leads=(await tx.execute('SELECT id,telefono,instagram,closer_asignado_id FROM leads')).rows;
        const matches=leads.filter(l=>input.channel==='whatsapp' ? phone && normalizePhone(String(l.telefono||''))===phone : false);
        if(matches.length===1){leadId=Number(matches[0].id);const prior=Number(matches[0].closer_asignado_id);if(pool.includes(prior)) owner=prior;}
        if(!leadId){const l=await tx.execute({sql:'INSERT INTO leads(nombre,telefono,fuente,estado,closer_asignado_id,notas) VALUES(?,?,?,?,?,?)',args:[input.name||'Consulta nueva',phone,input.channel==='whatsapp'?'WhatsApp':'Instagram','Nuevo',owner,'Creado desde Atención IA']});leadId=Number(l.lastInsertRowid);}
      }
      const contact=await tx.execute({sql:'INSERT INTO crm_contacts(name,phone,created_at) VALUES(?,?,?)',args:[input.name||'Consulta nueva',phone,now]});
      const created=await tx.execute({sql:'INSERT INTO crm_conversations(channel,external_id,sandbox,contact_id,lead_id,owner_id,qualification,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',args:[input.channel,input.externalId,sandbox,Number(contact.lastInsertRowid),leadId,owner,JSON.stringify(EMPTY_QUALIFICATION),now,now]});
      id=Number(created.lastInsertRowid);
      const op=await tx.execute({sql:'INSERT INTO crm_opportunities(conversation_id,created_at) VALUES(?,?)',args:[id,now]});
      await tx.execute({sql:'UPDATE crm_conversations SET opportunity_id=? WHERE id=?',args:[Number(op.lastInsertRowid),id]});
    }else {
      id=Number(existing.rows[0].id);
      processable=!existing.rows[0].last_inbound||time>=String(existing.rows[0].last_inbound);
      if(['won','lost'].includes(String(existing.rows[0].status))&&time<String(existing.rows[0].updated_at))processable=false;
      if(processable&&['won','lost'].includes(String(existing.rows[0].status))){
        if(isNewPurchase(input.text))await openOpportunity(id,'Nueva intención de compra expresada por el cliente',null,tx);
        else{
          await tx.execute({sql:"UPDATE crm_conversations SET mode='human',handoff_reason='Mensaje posterior al cierre: revisar sin crear una venta nueva',archived_at=NULL WHERE id=?",args:[id]});
          await tx.execute({sql:"INSERT INTO crm_events(conversation_id,type,detail,created_at) VALUES(?,'post_sale_message','Mensaje recibido después del cierre; no cambia el resultado comercial',?)",args:[id,now]});
        }
      }
    }
    const current=await conversation(id,tx);
    const m=await tx.execute({sql:'INSERT INTO crm_messages(conversation_id,provider_id,direction,author,text,kind,created_at,processable,opportunity_id) VALUES(?,?,?,?,?,?,?,?,?)',args:[id,providerId,'in','customer',input.text,input.kind||'text',time,Number(processable),current.opportunity_id]});
    if(input.attachments?.length)await registerAttachments(Number(m.lastInsertRowid),current,input.attachments,tx);
    // MAX evita que un webhook atrasado vuelva a abrir la ventana de atención.
    if(processable){
      await tx.execute({sql:"UPDATE crm_conversations SET last_inbound=?,updated_at=?,followup_attempts=0,archived_at=NULL,next_action_at=NULL,next_action_note=NULL WHERE id=?",args:[time,now,id]});
      await tx.execute({sql:'INSERT INTO crm_jobs(conversation_id,message_id,ready_at) VALUES(?,?,?)',args:[id,Number(m.lastInsertRowid),new Date(Date.now()+1800).toISOString()]});
    }
    if(optedOut(input.text))await stopContact(id,tx);
    await tx.commit();if(processable&&current.status!=='active')await notifyTeam(id,'Nuevo mensaje en una conversación cerrada; revisar sin alterar la venta',current.owner_id,true);return {id,messageId:Number(m.lastInsertRowid),duplicate:false};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
export async function stopContact(id:number,tx:any=db){
  const c=await conversation(id,tx);
  await tx.execute({sql:'UPDATE crm_contacts SET opt_out=1 WHERE id=?',args:[c.contact_id]});
  await tx.execute({sql:"UPDATE crm_conversations SET status='optout',mode='human',followup_optin=0 WHERE contact_id=?",args:[c.contact_id]});
  await tx.execute({sql:"UPDATE crm_messages SET delivery='cancelled' WHERE id IN(SELECT message_id FROM crm_outbox WHERE conversation_id IN(SELECT id FROM crm_conversations WHERE contact_id=?) AND status='pending')",args:[c.contact_id]});
  await tx.execute({sql:"UPDATE crm_outbox SET status='cancelled' WHERE conversation_id IN(SELECT id FROM crm_conversations WHERE contact_id=?) AND status='pending'",args:[c.contact_id]});
}
export async function enqueueReply(id:number,text:string,author='ai',cause:number|null=null,kind='text',template:string|null=null, tx:any=db) {
  const c=await conversation(id,tx);
  if(c.opt_out) throw new BusinessError('El contacto pidió no recibir mensajes');
  if(cause!=null){const old=await tx.execute({sql:'SELECT message_id FROM crm_outbox WHERE conversation_id=? AND cause_message_id=? AND kind=?',args:[id,cause,kind]});if(old.rows.length)return Number(old.rows[0].message_id);}
  const m=await tx.execute({sql:'INSERT INTO crm_messages(conversation_id,direction,author,text,kind,delivery,created_at,opportunity_id) VALUES(?,?,?,?,?,?,?,?)',args:[id,'out',author,text,kind,c.sandbox?'preview':'queued',nowIso(),c.opportunity_id]});
  const mid=Number(m.lastInsertRowid);
  await tx.execute({sql:'INSERT INTO crm_outbox(message_id,conversation_id,cause_message_id,kind,ready_at,template,status) VALUES(?,?,?,?,?,?,?)',args:[mid,id,cause,kind,nowIso(),template,c.sandbox?'preview':'pending']});
  if(c.sandbox) await tx.execute({sql:'UPDATE crm_conversations SET last_outbound=?,updated_at=? WHERE id=?',args:[nowIso(),nowIso(),id]});
  return mid;
}
export async function transfer(id:number,reason:string,actor:number|null=null) {
  await db.execute({sql:"UPDATE crm_conversations SET mode='human',handoff_reason=?,updated_at=? WHERE id=?",args:[reason,nowIso(),id]});
  await db.execute({sql:"UPDATE crm_messages SET delivery='cancelled' WHERE id IN(SELECT message_id FROM crm_outbox WHERE conversation_id=? AND status='pending') AND author='ai'",args:[id]});
  await db.execute({sql:"UPDATE crm_outbox SET status='cancelled' WHERE conversation_id=? AND status='pending' AND message_id IN(SELECT id FROM crm_messages WHERE author='ai')",args:[id]});
  await event(id,'handoff',reason,actor);
  const c=await conversation(id);await notifyTeam(id,reason,c.owner_id,true);
}
