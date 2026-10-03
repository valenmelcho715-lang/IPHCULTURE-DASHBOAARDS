const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'iphone-culture-tests-'));
process.env.TURSO_DATABASE_URL=`file:${path.join(temporary,'test.db')}`;
process.env.NODE_ENV='test';delete process.env.RESTIC_REPOSITORY;delete process.env.RESTIC_PASSWORD;delete process.env.RESTIC_PASSWORD_FILE;process.env.ALLOW_MEDIA_DOWNLOADS='false';
process.env.AUTO_AI_PROVIDER='demo';process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
delete process.env.OPENAI_API_KEY;delete process.env.BOOTSTRAP_ADMIN_EMAIL;delete process.env.BOOTSTRAP_ADMIN_PASSWORD;delete process.env.DEMO_SEED;
const {db,initDb}=require('../server/dist/db');
const {initAutomation,settings}=require('../server/dist/automation/schema');
const domain=require('../server/dist/automation/domain');
const repo=require('../server/dist/automation/repository');
const commerce=require('../server/dist/automation/commerce');
const {processJob}=require('../server/dist/automation/engine');
const {maintenance,deliver,recoverStalled,alertSilentHighIntent}=require('../server/dist/automation/worker');
const intelligence=require('../server/dist/automation/intelligence');
const responseCopy=require('../server/dist/automation/response-copy');
const {metaRouter,validSignature,sendMeta}=require('../server/dist/automation/meta');
const {signToken}=require('../server/dist/auth');
const express=require('express');let server,base,users={},stockId;
const realFetch=global.fetch;
// Red externa bloqueada: los conectores solo pueden usar mocks explícitos.
const offlineFetch=async()=>{throw new Error('Red externa bloqueada durante las pruebas');};
global.fetch=offlineFetch;
const token=role=>signToken(users[role]);
async function request(url,role='admin',method='GET',body){
  const response=await realFetch(base+url,{method,headers:{Authorization:`Bearer ${token(role)}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
async function input(text,extra={}){return repo.receive({channel:'whatsapp',externalId:crypto.randomUUID(),providerId:crypto.randomUUID(),name:'Persona ficticia',text,sandbox:true,...extra});}
async function processInput(r){await processJob({conversation_id:r.id,message_id:r.messageId});}
async function config(change){const s={...await settings(),...change};await db.execute({sql:'UPDATE crm_settings SET value=? WHERE id=1',args:[JSON.stringify(s)]});}
before(async()=>{
  await initDb();await initAutomation();
  for(const [key,rol] of [['admin','admin'],['closerA','closer'],['closerB','closer'],['office','oficina']]){
    const r=await db.execute({sql:'INSERT INTO users(nombre,email,password_hash,rol) VALUES(?,?,?,?)',args:[key,`${key}@example.test`,'not-a-login-hash',rol]});users[key]={id:Number(r.lastInsertRowid),nombre:key,email:`${key}@example.test`,rol};
  }
  const stock=await db.execute({sql:'INSERT INTO stock(producto,modelo,capacidad,color,condicion,precio_costo_usd,precio_venta_usd,cantidad,categoria,battery_pct,warranty_months) VALUES(?,?,?,?,?,?,?,?,?,?,?)',args:['iPhone','iPhone 13','128GB','Negro','Seminuevo',400,600,1,'iPhone',91,3]});stockId=Number(stock.lastInsertRowid);
  const app=express();app.use(express.json({verify:(req,res,b)=>{req.rawBody=Buffer.from(b);}}));
  app.use('/api/integrations/meta',metaRouter);
  app.use('/api/atencion',require('../server/dist/automation/routes').automationRouter);
  app.use('/api/stock',require('../server/dist/routes/stock').default);
  app.use('/api/comprobante',require('../server/dist/routes/facturas').publicRouter);
  app.use('/api/ventas',require('../server/dist/routes/ventas').default);
  app.use('/api/turnos',require('../server/dist/routes/turnos').default);
  app.use('/api/reportes',require('../server/dist/routes/mejoras').default);
  server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{global.fetch=offlineFetch;await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(temporary,{recursive:true,force:true});});
test('La base vacía no incorpora productos o credenciales de ejemplo',async()=>{
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM catalogo')).rows[0].n),0);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM users')).rows[0].n),4);
});
test('Cuotas reproducen el PDF comercial y la cotización indicada por el dueño',async()=>{
  const fees=(await db.execute('SELECT * FROM cuotas_fees WHERE cuotas=12')).rows[0];
  assert.deepEqual(domain.finance(1000,1680,fees),{cuotas:12,totalArs:2792990.14,cuotaArs:232749.18,fx:1680});
});
test('Beneficios: 20 general, 30 recompra, 50 solo cuando se configura acumulación',async()=>{
  const s=await settings();assert.equal(domain.discountFor(s,false,true),20);assert.equal(domain.discountFor(s,true,true),30);assert.equal(domain.discountFor({...s,stackReturningDiscount:true},true,true),50);
});
test('Canje exige batería y revisión de estado; respeta la deducción Android vigente',async()=>{
  const s=await settings();const q={...domain.EMPTY_QUALIFICATION,tradeBrand:'iPhone',tradeModel:'iPhone 13',tradeStorage:'Base',tradeCondition:'Excelente',tradeRepaired:false,tradeInternalOk:true};
  assert.match(commerce.tradeValue(q,s).question,/batería/);q.tradeBattery=90;assert.equal(commerce.tradeValue(q,s).value,180);
  assert.equal(commerce.tradeValue({...q,tradeBrand:'Samsung',tradeModel:'Galaxy S23',tradeStorage:'256 GB',tradeCondition:'Detalles leves'},s).value,215);
  assert.equal(commerce.tradeValue({...q,tradeRepaired:true},s).manual,true);
});
test('El puntaje usa datos de compra y no castiga la demora al responder',()=>{
  const q={...domain.EMPTY_QUALIFICATION,product:'iPhone 13',budgetUsd:600,payment:'Efectivo',timeframe:'today'};
  assert.equal(domain.qualify(q).score,75);assert.ok(domain.qualify(q).reasons.includes('Quiere comprar hoy'));
});
test('El modo demo reconoce presupuesto con preposición y separa el equipo de canje',()=>{
  const budget=intelligence.demoExtract('Tengo presupuesto de USD 800 y busco un iPhone 14.',domain.EMPTY_QUALIFICATION);
  assert.equal(budget.budgetUsd,800);assert.match(budget.product,/iPhone 14/i);assert.equal(budget.intent,'buy');
  const trade=intelligence.demoExtract('Entrego un iPhone 12 de 128 GB, batería 85 y detalles leves.',domain.EMPTY_QUALIFICATION);
  assert.equal(trade.intent,'trade_in');assert.equal(trade.product,null);assert.equal(trade.tradeModel,'iPhone 12');assert.equal(trade.tradeBrand,'iPhone');assert.equal(trade.tradeBattery,85);assert.equal(trade.tradeCondition,'Detalles leves');
});
test('No entrega costos a closers ni oficina aunque soliciten la API directamente',async()=>{
  for(const role of ['closerA','office']){const r=await request('/api/stock',role);assert.equal(r.status,200);assert.equal('precio_costo_usd' in r.body[0],false);}
  assert.equal((await request('/api/stock','admin')).body[0].precio_costo_usd,400);
});
test('Un rol antiguo en el token no otorga permisos de administrador',async()=>{
  const forgedRole=signToken({...users.closerA,rol:'admin'});
  const response=await realFetch(base+'/api/atencion/settings',{method:'PUT',headers:{Authorization:`Bearer ${forgedRole}`,'Content-Type':'application/json'},body:JSON.stringify(await settings())});assert.equal(response.status,403);
});
test('Solo administración puede registrar dinero ingresado en ventas existentes',async()=>{
  const body={producto:'Equipo de prueba',precio_venta_usd:100,pago_completo:1,monto_senado_usd:100,falta_pagar_usd:0};
  assert.equal((await request('/api/ventas','closerA','POST',body)).status,403);
  const created=await request('/api/ventas','closerA','POST',{...body,pago_completo:0,monto_senado_usd:0,falta_pagar_usd:100});assert.equal(created.status,201);
  assert.equal((await request(`/api/ventas/${created.body.venta.id}`,'office','PUT',{pago_completo:1,monto_senado_usd:100,falta_pagar_usd:0})).status,403);
  assert.equal((await request(`/api/ventas/${created.body.venta.id}`,'admin','PUT',{pago_completo:1})).status,400);
});
test('Webhook duplicado no crea otro mensaje, lead ni asignación',async()=>{
  const providerId=crypto.randomUUID(),externalId=crypto.randomUUID();const a=await input('Hola',{externalId,providerId});const b=await input('Hola',{externalId,providerId});assert.equal(a.id,b.id);assert.equal(b.duplicate,true);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_messages WHERE conversation_id=?',args:[a.id]})).rows[0].n),1);
});
test('500 contactos se distribuyen con una diferencia máxima de una conversación',async()=>{
  for(let i=0;i<500;i++)await input('Consulta de carga sintética');
  const counts=(await db.execute('SELECT owner_id,COUNT(*) AS n FROM crm_conversations WHERE sandbox=1 GROUP BY owner_id')).rows;
  assert.equal(counts.length,2);assert.ok(Math.abs(Number(counts[0].n)-Number(counts[1].n))<=1);
});
test('Respuesta automática cotiza desde Stock y deja trazabilidad',async()=>{
  const r=await input('Quiero iPhone 13, tengo USD 600, efectivo y compro hoy');await processInput(r);
  const c=await repo.conversation(r.id);assert.equal(c.score,75);assert.equal(c.mode,'auto');
  const out=(await db.execute({sql:"SELECT text,delivery FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[r.id]})).rows[0];assert.match(out.text,/USD 600/);assert.equal(out.delivery,'preview');
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_quotes WHERE conversation_id=?',args:[r.id]})).rows[0].n),1);
});
test('El tono social es breve y no confunde un agradecimiento con otra compra',async()=>{
  assert.match(responseCopy.courtesyReply('Hola!!'),/¿Cómo estás\?.*asistente virtual.*Contame/);
  assert.match(responseCopy.courtesyReply('Muchas gracias.'),/De nada/);
  assert.equal(responseCopy.courtesyReply('Gracias, quiero un iPhone 13'),null);
  const externalId=crypto.randomUUID();
  const first=await input('Quiero un iPhone 13 en efectivo',{externalId});await processInput(first);
  const thanks=await input('Muchas gracias',{externalId});await processInput(thanks);
  const messages=(await db.execute({sql:"SELECT text FROM crm_messages WHERE conversation_id=? AND direction='out' ORDER BY id",args:[first.id]})).rows;
  assert.equal(messages.length,2);assert.match(messages[1].text,/De nada/);assert.doesNotMatch(messages[1].text,/USD|cotizaci[oó]n/i);
});
test('Una foto del stock solo se prepara cuando el cliente la pide',async()=>{
  await db.execute({sql:'UPDATE stock SET image_url=? WHERE id=?',args:['https://cdn.example.test/iphone-13.jpg',stockId]});
  const requested=await input('Quiero una foto del iPhone 13');await processInput(requested);
  const out=(await db.execute({sql:"SELECT m.kind,m.text,o.template FROM crm_messages m JOIN crm_outbox o ON o.message_id=m.id WHERE m.conversation_id=? AND m.direction='out' ORDER BY m.id",args:[requested.id]})).rows;
  assert.equal(out.length,2);assert.equal(out[0].kind,'image');assert.equal(JSON.parse(String(out[0].template)).url,'https://cdn.example.test/iphone-13.jpg');assert.equal(out[1].kind,'text');
  const notRequested=await input('Quiero un iPhone 13');await processInput(notRequested);
  const kinds=(await db.execute({sql:"SELECT kind FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[notRequested.id]})).rows.map(x=>x.kind);
  assert.deepEqual(kinds,['text']);
});
test('Meta recibe la foto como imagen y nunca desde una simulación',async()=>{
  const previous={allow:process.env.ALLOW_LIVE_MESSAGES,version:process.env.META_GRAPH_VERSION,token:process.env.WHATSAPP_ACCESS_TOKEN,phone:process.env.WHATSAPP_PHONE_NUMBER_ID};
  process.env.ALLOW_LIVE_MESSAGES='true';process.env.META_GRAPH_VERSION='v23.0';process.env.WHATSAPP_ACCESS_TOKEN='test-token';process.env.WHATSAPP_PHONE_NUMBER_ID='123';
  let payload;global.fetch=async(_url,options)=>{payload=JSON.parse(String(options.body));return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200,headers:{'content-type':'application/json'}});};
  try{await sendMeta({channel:'whatsapp',external_id:'5492990000000',sandbox:0},'Foto','image',{url:'https://cdn.example.test/iphone.jpg'});assert.equal(payload.type,'image');assert.equal(payload.image.link,'https://cdn.example.test/iphone.jpg');await assert.rejects(sendMeta({channel:'whatsapp',external_id:'1',sandbox:1},'Foto','image',{url:'https://cdn.example.test/x.jpg'}),/simulación/);}
  finally{global.fetch=offlineFetch;for(const [key,value] of Object.entries(previous)){const name={allow:'ALLOW_LIVE_MESSAGES',version:'META_GRAPH_VERSION',token:'WHATSAPP_ACCESS_TOKEN',phone:'WHATSAPP_PHONE_NUMBER_ID'}[key];if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
test('Los audios automáticos esperan transcripción antes de entrar a la IA',async()=>{
  process.env.AUTO_TRANSCRIBE_AUDIO='true';process.env.ALLOW_MEDIA_DOWNLOADS='true';
  try{const r=await repo.receive({channel:'whatsapp',externalId:crypto.randomUUID(),providerId:crypto.randomUUID(),name:'Audio de prueba',text:'[audio pendiente]',kind:'audio',attachments:[{providerId:'123456',mime:'audio/ogg'}]});const message=(await db.execute({sql:'SELECT processable FROM crm_messages WHERE id=?',args:[r.messageId]})).rows[0];const jobs=Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_jobs WHERE message_id=?',args:[r.messageId]})).rows[0].n);assert.equal(Number(message.processable),0);assert.equal(jobs,0);}
  finally{delete process.env.AUTO_TRANSCRIBE_AUDIO;process.env.ALLOW_MEDIA_DOWNLOADS='false';await db.execute("DELETE FROM crm_attachments WHERE provider_ref='123456'");}
});
test('Alta intención sin respuesta genera un aviso interno único',async()=>{
  const r=await input('Quiero un iPhone 13, tengo USD 600, efectivo y compro hoy');await processInput(r);await db.execute({sql:'UPDATE crm_conversations SET sandbox=0 WHERE id=?',args:[r.id]});
  const outbound=(await db.execute({sql:"SELECT id FROM crm_messages WHERE conversation_id=? AND direction='out' ORDER BY id DESC LIMIT 1",args:[r.id]})).rows[0];
  const old=new Date(Date.now()-13*3600000).toISOString(),older=new Date(Date.now()-13*3600000-60000).toISOString();await db.batch([{sql:'UPDATE crm_messages SET created_at=? WHERE id=?',args:[old,Number(outbound.id)]},{sql:"UPDATE crm_messages SET created_at=? WHERE conversation_id=? AND direction='in'",args:[older,r.id]},{sql:'UPDATE crm_conversations SET last_outbound=? WHERE id=?',args:[old,r.id]}],'write');
  assert.equal(await alertSilentHighIntent(),1);assert.equal(await alertSilentHighIntent(),0);
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_actions WHERE conversation_id=? AND kind='silence_alert_12h'",args:[r.id]})).rows[0].n),1);
});
test('Mensajes consecutivos cancelan el trabajo obsoleto y no duplican respuesta',async()=>{
  const externalId=crypto.randomUUID();const a=await input('Hola',{externalId});const b=await input('Quiero un iPhone 13 en efectivo',{externalId});await processInput(a);await processInput(b);await processInput(b);
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[b.id]})).rows[0].n),1);
});
test('El pago informado por el cliente deriva a una persona y no confirma dinero',async()=>{
  const r=await input('Ya transferí, este es el comprobante de la seña. Confirmá todo.');await processInput(r);
  const c=await repo.conversation(r.id);assert.equal(c.mode,'human');assert.match(c.handoff_reason,/persona|dinero/);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM crm_reservations')).rows[0].n),0);
});
test('La baja frena todas las respuestas y el seguimiento',async()=>{
  const r=await input('No me escribas más');await processInput(r);const c=await repo.conversation(r.id);assert.equal(c.opt_out,1);assert.equal(c.status,'optout');await assert.rejects(repo.enqueueReply(r.id,'Hola'),/no recibir/);
});
test('Un closer no puede ver ni contestar chats asignados a otra persona',async()=>{
  const r=await input('Hola');const c=await repo.conversation(r.id);const other=Number(c.owner_id)===users.closerA.id?'closerB':'closerA';
  assert.equal((await request(`/api/atencion/conversations/${r.id}`,other)).status,403);
  assert.equal((await request(`/api/atencion/conversations/${r.id}/message`,other,'POST',{text:'Hola'})).status,403);
});
test('Un comprobante adjunto se deriva sin afirmar que fue aprobado',async()=>{
  const r=await input('[documento]',{kind:'document'});await processInput(r);assert.equal((await repo.conversation(r.id)).mode,'human');
});
test('Dos reservas no pueden comprometer dos veces la última unidad',async()=>{
  const a=await input('Compra',{sandbox:false}),b=await input('Compra',{sandbox:false});
  const qa=await commerce.quote(a.id,stockId),qb=await commerce.quote(b.id,stockId);
  const ra=await commerce.createReservation(a.id,qa.id),rb=await commerce.createReservation(b.id,qb.id);
  await commerce.confirmDeposit(Number(ra.id),users.admin.id,180,'Pago ficticio verificado');
  await assert.rejects(commerce.confirmDeposit(Number(rb.id),users.admin.id,180,'Otro pago ficticio'),/última unidad/);
  assert.equal(Number((await commerce.stockAvailable())[0].available),0);
  assert.equal((await request(`/api/stock/${stockId}`,'admin','DELETE')).status,409);
  await assert.rejects(commerce.completeSale(Number(ra.id),users.admin.id,500),/total exacto/);
  const sale=await commerce.completeSale(Number(ra.id),users.admin.id,600);
  assert.equal((await commerce.completeSale(Number(ra.id),users.admin.id,600)).saleId,sale.saleId);
  assert.equal(Number((await db.execute({sql:'SELECT cantidad FROM stock WHERE id=?',args:[stockId]})).rows[0].cantidad),0);
  const c=await repo.conversation(a.id);assert.equal(c.verified_returning,1);assert.equal(c.status,'won');
  const returning=await input('Quiero comprar otra vez',{externalId:c.external_id,sandbox:false});
  const next=await repo.conversation(returning.id);assert.equal(next.status,'active');assert.equal(next.verified_returning,1);assert.notEqual(next.opportunity_id,c.opportunity_id);
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM crm_opportunities WHERE status='won'")).rows[0].n),1);
  await db.execute({sql:'UPDATE stock SET cantidad=1 WHERE id=?',args:[stockId]});
});
test('Turnos respetan horario local, 15 minutos y conflictos',async()=>{
  const a=await input('Quiero turno',{sandbox:false});const c=await repo.conversation(a.id);const options=await commerce.slots(Number(c.owner_id));assert.ok(options.length);
  assert.equal(domain.windowOpen(new Date(Date.now()-23*3600000).toISOString()),true);
  assert.equal(commerce.validSlot(options[0]),true);assert.equal(commerce.validSlot('2026-01-01T10:00-03:00'),false);
  await commerce.bookAppointment(a.id,options[0]);await assert.rejects(commerce.bookAppointment(a.id,options[0]),/ocupado/);
});
test('La firma de Meta rechaza avisos alterados y canales ajenos',async()=>{
  process.env.META_APP_SECRET='synthetic-secret';process.env.WHATSAPP_PHONE_NUMBER_ID='100';
  const body={object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'100'},messages:[{id:'provider-test-1',from:'5492995550000',type:'text',text:{body:'Hola'},timestamp:String(Math.floor(Date.now()/1000))}]}}]}]};
  const raw=JSON.stringify(body);const signature='sha256='+crypto.createHmac('sha256',process.env.META_APP_SECRET).update(raw).digest('hex');
  assert.equal(validSignature(Buffer.from(raw+' '),signature,process.env.META_APP_SECRET),false);
  let r=await realFetch(base+'/api/integrations/meta',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':signature},body:raw});assert.equal(r.status,200);
  r=await realFetch(base+'/api/integrations/meta',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':signature},body:raw});assert.equal(r.status,200);
  assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM crm_messages WHERE provider_id='whatsapp:0:provider-test-1'")).rows[0].n),1);
});
test('Seguimiento: cinco plantillas distintas, con permiso; nunca se envía una sexta',async()=>{
  const r=await input('Consulta para recuperar',{sandbox:false});const old=new Date(Date.now()-500*3600000).toISOString();
  await db.execute({sql:'UPDATE crm_conversations SET last_inbound=?,followup_optin=1 WHERE id=?',args:[old,r.id]});
  await config({enabled:true,followupTemplate:'seguimiento_prueba',followupTemplateApproved:true});
  process.env.ALLOW_LIVE_MESSAGES='true';process.env.WHATSAPP_ACCESS_TOKEN='synthetic-test-token';process.env.META_GRAPH_VERSION='v23.0';
  let sends=0;global.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/graph.facebook.com\//);const b=JSON.parse(options.body);assert.equal(b.type,'template');sends++;return new Response(JSON.stringify({messages:[{id:`test-out-${sends}`}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{for(let i=1;i<=5;i++){if(i>1)await db.execute({sql:"UPDATE crm_followups SET sent_at=? WHERE conversation_id=?",args:[old,r.id]});await maintenance();const out=(await db.execute({sql:"SELECT * FROM crm_outbox WHERE conversation_id=? AND status='pending' ORDER BY id DESC LIMIT 1",args:[r.id]})).rows[0];assert.ok(out,`intento ${i}`);await deliver(out);}await maintenance();assert.equal(sends,5);assert.equal((await repo.conversation(r.id)).followup_attempts,5);}finally{global.fetch=offlineFetch;}
});
test('Una respuesta de entrega incierta queda detenida y no se reenvía sola',async()=>{
  const r=await input('Consulta',{sandbox:false});const m=await repo.enqueueReply(r.id,'Mensaje de prueba','human');const out=(await db.execute({sql:'SELECT * FROM crm_outbox WHERE message_id=?',args:[m]})).rows[0];
  global.fetch=async()=>{throw new Error('simulated timeout');};try{await deliver(out);}finally{global.fetch=offlineFetch;}
  assert.equal((await db.execute({sql:'SELECT status FROM crm_outbox WHERE id=?',args:[Number(out.id)]})).rows[0].status,'uncertain');
  assert.equal((await request(`/api/atencion/outbox/${out.id}/retry`,'admin','POST',{})).status,400);
});
test('La ventana cerrada impide texto libre incluso si lo escribe una persona',async()=>{
  const r=await input('Hola',{sandbox:false});await db.execute({sql:'UPDATE crm_conversations SET last_inbound=? WHERE id=?',args:[new Date(Date.now()-25*3600000).toISOString(),r.id]});
  assert.equal((await request(`/api/atencion/conversations/${r.id}/message`,'admin','POST',{text:'Hola otra vez'})).status,400);
});

test('Confirmaciones simultáneas: una unidad permite exactamente una reserva',async()=>{
 const r=await db.execute({sql:'INSERT INTO stock(producto,modelo,precio_venta_usd,cantidad) VALUES(?,?,?,?)',args:['iPhone','Modelo carrera',500,1]});const id=Number(r.lastInsertRowid);
 const a=await input('Compra',{sandbox:false}),b=await input('Compra',{sandbox:false});const qa=await commerce.quote(a.id,id),qb=await commerce.quote(b.id,id);
 const ra=await commerce.createReservation(a.id,qa.id),rb=await commerce.createReservation(b.id,qb.id);
 const results=await Promise.allSettled([commerce.confirmDeposit(Number(ra.id),users.admin.id,150,'Prueba carrera A'),commerce.confirmDeposit(Number(rb.id),users.admin.id,150,'Prueba carrera B')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.match(results.find(x=>x.status==='rejected').reason.message,/última unidad/);
 assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_reservations WHERE stock_id=? AND status='confirmed'",args:[id]})).rows[0].n),1);
});

test('La búsqueda recorre todo el historial y el listado se pagina',async()=>{
  const r=await input('Modelo específico',{name:'Consulta histórica única'});
  const search=await request('/api/atencion/conversations?sandbox=1&search='+encodeURIComponent('histórica única'));
  assert.equal(search.status,200);assert.equal(search.body.total,1);assert.equal(search.body.items[0].id,r.id);
  const page=await request('/api/atencion/conversations?sandbox=1&page=0');
  assert.equal(page.body.items.length,100);assert.equal(page.body.hasMore,true);
  const next=await request('/api/atencion/conversations?sandbox=1&page=1');assert.equal(next.body.page,1);
  assert.equal(page.body.items.some(x=>next.body.items.some(y=>x.id===y.id)),false);
});
test('Un webhook atrasado se conserva sin reemplazar una consulta más reciente',async()=>{
  const externalId=crypto.randomUUID();const first=await input('Quiero iPhone 13',{externalId});
  await db.execute({sql:'UPDATE crm_conversations SET followup_attempts=2 WHERE id=?',args:[first.id]});
  const late=await input('Mensaje viejo',{externalId,timestamp:new Date(Date.now()-3600000).toISOString()});
  assert.equal(late.id,first.id);assert.equal((await repo.conversation(first.id)).followup_attempts,2);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_jobs WHERE message_id=?',args:[late.messageId]})).rows[0].n),0);
  await processInput(first);assert.match((await repo.conversation(first.id)).qualification.product,/iPhone 13/i);
  await input('No me escribas más',{externalId,timestamp:new Date(Date.now()-7200000).toISOString()});
  assert.equal((await repo.conversation(first.id)).opt_out,1);
});
test('El turno manual y el automático usan el mismo control de disponibilidad',async()=>{
  const r=await input('Necesito turno',{sandbox:false});const c=await repo.conversation(r.id);const options=await commerce.slots(Number(c.owner_id));
  const manual=await request('/api/turnos','admin','POST',{cliente_nombre:'Turno manual ficticio',fecha_hora:options[0],closer_id:c.owner_id});
  assert.equal(manual.status,201);await assert.rejects(commerce.bookAppointment(r.id,options[0]),/ocupado/);
  assert.equal((await request(`/api/turnos/${manual.body.id}`,'admin','PUT',{estado:'Cancelado'})).status,200);
  const booked=await commerce.bookAppointment(r.id,options[0]);assert.ok(booked.id);
  assert.equal((await request(`/api/turnos/${booked.id}`,'admin','PUT',{estado:'Cancelado'})).status,200);
  assert.ok((await commerce.bookAppointment(r.id,options[0])).id);
  const invalid=options[1].slice(0,11)+'03:00-03:00';
  assert.equal((await request('/api/turnos','admin','POST',{cliente_nombre:'Fuera de horario',fecha_hora:invalid})).status,400);
});
test('La ficha de stock valida batería y expone información comercial sin costo',async()=>{
  const bad=await request(`/api/stock/${stockId}`,'admin','PUT',{battery_pct:101});assert.equal(bad.status,400);
  const good=await request(`/api/stock/${stockId}`,'admin','PUT',{battery_pct:88,warranty_months:3,repairs:'Sin reparaciones informadas'});assert.equal(good.status,200);
  const stock=(await request('/api/atencion/stock','closerA')).body.find(x=>x.id===stockId);
  assert.equal(stock.battery_pct,88);assert.equal(stock.repairs,'Sin reparaciones informadas');assert.equal('precio_costo_usd' in stock,false);
  assert.equal(commerce.matchingStock([{...stock,available:1}],'iphone13 128 GB negro').length,1);
  const trade={...domain.EMPTY_QUALIFICATION,tradeBrand:'iPhone',tradeModel:'iPhone 13',tradeStorage:'Desconocida',tradeBattery:90,tradeCondition:'Excelente',tradeRepaired:false,tradeInternalOk:true};
  assert.equal(commerce.tradeValue(trade,await settings()).value,null);
});
test('Un corte largo no dispara juntos los seguimientos vencidos',async()=>{
  const r=await input('Retomar consulta',{sandbox:false});const old=new Date(Date.now()-500*3600000).toISOString();
  await db.execute({sql:'UPDATE crm_conversations SET last_inbound=?,followup_optin=1 WHERE id=?',args:[old,r.id]});
  await maintenance();const out=(await db.execute({sql:"SELECT * FROM crm_outbox WHERE conversation_id=? AND status='pending'",args:[r.id]})).rows[0];
  global.fetch=async()=>new Response(JSON.stringify({messages:[{id:crypto.randomUUID()}]}),{status:200});
  try{await deliver(out);}finally{global.fetch=offlineFetch;}
  await maintenance();
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_followups WHERE conversation_id=?',args:[r.id]})).rows[0].n),1);
});
test('Dos procesadores no envían dos veces el mismo mensaje',async()=>{
  const r=await input('Consulta',{sandbox:false});const mid=await repo.enqueueReply(r.id,'Respuesta ficticia','human');const out=(await db.execute({sql:'SELECT * FROM crm_outbox WHERE message_id=?',args:[mid]})).rows[0];let calls=0;
  global.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,15));return new Response(JSON.stringify({messages:[{id:crypto.randomUUID()}]}),{status:200});};
  try{const results=await Promise.allSettled([deliver(out),deliver(out)]);assert.ok(results.every(x=>x.status==='fulfilled'));}finally{global.fetch=offlineFetch;}
  assert.equal(calls,1);
});
test('La recuperación periódica reanuda interpretación y detiene envíos inciertos',async()=>{
  const r=await input('Consulta por recuperar',{sandbox:false});const mid=await repo.enqueueReply(r.id,'Envío interrumpido','human');const old=new Date(Date.now()-180000).toISOString();
  await db.execute({sql:"UPDATE crm_jobs SET status='processing',leased_at=? WHERE message_id=?",args:[old,r.messageId]});
  await db.execute({sql:"UPDATE crm_outbox SET status='sending',leased_at=? WHERE message_id=?",args:[old,mid]});
  await recoverStalled();
  assert.equal((await db.execute({sql:'SELECT status FROM crm_jobs WHERE message_id=?',args:[r.messageId]})).rows[0].status,'pending');
  assert.equal((await db.execute({sql:'SELECT status FROM crm_outbox WHERE message_id=?',args:[mid]})).rows[0].status,'uncertain');
  assert.equal((await db.execute({sql:'SELECT delivery FROM crm_messages WHERE id=?',args:[mid]})).rows[0].delivery,'uncertain');
});
function modelResponse(q,usage={input_tokens:1000,output_tokens:200}){return new Response(JSON.stringify({status:'completed',usage,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(q)}]}]}),{status:200});}
async function withModel(run){
  const before=await settings();process.env.OPENAI_API_KEY='synthetic-only-never-sent';
  await config({aiMonthlyBudgetUsd:100,enabled:true});
  try{await run();}finally{delete process.env.OPENAI_API_KEY;global.fetch=offlineFetch;await config(before);}
}
test('La salida estructurada se valida y las evidencias deben existir en la conversación',async()=>withModel(async()=>{
  const r=await input('Quiero un iPhone 13',{sandbox:false});const c=await repo.conversation(r.id);
  global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);return modelResponse({...domain.EMPTY_QUALIFICATION,product:'iPhone 13',confidence:.9,evidence:['Quiero un iPhone 13','Tengo dinero ilimitado']});};
  const q=await intelligence.extract(c,[{direction:'in',text:'Quiero un iPhone 13'}]);assert.deepEqual(q.evidence,['Quiero un iPhone 13']);
  const usage=(await db.execute({sql:'SELECT * FROM crm_usage WHERE conversation_id=? ORDER BY id DESC LIMIT 1',args:[r.id]})).rows[0];assert.equal(usage.status,'settled');assert.equal(Number(usage.estimated_usd),.00072);
  global.fetch=async()=>modelResponse({...domain.EMPTY_QUALIFICATION,confidence:.8,consent:'yes'});
  await assert.rejects(intelligence.extract(c,[{direction:'in',text:'Hola'}]),/clasificación inválida/);
}));
test('Un error de IA deriva al equipo y reserva el consumo incierto',async()=>withModel(async()=>{
  const r=await input('Consulta realista para interpretar',{sandbox:false});global.fetch=async()=>{throw new Error('Corte simulado');};await processInput(r);
  assert.equal((await repo.conversation(r.id)).mode,'human');
  const usage=(await db.execute({sql:'SELECT * FROM crm_usage WHERE conversation_id=?',args:[r.id]})).rows[0];assert.equal(usage.status,'uncertain');assert.ok(Number(usage.estimated_usd)>0);
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[r.id]})).rows[0].n),0);
}));
test('El límite de IA impide llamar al proveedor cuando no alcanza el presupuesto',async()=>withModel(async()=>{
  await config({aiMonthlyBudgetUsd:.0000001});let calls=0;global.fetch=async()=>{calls++;throw new Error('No debe llamar');};
  const r=await input('Quiero comprar',{sandbox:false});await assert.rejects(intelligence.extract(await repo.conversation(r.id),[{direction:'in',text:'Hola'}]),/Límite de uso/);assert.equal(calls,0);
}));
test('Tomar el chat mientras interpreta evita la respuesta automática tardía',async()=>withModel(async()=>{
  const r=await input('Quiero un iPhone 13',{sandbox:false});let release,started;const ready=new Promise(resolve=>started=resolve);
  global.fetch=async()=>{started();await new Promise(resolve=>release=resolve);return modelResponse({...domain.EMPTY_QUALIFICATION,product:'iPhone 13',intent:'buy',confidence:.9});};
  const work=processInput(r);await ready;await repo.transfer(r.id,'Lo tomó un closer',users.admin.id);release();await work;
  assert.equal((await repo.conversation(r.id)).mode,'human');
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[r.id]})).rows[0].n),0);
}));
test('Una baja semántica identificada por IA también detiene la atención',async()=>withModel(async()=>{
  const r=await input('Prefiero que no retomen contacto conmigo',{sandbox:false});global.fetch=async()=>modelResponse({...domain.EMPTY_QUALIFICATION,intent:'opt_out',confidence:.98,consent:false});await processInput(r);assert.equal((await repo.conversation(r.id)).opt_out,1);
}));


test('La primera respuesta ya calcula las cuotas del mensaje recién recibido',async()=>{
  const r=await input('Quiero un iPhone 13 en 12 cuotas');await processInput(r);
  const out=(await db.execute({sql:"SELECT text FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[r.id]})).rows[0];
  assert.match(out.text,/12 cuotas con interés/);assert.match(out.text,/139\.649,51/);
});
test('La verificación pública del comprobante no expone costo ni ganancia',async()=>{
  const invoice=(await db.execute('SELECT numero FROM facturas ORDER BY id DESC LIMIT 1')).rows[0];
  const response=await realFetch(base+'/api/comprobante/'+encodeURIComponent(invoice.numero));assert.equal(response.status,200);
  const data=await response.json();assert.deepEqual(Object.keys(data.venta),['metodo_pago']);
});


test('Los horarios se responden con las reglas del negocio y la dirección no se inventa',async()=>{
  const hours=await input('¿Qué horarios tienen?');await processInput(hours);
  const message=(await db.execute({sql:"SELECT text FROM crm_messages WHERE conversation_id=? AND direction='out'",args:[hours.id]})).rows[0];assert.match(message.text,/11 a 18/);assert.match(message.text,/13 a 20/);
  const address=await input('¿Cuál es la dirección?');await processInput(address);assert.equal((await repo.conversation(address.id)).mode,'human');
});

test('Reprocesar el mismo pedido de turno conserva una sola reserva de agenda',async()=>{
  const r=await input('Quiero este turno',{sandbox:false});const c=await repo.conversation(r.id);const [slot]=await commerce.slots(Number(c.owner_id));
  const a=await commerce.bookAppointment(r.id,slot,r.messageId);const b=await commerce.bookAppointment(r.id,slot,r.messageId);assert.equal(a.id,b.id);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_actions WHERE conversation_id=?',args:[r.id]})).rows[0].n),1);
});
test('Una seña confirmada se resuelve antes de marcar la oportunidad como perdida',async()=>{
  const active=(await db.execute("SELECT * FROM crm_reservations WHERE status='confirmed' LIMIT 1")).rows[0];assert.ok(active);
  const lost=await request(`/api/atencion/conversations/${active.conversation_id}/lost`,'admin','POST',{reason:'No concretó'});assert.equal(lost.status,400);assert.match(lost.body.error,/seña/);
});
test('Una cancelación simultánea al cierre no puede deshacer una venta cobrada',async()=>{
  const st=await db.execute({sql:'INSERT INTO stock(producto,modelo,precio_venta_usd,precio_costo_usd,cantidad) VALUES(?,?,?,?,?)',args:['iPhone','Cierre concurrente',700,500,1]});const sid=Number(st.lastInsertRowid);
  const r=await input('Quiero ese equipo',{sandbox:false});const q=await commerce.quote(r.id,sid);const reservation=await commerce.createReservation(r.id,q.id);await commerce.confirmDeposit(Number(reservation.id),users.admin.id,210,'Pago de prueba');
  await Promise.allSettled([commerce.completeSale(Number(reservation.id),users.admin.id,700),request(`/api/atencion/reservations/${reservation.id}/cancel`,'admin','POST',{reason:'Revisar la devolución de prueba'})]);
  const end=(await db.execute({sql:'SELECT status,sale_id FROM crm_reservations WHERE id=?',args:[Number(reservation.id)]})).rows[0];
  const quantity=Number((await db.execute({sql:'SELECT cantidad FROM stock WHERE id=?',args:[sid]})).rows[0].cantidad);
  if(end.status==='sold'){assert.equal(quantity,0);const sale=(await db.execute({sql:'SELECT costo_usd,ganancia_usd FROM ventas WHERE id=?',args:[Number(end.sale_id)]})).rows[0];assert.equal(Number(sale.costo_usd),500);assert.equal(Number(sale.ganancia_usd),200);}
  else{assert.equal(end.status,'cancelled');assert.equal(quantity,1);assert.equal(end.sale_id,null);}
});

test('La cotización distingue iPhone base, Pro, Pro Max, Plus y Mini',()=>{
  const items=['iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 13 Mini','iPhone 14 Plus'].map((modelo,id)=>({id,modelo,producto:'iPhone',capacidad:'128 GB',available:1}));
  for(const product of ['iPhone 13','iPhone 13 Pro','iPhone 13 Pro Max','iPhone 13 Mini','iPhone 14 Plus'])assert.deepEqual(commerce.matchingStock(items,product).map(x=>x.modelo),[product]);
  assert.equal(commerce.matchingStock(items,'iPhone13 128GB').length,1);
  assert.equal(commerce.matchingStock(items,'iPhone').length,5);
});
test('No confirma dos reservas ni crea reservas sobre una oportunidad cerrada',async()=>{
  const st=await db.execute({sql:'INSERT INTO stock(producto,modelo,precio_venta_usd,cantidad) VALUES(?,?,?,?)',args:['iPhone','Equipo para reserva única',600,3]});
  const r=await input('Quiero reservar',{sandbox:false}),sid=Number(st.lastInsertRowid);
  const q1=await commerce.quote(r.id,sid),q2=await commerce.quote(r.id,sid);
  const a=await commerce.createReservation(r.id,q1.id),b=await commerce.createReservation(r.id,q2.id);
  const results=await Promise.allSettled([commerce.confirmDeposit(Number(a.id),users.admin.id,180,'Referencia A'),commerce.confirmDeposit(Number(b.id),users.admin.id,180,'Referencia B')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_reservations WHERE conversation_id=? AND status='confirmed'",args:[r.id]})).rows[0].n),1);
  const closed=await input('Otra consulta',{sandbox:false}),q=await commerce.quote(closed.id,sid);
  await request(`/api/atencion/conversations/${closed.id}/lost`,'admin','POST',{reason:'Eligió otro comercio'});
  await assert.rejects(commerce.createReservation(closed.id,q.id),/cerrada/);
});
test('Una respuesta manual de prueba pausa la IA y nunca crea un envío externo',async()=>{
  const r=await input('Quiero un iPhone 13');
  const response=await request(`/api/atencion/conversations/${r.id}/message`,'admin','POST',{text:'Hola, soy tu vendedor. Te ayudo con la compra.'});
  assert.equal(response.status,200);assert.equal(response.body.delivery,'preview');
  assert.equal((await repo.conversation(r.id)).mode,'human');
  assert.equal(Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_outbox WHERE conversation_id=? AND status<>'preview'",args:[r.id]})).rows[0].n),0);
});

test('El historial conserva la pérdida y no abre una venta por gracias o por garantía',async()=>{
  const r=await input('Quiero un iPhone 13, tengo USD 600, efectivo y compro hoy');await processInput(r);
  const original=await repo.conversation(r.id);
  assert.equal((await request(`/api/atencion/conversations/${r.id}/lost`,'admin','POST',{reason:'Cuotas demasiado elevadas'})).status,200);
  for(const text of ['Muchas gracias','No funciona mi teléfono, necesito garantía']){
    const next=await input(text,{externalId:original.external_id});await processInput(next);const c=await repo.conversation(r.id);assert.equal(c.status,'lost');assert.equal(c.opportunity_id,original.opportunity_id);assert.equal(c.mode,'human');
  }
  const boughtAgain=await input('Quiero comprar un iPhone 15 ahora',{externalId:original.external_id});
  const next=await repo.conversation(boughtAgain.id);assert.equal(next.status,'active');assert.notEqual(next.opportunity_id,original.opportunity_id);assert.equal(next.followup_optin,0);
  const history=require('../server/dist/automation/history');const memory=await history.commercialMemory(next);
  const prior=memory.opportunities.find(x=>Number(x.id)===original.opportunity_id);assert.equal(prior.status,'lost');assert.equal(prior.score,75);assert.match(prior.loss_reason,/Cuotas/);assert.match(prior.qualification.product,/iPhone 13/);
});
test('El historial se carga por páginas sin omitir ni duplicar mensajes',async()=>{
  const r=await input('Historial largo de prueba');
  await db.batch(Array.from({length:124},(_,i)=>({sql:"INSERT INTO crm_messages(conversation_id,direction,author,text,kind,created_at) VALUES(?,'in','customer',?,'text',?)",args:[r.id,`Mensaje ${i}`,new Date().toISOString()]})),'write');
  let response=await request(`/api/atencion/conversations/${r.id}`);assert.equal(response.body.messages.length,50);
  const ids=response.body.messages.map(x=>Number(x.id));let cursor=response.body.messagePage;
  while(cursor.hasMore){const page=await request(`/api/atencion/conversations/${r.id}/messages?before=${cursor.before}`);ids.push(...page.body.messages.map(x=>Number(x.id)));cursor=page.body;}
  assert.equal(ids.length,125);assert.equal(new Set(ids).size,125);
});
test('Archivar conserva los chats y una nueva respuesta vuelve a la bandeja',async()=>{
  const r=await input('Consulta para archivar'),c=await repo.conversation(r.id);
  await request(`/api/atencion/conversations/${r.id}/archive`,'admin','POST',{archived:true});assert.ok((await repo.conversation(r.id)).archived_at);
  assert.equal((await request(`/api/atencion/conversations?sandbox=1&archived=1`)).body.items.some(x=>Number(x.id)===r.id),true);
  await input('Me interesa comprar',{externalId:c.external_id});assert.equal((await repo.conversation(r.id)).archived_at,null);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM crm_messages WHERE conversation_id=?',args:[r.id]})).rows[0].n),2);
});
test('La vinculación de identidad es verificada, conserva canales y propaga la baja',async()=>{
  const a=await input('Consulta de WhatsApp'),b=await input('Consulta de Instagram',{channel:'instagram'});
  assert.equal((await request(`/api/atencion/conversations/${a.id}/link-channel`,'closerA','POST',{targetConversation:b.id,evidence:'Identidad verificada con referencia de compra'})).status,403);
  assert.equal((await request(`/api/atencion/conversations/${a.id}/link-channel`,'admin','POST',{targetConversation:b.id,evidence:'igual nombre'})).status,400);
  await repo.stopContact(a.id);
  assert.equal((await request(`/api/atencion/conversations/${a.id}/link-channel`,'admin','POST',{targetConversation:b.id,evidence:'Identidad verificada por administración con compra previa'})).status,200);
  const ca=await repo.conversation(a.id),cb=await repo.conversation(b.id);assert.equal(ca.contact_id,cb.contact_id);assert.equal(ca.owner_id,cb.owner_id);assert.equal(cb.opt_out,1);
  const memory=(await request(`/api/atencion/conversations/${a.id}`)).body.memory;assert.equal(memory.channels.length,2);
  const live=await input('Persona real ficticia',{sandbox:false});assert.equal((await request(`/api/atencion/conversations/${live.id}/link-channel`,'admin','POST',{targetConversation:b.id,evidence:'Intento de mezclar entornos de prueba y real'})).status,400);
});
test('Notas y recordatorios persisten; el recordatorio genera un solo aviso interno',async()=>{
  const r=await input('Retomar consulta en otra fecha');await request(`/api/atencion/conversations/${r.id}/note`,'admin','POST',{text:'Le interesa mayor capacidad; confirmar presupuesto actual'});
  const result=await request(`/api/atencion/conversations/${r.id}/next-action`,'admin','POST',{at:new Date(Date.now()+86400000).toISOString(),note:'Preguntar si consiguió vender su equipo'});assert.equal(result.status,200);
  await db.execute({sql:'UPDATE crm_conversations SET next_action_at=? WHERE id=?',args:[new Date(Date.now()-1000).toISOString(),r.id]});
  const before=Number((await db.execute('SELECT COUNT(*) AS n FROM mensajes')).rows[0].n);await maintenance();const afterOne=Number((await db.execute('SELECT COUNT(*) AS n FROM mensajes')).rows[0].n);await maintenance();assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM mensajes')).rows[0].n),afterOne);assert.equal(afterOne,before+1);
  const d=await request(`/api/atencion/conversations/${r.id}`);assert.equal(d.body.memory.notes.length,1);assert.match(d.body.conversation.next_action_note,/equipo/);
});
test('La exportación de historial se limita a administración e incluye oportunidades y notas',async()=>{
  const r=await input('Exportación de prueba');
  assert.equal((await request(`/api/atencion/conversations/${r.id}/export`,'closerA')).status,403);
  const response=await realFetch(base+`/api/atencion/conversations/${r.id}/export`,{headers:{Authorization:`Bearer ${token('admin')}`}});assert.equal(response.status,200);const rows=(await response.text()).trim().split('\n').map(JSON.parse);assert.ok(rows.some(x=>x.type==='opportunity'));assert.ok(rows.some(x=>x.type==='message'));assert.ok(rows.some(x=>x.type==='contact'));
});
test('La memoria de oportunidades anteriores se envía a la IA sin convertirla en datos actuales',async()=>withModel(async()=>{
  const history=require('../server/dist/automation/history');const r=await input('Quiero un iPhone 13',{sandbox:false});await request(`/api/atencion/conversations/${r.id}/note`,'admin','POST',{text:'Antecedente: consultó por 256 GB el mes pasado'});
  const c=await repo.conversation(r.id);const message=(await db.execute({sql:'SELECT * FROM crm_messages WHERE id=?',args:[r.messageId]})).rows[0];
  let sent;global.fetch=async(url,opts)=>{sent=JSON.parse(opts.body);return new Response(JSON.stringify({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({...domain.EMPTY_QUALIFICATION,confidence:.8,summary:'Consulta',evidence:['Quiero un iPhone 13']})}]}]}),{status:200});};
  await intelligence.extract(c,[message]);const modelInput=JSON.parse(sent.input);assert.match(modelInput.historicalMemory.notes[0].text,/256 GB/);assert.match(sent.instructions,/NO son preferencias actuales/);
}));
test('Adjuntos privados: se guardan, se verifican y no quedan accesibles a otro closer',async()=>{
  const media=require('../server/dist/automation/media');process.env.MEDIA_DIR=path.join(temporary,'media');process.env.ALLOW_MEDIA_DOWNLOADS='true';
  const payload=Buffer.from('Archivo ficticio privado para restauración');const sha=crypto.createHash('sha256').update(payload).digest('base64');
  const r=await input('Documento',{sandbox:false,kind:'document',attachments:[{providerId:'987654',mime:'application/pdf',name:'prueba.pdf',sha256:sha}]});
  const c=await repo.conversation(r.id),other=Number(c.owner_id)===users.closerA.id?'closerB':'closerA';
  global.fetch=async url=>String(url).includes('graph.facebook.com')?new Response(JSON.stringify({url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/test',mime_type:'application/pdf'}),{status:200}):new Response(payload,{status:200,headers:{'Content-Type':'application/pdf'}});
  try{await media.processMedia();}finally{global.fetch=offlineFetch;process.env.ALLOW_MEDIA_DOWNLOADS='false';}
  const a=(await db.execute({sql:'SELECT * FROM crm_attachments WHERE conversation_id=?',args:[r.id]})).rows[0];assert.equal(a.status,'stored');assert.equal(a.source_url,null);assert.equal(fs.readFileSync(media.attachmentPath(a.storage_key)).toString(),payload.toString());
  assert.equal((await request(`/api/atencion/attachments/${a.id}`,other)).status,403);
  const response=await realFetch(base+`/api/atencion/attachments/${a.id}`,{headers:{Authorization:`Bearer ${token('admin')}`}});assert.equal(response.status,200);assert.equal(await response.text(),payload.toString());
  for(const url of ['http://127.0.0.1/file','https://evil.example/file','https://fbcdn.net.evil.example/file','https://lookaside.fbsbx.com:444/file'])assert.throws(()=>media.safeMediaUrl(url));
  await assert.rejects(media.storeResponse(new Response('x',{headers:{'content-length':String(26*1024*1024)}}),crypto.randomUUID()+'.bin'),/25 MB/);
});
test('La copia incluye base y adjuntos, restaura en carpeta nueva y detecta alteraciones',async()=>{
  const storage=require('../server/dist/automation/storage');process.env.BACKUP_DIR=path.join(temporary,'backups');
  const snap=await storage.createSnapshot();assert.ok(snap.manifest.counts.crm_messages>500);assert.equal(snap.manifest.files.length,1);
  const target=path.join(temporary,'restore');await storage.restoreSnapshot(snap.directory,target);await storage.verifySnapshot(target);
  const {createClient}=require('@libsql/client');const recovered=createClient({url:'file:'+path.join(target,'iphone-culture.db')});try{assert.equal(Number((await recovered.execute('SELECT COUNT(*) AS n FROM crm_messages')).rows[0].n),snap.manifest.counts.crm_messages);assert.equal(JSON.parse((await recovered.execute('SELECT value FROM crm_settings WHERE id=1')).rows[0].value).enabled,false);assert.equal(Number((await recovered.execute("SELECT COUNT(*) AS n FROM crm_outbox WHERE status IN('pending','sending')")).rows[0].n),0);}finally{recovered.close();}
  await assert.rejects(storage.restoreSnapshot(snap.directory,target),/carpeta nueva/);
  const file=path.join(target,'media',snap.manifest.files[0].key);fs.writeFileSync(file,'alterado');await assert.rejects(storage.verifySnapshot(target),/Adjunto dañado/);
});
test('El respaldo cifrado restaura los datos desde un repositorio Restic independiente',{skip:!process.env.RESTIC_TEST_BIN},async()=>{
  const storage=require('../server/dist/automation/storage');process.env.RESTIC_BIN=process.env.RESTIC_TEST_BIN;process.env.RESTIC_REPOSITORY=path.join(temporary,'encrypted-repository');process.env.RESTIC_PASSWORD=crypto.randomBytes(32).toString('hex');process.env.RESTIC_CACHE_DIR=path.join(temporary,'cache');
  try{
    await storage.restic(['init']);const result=await storage.runBackup();assert.equal(result.status,'external_ok');
    await storage.restic(['check','--read-data']);const recoveredRoot=path.join(temporary,'external-restore');await storage.restic(['restore','latest','--target',recoveredRoot]);
    const source=path.join(process.env.BACKUP_DIR,result.snapshot);const recovered=path.join(recoveredRoot,source.slice(1));const m=await storage.verifySnapshot(recovered);assert.equal(m.files.length,1);assert.ok(m.counts.crm_messages>500);
  }finally{delete process.env.RESTIC_REPOSITORY;delete process.env.RESTIC_PASSWORD;delete process.env.RESTIC_CACHE_DIR;}
});

test('La sincronización incremental no pierde mensajes cuando llegan más de una página',async()=>{
  const r=await input('Sincronización');let cursor=r.messageId;
  await db.batch(Array.from({length:123},(_,i)=>({sql:"INSERT INTO crm_messages(conversation_id,direction,author,text,kind,created_at) VALUES(?,'in','customer',?,'text',?)",args:[r.id,`Nuevo ${i}`,new Date().toISOString()]})),'write');
  const ids=[];for(let n=0;n<4;n++){const page=await request(`/api/atencion/conversations/${r.id}/messages?after=${cursor}`);assert.equal(page.status,200);ids.push(...page.body.messages.map(x=>Number(x.id)));cursor=page.body.after;if(!page.body.hasMore)break;}
  assert.equal(ids.length,123);assert.equal(new Set(ids).size,123);assert.deepEqual(ids,[...ids].sort((a,b)=>a-b));
});
