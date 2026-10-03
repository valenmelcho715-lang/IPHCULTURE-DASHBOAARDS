import {storageStatus,runBackup} from './storage';
import {attachmentPath} from './media';
import {commercialMemory,messagePage,mergeContacts,openOpportunity,snapshotOpportunity} from './history';
import crypto from 'node:crypto';
import {Router,Request,Response,NextFunction} from 'express';
import {db} from '../db';
import {authRequired,requireRole,AuthRequest} from '../auth';
import {settings,event} from './schema';
import {validateSettings,windowOpen} from './domain';
import {connectionStatus} from './meta';
import {receive,conversation,enqueueReply,transfer,BusinessError,nowIso} from './repository';
import {quote,stockAvailable,createReservation,confirmDeposit,completeSale,slots} from './commerce';
import {processJob} from './engine';
import {transcribeAttachment} from './transcription';
export const automationRouter=Router();automationRouter.use(authRequired);
const wrap=(fn:(req:AuthRequest,res:Response)=>Promise<any>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req as AuthRequest,res).catch(next);};
async function access(req:AuthRequest,id=Number(req.params.id)){
  if(!Number.isInteger(id)||id<1)throw new BusinessError('Identificador inválido');
  const c=await conversation(id);if(req.user!.rol==='closer'&&Number(c.owner_id)!==req.user!.id)throw new BusinessError('Esta conversación está asignada a otro closer',403);return c;
}
const scope=(req:AuthRequest,alias='c')=>req.user!.rol==='closer'?`${alias}.owner_id=${Number(req.user!.id)}`:'1=1';
automationRouter.get('/storage',requireRole('admin'),wrap(async(_req,res)=>res.json(await storageStatus())));
automationRouter.post('/storage/backup',requireRole('admin'),wrap(async(_req,res)=>{void runBackup().catch(()=>console.error('[backup] Revisar estado del respaldo'));res.status(202).json({queued:true});}));
automationRouter.get('/status',wrap(async(req,res)=>{const s=await settings();res.json({connections:connectionStatus(),settings:req.user!.rol==='admin'?s:{enabled:s.enabled,usdArs:s.usdArs,maxFollowups:s.maxFollowups}});}));
automationRouter.put('/settings',requireRole('admin'),wrap(async(req,res)=>{
  let value;try{value=validateSettings(req.body,await settings());}catch(e){throw new BusinessError((e as Error).message);}
  if(value.enabled&&!connectionStatus().openai)throw new BusinessError('Conectá la IA antes de activar la atención en vivo');
  if(value.enabled&&process.env.NODE_ENV==='production'){const storage=await storageStatus();if(!storage.persistentVolumeDeclared||!storage.runs.some(r=>r.status==='external_ok'))throw new BusinessError('Antes de activar atención real, configurar persistencia y completar una copia externa verificada');}
  const users=(await db.execute("SELECT id FROM users WHERE rol='closer'")).rows.map(x=>Number(x.id));
  if(value.closerIds.some(x=>!users.includes(x)))throw new BusinessError('Seleccioná usuarios con rol closer');
  await db.execute({sql:'UPDATE crm_settings SET value=? WHERE id=1',args:[JSON.stringify(value)]});await event(null,'settings_updated','Configuración de Atención IA actualizada',req.user!.id);res.json(value);
}));
automationRouter.get('/team',wrap(async(_req,res)=>res.json((await db.execute("SELECT id,nombre,rol FROM users WHERE rol IN('closer','admin','oficina') ORDER BY nombre")).rows)));
automationRouter.get('/stock',wrap(async(_req,res)=>res.json(await stockAvailable())));
automationRouter.get('/conversations',wrap(async(req,res)=>{
  const sandbox=req.query.sandbox==='1'?1:0;
  const page=Math.max(0,Math.min(100000,Math.floor(Number(req.query.page)||0))),pageSize=100;
  const where=[scope(req),'c.sandbox=?'];if(req.query.archived==='1')where.push('c.archived_at IS NOT NULL');else where.push('c.archived_at IS NULL');const args:any[]=[sandbox];
  if(['whatsapp','instagram'].includes(String(req.query.channel))){where.push('c.channel=?');args.push(String(req.query.channel));}
  const priority=String(req.query.priority||'');
  if(priority==='human')where.push("c.mode='human' AND c.status='active'");
  else if(priority==='due')where.push("c.next_action_at IS NOT NULL AND c.next_action_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  else if(priority==='hot')where.push("c.score>=65 AND c.status='active'");
  else if(['active','won','lost','optout'].includes(priority)){where.push('c.status=?');args.push(priority);}
  const search=String(req.query.search||'').trim().slice(0,150);
  if(search){where.push("(p.name LIKE ? ESCAPE '\\' OR p.phone LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\' OR c.qualification LIKE ? ESCAPE '\\')");const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';args.push(pattern,pattern,pattern,pattern);}
  const total=Number((await db.execute({sql:`SELECT COUNT(*) AS n FROM crm_conversations c JOIN crm_contacts p ON p.id=c.contact_id WHERE ${where.join(' AND ')}`,args})).rows[0].n);
  const list=await db.execute({sql:`SELECT c.*,p.name,p.phone,p.verified_returning,p.opt_out,u.nombre AS owner_name,
   (SELECT text FROM crm_messages m WHERE m.conversation_id=c.id ORDER BY id DESC LIMIT 1) AS last_message
   FROM crm_conversations c JOIN crm_contacts p ON p.id=c.contact_id LEFT JOIN users u ON u.id=c.owner_id
   WHERE ${where.join(' AND ')} ORDER BY CASE WHEN c.mode='human' AND c.status='active' THEN 0 ELSE 1 END,c.score DESC,c.updated_at DESC,c.id DESC LIMIT ? OFFSET ?`,args:[...args,pageSize,page*pageSize]});
  res.json({items:list.rows.map(r=>({...r,qualification:JSON.parse(String(r.qualification)),reasons:JSON.parse(String(r.reasons))})),total,page,pageSize,hasMore:(page+1)*pageSize<total});
}));
automationRouter.get('/metrics',wrap(async(req,res)=>{
  const sandbox=req.query.sandbox==='1'?1:0;const c=`${scope(req)} AND c.sandbox=${sandbox}`;
  const stats=(await db.execute(`SELECT COUNT(*) AS conversations,COUNT(DISTINCT c.contact_id) AS contacts,SUM(CASE WHEN c.status='won' THEN 1 ELSE 0 END) AS won,SUM(CASE WHEN c.status='lost' THEN 1 ELSE 0 END) AS lost,SUM(CASE WHEN c.mode='human' AND c.status='active' THEN 1 ELSE 0 END) AS human,SUM(CASE WHEN c.status='active' AND c.last_inbound<strftime('%Y-%m-%dT%H:%M:%fZ','now','-48 hours') THEN 1 ELSE 0 END) AS recoverable FROM crm_conversations c WHERE ${c}`)).rows[0];
  const opportunityStats=(await db.execute(`SELECT COUNT(*) AS opportunities,SUM(CASE WHEN o.status='won' THEN 1 ELSE 0 END) AS won,SUM(CASE WHEN o.status='lost' THEN 1 ELSE 0 END) AS lost FROM crm_opportunities o JOIN crm_conversations c ON c.id=o.conversation_id WHERE ${c}`)).rows[0];
  Object.assign(stats,{won:opportunityStats.won||0,lost:opportunityStats.lost||0,opportunities:opportunityStats.opportunities||0});
  const messages=(await db.execute(`SELECT m.direction,COUNT(*) AS n FROM crm_messages m JOIN crm_conversations c ON c.id=m.conversation_id WHERE ${c} GROUP BY m.direction`)).rows;
  const assignments=(await db.execute(`SELECT COALESCE(u.nombre,'Sin asignar') AS name,COUNT(*) AS n FROM crm_conversations c LEFT JOIN users u ON u.id=c.owner_id WHERE ${c} GROUP BY c.owner_id`)).rows;
  const failures=(await db.execute(`SELECT COUNT(*) AS n FROM crm_outbox o JOIN crm_conversations c ON c.id=o.conversation_id WHERE ${c} AND o.status IN('uncertain','failed','blocked')`)).rows[0];
  const usage=req.user!.rol==='admin'?(await db.execute("SELECT COALESCE(SUM(estimated_usd),0) AS estimated_usd,COALESCE(SUM(input_tokens+output_tokens),0) AS tokens FROM crm_usage WHERE created_at>=strftime('%Y-%m-01T00:00:00.000Z','now')")).rows[0]:null;
  res.json({stats,messages,assignments,failures:Number(failures.n),usage,conversion:Number(stats.opportunities)?Math.round(Number(stats.won)*10000/Number(stats.opportunities))/100:0});
}));
automationRouter.get('/conversations/:id',wrap(async(req,res)=>{
  const c=await access(req);const result=await Promise.all([
    messagePage(c.id),
    db.execute({sql:'SELECT * FROM crm_events WHERE conversation_id=? ORDER BY id DESC LIMIT 60',args:[c.id]}),
    db.execute({sql:'SELECT * FROM crm_quotes WHERE conversation_id=? ORDER BY id DESC LIMIT 10',args:[c.id]}),
    db.execute({sql:'SELECT * FROM crm_reservations WHERE conversation_id=? ORDER BY id DESC',args:[c.id]}),
    db.execute({sql:"SELECT o.id,o.status,o.error,o.message_id FROM crm_outbox o WHERE conversation_id=? AND status IN('failed','blocked','uncertain')",args:[c.id]})
  ]);res.json({conversation:c,messages:result[0].messages,messagePage:{hasMore:result[0].hasMore,before:result[0].before},memory:await commercialMemory(c,req.user),events:result[1].rows,quotes:result[2].rows.map(r=>({...r,detail:JSON.parse(String(r.detail))})),reservations:result[3].rows,outboxIssues:result[4].rows});
}));
automationRouter.get('/attachments/:attachmentId',wrap(async(req,res)=>{
  const a=(await db.execute({sql:'SELECT * FROM crm_attachments WHERE id=?',args:[Number(req.params.attachmentId)]})).rows[0];if(!a)throw new BusinessError('Adjunto inexistente',404);
  await access(req,Number(a.conversation_id));if(a.status!=='stored')throw new BusinessError('El adjunto todavía no está disponible',409);
  const mime=String(a.mime||'application/octet-stream');const inline=/^(image\/(jpeg|png|webp|gif)|audio\/(mpeg|ogg|mp4|aac|wav|webm)|video\/(mp4|webm))$/.test(mime);
  res.setHeader('Content-Type',inline?mime:'application/octet-stream');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="adjunto-${a.id}"`);
  res.sendFile(attachmentPath(String(a.storage_key)),err=>{if(err&&!res.headersSent)res.status(404).json({error:'Archivo no disponible; revisar respaldo'});});
}));
automationRouter.post('/attachments/:attachmentId/transcribe',wrap(async(req,res)=>{
  const a=(await db.execute({sql:'SELECT id,conversation_id FROM crm_attachments WHERE id=?',args:[Number(req.params.attachmentId)]})).rows[0];
  if(!a)throw new BusinessError('Adjunto inexistente',404);await access(req,Number(a.conversation_id));
  res.json({text:await transcribeAttachment(Number(a.id))});
}));
automationRouter.get('/conversations/:id/messages',wrap(async(req,res)=>{
  const c=await access(req);const before=req.query.before?Number(req.query.before):undefined,after=req.query.after?Number(req.query.after):undefined;
  if((before!==undefined)===(after!==undefined)||![before??after].every(n=>Number.isInteger(n)&&Number(n)>0))throw new BusinessError('Cursor de historial inválido');
  res.json(await messagePage(c.id,before,after));
}));
automationRouter.get('/conversations/:id/history',wrap(async(req,res)=>{
  const c=await access(req),before=Number(req.query.before);
  if(!Number.isInteger(before)||before<1)throw new BusinessError('Cursor de oportunidades inválido');
  const rows=(await db.execute({sql:`SELECT o.*,c.channel,c.id AS conversation_id FROM crm_opportunities o JOIN crm_conversations c ON c.id=o.conversation_id WHERE c.contact_id=? AND c.sandbox=? AND o.id<? AND ${scope(req)} ORDER BY o.id DESC LIMIT 21`,args:[c.contact_id,c.sandbox,before]})).rows;
  res.json({items:rows.slice(0,20).map(o=>({...o,qualification:JSON.parse(String(o.qualification||'{}'))})),hasMore:rows.length>20});
}));
automationRouter.post('/conversations/:id/note',wrap(async(req,res)=>{
  const c=await access(req),text=String(req.body.text||'').trim();
  if(text.length<3||text.length>1500)throw new BusinessError('Escribí una nota de 3 a 1500 caracteres');
  await db.execute({sql:'INSERT INTO crm_contact_notes(conversation_id,text,actor_id,created_at) VALUES(?,?,?,?)',args:[c.id,text,req.user!.id,nowIso()]});res.json({ok:true});
}));
automationRouter.post('/conversations/:id/next-action',wrap(async(req,res)=>{
  const c=await access(req),at=req.body.at?new Date(String(req.body.at)):null,note=String(req.body.note||'').trim();
  if(at&&(!Number.isFinite(at.getTime())||at.getTime()<=Date.now()||note.length<3||note.length>1000))throw new BusinessError('Indicá una fecha futura y el motivo para retomarlo');
  if(c.opt_out)throw new BusinessError('El contacto pidió no recibir mensajes');
  await db.execute({sql:'UPDATE crm_conversations SET next_action_at=?,next_action_note=?,next_action_notified=NULL,archived_at=NULL WHERE id=?',args:[at?.toISOString()||null,at?note:null,c.id]});
  await event(c.id,'next_action',at?`Retomar ${at.toISOString()}: ${note}`:'Próxima acción completada',req.user!.id);res.json({ok:true});
}));
automationRouter.post('/conversations/:id/archive',wrap(async(req,res)=>{
  const c=await access(req);await db.execute({sql:'UPDATE crm_conversations SET archived_at=? WHERE id=?',args:[req.body.archived?nowIso():null,c.id]});
  await event(c.id,'archive',req.body.archived?'Archivada: conserva historial y detiene seguimiento automático':'Conversación desarchivada',req.user!.id);res.json({ok:true});
}));
automationRouter.post('/conversations/:id/new-opportunity',wrap(async(req,res)=>{
  const c=await access(req),reason=String(req.body.reason||'').trim();if(reason.length<5)throw new BusinessError('Indicá la nueva intención de compra');
  const tx=await db.transaction('write');try{const id=await openOpportunity(c.id,reason,req.user!.id,tx);await tx.commit();res.json({id});}catch(e){await tx.rollback();throw e;}finally{tx.close();}
}));
automationRouter.post('/conversations/:id/link-channel',requireRole('admin'),wrap(async(req,res)=>{
  const c=await access(req);res.json(await mergeContacts(c.id,Number(req.body.targetConversation),String(req.body.evidence||''),req.user!.id));
}));
automationRouter.get('/conversations/:id/export',requireRole('admin'),wrap(async(req,res)=>{
  const c=await access(req);res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Content-Disposition',`attachment; filename="cliente-${c.contact_id}.ndjson"`);res.setHeader('Cache-Control','no-store');
  const write=async(value:any)=>{if(res.destroyed)throw new Error('Exportación cancelada');if(!res.write(JSON.stringify(value)+'\n'))await new Promise<void>((resolve,reject)=>{const done=()=>{res.off('close',closed);resolve();};const closed=()=>{res.off('drain',done);reject(new Error('Conexión cerrada'));};res.once('drain',done);res.once('close',closed);});};
  await write({type:'contact',id:c.contact_id,name:c.name,phone:c.phone,verifiedReturning:!!c.verified_returning});
  for(const [type,table,join] of [['conversation','crm_conversations','t'],['message','crm_messages','c'],['opportunity','crm_opportunities','c'],['note','crm_contact_notes','c'],['event','crm_events','c']] as const){
    let cursor=0;while(!res.destroyed){const rows=(await db.execute({sql:`SELECT t.* FROM ${table} t ${join==='c'?'JOIN crm_conversations c ON c.id=t.conversation_id':''} WHERE ${join}.contact_id=? AND ${join}.sandbox=? AND t.id>? ORDER BY t.id LIMIT 500`,args:[c.contact_id,c.sandbox,cursor]})).rows;
      if(!rows.length)break;for(const row of rows)await write({type,...row});cursor=Number(rows[rows.length-1].id);
    }
  }
  res.end();await event(c.id,'export','Historial exportado por administración',req.user!.id);
}));
automationRouter.post('/simulate',requireRole('admin'),wrap(async(req,res)=>{
  const text=String(req.body.text||'').trim();if(!text||text.length>8000)throw new BusinessError('Escribí un mensaje de hasta 8000 caracteres');
  let externalId=String(req.body.externalId||crypto.randomUUID());const channel=req.body.channel==='instagram'?'instagram':'whatsapp';
  if(req.body.conversationId){const c=await access(req,Number(req.body.conversationId));if(!c.sandbox)throw new BusinessError('Solo se puede simular sobre conversaciones de prueba');externalId=c.external_id;}
  const received=await receive({channel,externalId,providerId:crypto.randomUUID(),name:String(req.body.name||'Cliente de prueba').slice(0,100),text,sandbox:true});
  if(received.messageId){
    await db.execute({sql:"UPDATE crm_jobs SET status='processing',leased_at=? WHERE message_id=?",args:[nowIso(),received.messageId]});
    try{await processJob({conversation_id:received.id,message_id:received.messageId});await db.execute({sql:"UPDATE crm_jobs SET status='done' WHERE message_id=?",args:[received.messageId]});}
    catch(e){await db.execute({sql:"UPDATE crm_jobs SET status='failed',error='Falló la simulación' WHERE message_id=?",args:[received.messageId]});throw e;}
  }
  res.json(received);
}));
automationRouter.post('/conversations/:id/message',wrap(async(req,res)=>{
  const c=await access(req);const text=String(req.body.text||'').trim();if(!text||text.length>3000)throw new BusinessError('Escribí un mensaje de hasta 3000 caracteres');
  if(!c.sandbox&&!windowOpen(c.last_inbound))throw new BusinessError('Terminó la ventana de 24 horas. Esperá una respuesta del cliente o usá una plantilla aprobada.');
  await transfer(c.id,'El closer tomó la conversación',req.user!.id);const id=await enqueueReply(c.id,text,'human');res.json({id,delivery:c.sandbox?'preview':'queued'});
}));
automationRouter.post('/conversations/:id/control',wrap(async(req,res)=>{
  const c=await access(req);if(req.body.mode==='human')await transfer(c.id,'Atención humana solicitada',req.user!.id);
  else if(req.body.mode==='auto'){
    if(c.opt_out||c.status!=='active')throw new BusinessError('La conversación está cerrada o el cliente pidió la baja');
    await db.execute({sql:"UPDATE crm_conversations SET mode='auto',handoff_reason=NULL,qualification=?,updated_at=? WHERE id=?",args:[JSON.stringify({...c.qualification,intent:'question'}),nowIso(),c.id]});await event(c.id,'automation_resumed','Atención automática reanudada',req.user!.id);
  }else throw new BusinessError('Modo inválido');res.json({ok:true});
}));
automationRouter.post('/conversations/:id/assign',requireRole('admin'),wrap(async(req,res)=>{
  const c=await access(req);const uid=Number(req.body.ownerId);if(!(await db.execute({sql:"SELECT id FROM users WHERE id=? AND rol='closer'",args:[uid]})).rows.length)throw new BusinessError('Closer inválido');
  await db.execute({sql:'UPDATE crm_conversations SET owner_id=? WHERE id=?',args:[uid,c.id]});if(c.lead_id)await db.execute({sql:'UPDATE leads SET closer_asignado_id=? WHERE id=?',args:[uid,c.lead_id]});await event(c.id,'reassigned',`Asignado al closer #${uid}`,req.user!.id);res.json({ok:true});
}));
automationRouter.post('/conversations/:id/lost',wrap(async(req,res)=>{
  const c=await access(req);const reason=String(req.body.reason||'').trim();if(reason.length<3)throw new BusinessError('Indicá el motivo de pérdida');
  const tx=await db.transaction('write');try{
    const current=await conversation(c.id,tx);
    if(current.status!=='active')throw new BusinessError('Esta oportunidad ya está cerrada');
    if((await tx.execute({sql:"SELECT id FROM crm_reservations WHERE conversation_id=? AND status='confirmed' LIMIT 1",args:[c.id]})).rows.length)throw new BusinessError('Administración debe resolver la reserva y la seña antes de cerrar como perdida');
    await tx.execute({sql:"UPDATE crm_conversations SET status='lost',mode='human',summary=?,updated_at=? WHERE id=?",args:[reason.slice(0,1000),nowIso(),c.id]});
    await tx.execute({sql:"UPDATE crm_reservations SET status='cancelled' WHERE conversation_id=? AND status='pending'",args:[c.id]});
    if(c.lead_id)await tx.execute({sql:"UPDATE leads SET estado='Perdido' WHERE id=?",args:[c.lead_id]});
    await snapshotOpportunity(current,tx);
    await tx.execute({sql:"UPDATE crm_opportunities SET status='lost',closed_at=?,loss_reason=? WHERE id=?",args:[nowIso(),reason.slice(0,1000),current.opportunity_id]});await tx.commit();
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
  await transfer(c.id,'Oportunidad cerrada',req.user!.id);await event(c.id,'lost',reason,req.user!.id);res.json({ok:true});
}));
automationRouter.post('/conversations/:id/returning',requireRole('admin'),wrap(async(req,res)=>{
  const c=await access(req);const customerId=Number(req.body.customerId);const evidence=String(req.body.evidence||'').trim();
  const customer=(await db.execute({sql:'SELECT id,cantidad_compras FROM clientes WHERE id=?',args:[customerId]})).rows[0];
  if(!customer||Number(customer.cantidad_compras)<1||evidence.length<10)throw new BusinessError('Elegí un cliente con compra anterior e indicá cómo verificaste su identidad y compra');
  await db.execute({sql:'UPDATE crm_contacts SET customer_id=?,verified_returning=1 WHERE id=?',args:[customerId,c.contact_id]});await event(c.id,'returning_verified',evidence.slice(0,1000),req.user!.id);res.json({ok:true});
}));
automationRouter.post('/conversations/:id/quote',wrap(async(req,res)=>{const c=await access(req);res.json(await quote(c.id,Number(req.body.stockId),req.user!.rol==='admin'&&!!req.body.discount));}));
automationRouter.get('/conversations/:id/slots',wrap(async(req,res)=>{const c=await access(req);res.json(c.owner_id?await slots(Number(c.owner_id)):[]);}));
automationRouter.post('/conversations/:id/reservation',wrap(async(req,res)=>{const c=await access(req);res.json(await createReservation(c.id,Number(req.body.quoteId)));}));
automationRouter.post('/reservations/:reservationId/confirm',requireRole('admin'),wrap(async(req,res)=>res.json(await confirmDeposit(Number(req.params.reservationId),req.user!.id,Number(req.body.amountUsd),String(req.body.reference||'')))));
automationRouter.post('/reservations/:reservationId/complete',requireRole('admin'),wrap(async(req,res)=>res.json(await completeSale(Number(req.params.reservationId),req.user!.id,Number(req.body.paidTotalUsd)))));
automationRouter.post('/reservations/:reservationId/cancel',requireRole('admin'),wrap(async(req,res)=>{
  const r=(await db.execute({sql:'SELECT * FROM crm_reservations WHERE id=?',args:[Number(req.params.reservationId)]})).rows[0];if(!r||r.status==='sold')throw new BusinessError('No se puede cancelar esta reserva');
  const reason=String(req.body.reason||'').trim();if(reason.length<5)throw new BusinessError('Registrá el motivo y cómo se gestionará la devolución');
  const changed=await db.execute({sql:"UPDATE crm_reservations SET status='cancelled' WHERE id=? AND status IN('pending','confirmed','expired')",args:[Number(r.id)]});
  if(changed.rowsAffected!==1)throw new BusinessError('La reserva cambió mientras la revisabas',409);
  await event(Number(r.conversation_id),'reservation_cancelled',reason,req.user!.id);res.json({ok:true,refundAutomatic:false});
}));
automationRouter.post('/outbox/:outboxId/retry',requireRole('admin'),wrap(async(req,res)=>{
  const id=Number(req.params.outboxId);const r=(await db.execute({sql:'SELECT * FROM crm_outbox WHERE id=?',args:[id]})).rows[0];
  if(!r||!['failed','blocked'].includes(String(r.status)))throw new BusinessError('No se puede reenviar: los envíos inciertos requieren revisar Meta');
  await db.execute({sql:"UPDATE crm_outbox SET status='pending',ready_at=?,attempts=0,error=NULL WHERE id=?",args:[nowIso(),id]});await event(Number(r.conversation_id),'delivery_retry','Reintento solicitado',req.user!.id);res.json({ok:true});
}));
automationRouter.use((err:Error,_req:Request,res:Response,_next:NextFunction)=>{
  if(res.headersSent){res.end();return;}
  if(err instanceof BusinessError)res.status(err.status).json({error:err.message});else{console.error('[atencion] operación fallida');res.status(500).json({error:'No se pudo completar la operación'});}
});
