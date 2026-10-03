import {snapshotOpportunity} from './history';
import {db} from '../db';
import {Settings,Qualification,discountFor,finance,round2} from './domain';
import {settings,event} from './schema';
import {conversation,BusinessError,nowIso} from './repository';
import {calcularCanjeiPhone,calcularCanjeAndroid,MODELOS_POR_MARCA,STORAGE_IPHONE,STORAGE_ANDROID,ESTADOS_IPHONE,ESTADOS_ANDROID} from './trade-rules';
import {tradeDetailsReply,tradeEstimateReply} from './response-copy';
export const money=(n:number)=>`USD ${n.toLocaleString('es-AR',{maximumFractionDigits:2})}`;
export const pesos=(n:number)=>`$ ${n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export async function stockAvailable(tx:any=db):Promise<any[]> {
  return (await tx.execute({sql:`SELECT s.id,s.producto,s.modelo,s.capacidad,s.color,s.condicion,s.precio_venta_usd,s.battery_pct,s.repairs,s.warranty_months,
  s.cantidad-(SELECT COUNT(*) FROM crm_reservations r JOIN crm_conversations c ON c.id=r.conversation_id WHERE r.stock_id=s.id AND r.status='confirmed' AND r.expires_at>? AND c.sandbox=0) AS available
  FROM stock s WHERE s.cantidad>0 ORDER BY s.precio_venta_usd`,args:[nowIso()]})).rows;
}
export function matchingStock(items:any[],product:string):any[] {
  const normalized=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/(iphone|galaxy)\s*(\d)/g,'$1 $2').replace(/(\d+)\s*(gb|tb)\b/g,'$1$2').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
  const tokens=normalized(product);
  return items.filter(x=>{
    const candidate=normalized(`${x.producto} ${x.modelo} ${x.capacidad||''} ${x.color||''}`);
    // Un iPhone 13 no es un 13 Pro/Pro Max, aunque compartan los primeros tokens.
    const exactIphone=/iphone\s*\d/i.test(product);
    const variants=['pro','max','plus','mini'];
    return Number(x.available)>0&&tokens.every(t=>candidate.includes(t))&&(!exactIphone||variants.every(t=>tokens.includes(t)===candidate.includes(t)));
  });
}
export function tradeValue(q:Qualification,s:Settings):{value:number|null;question?:string;manual?:boolean} {
  if(!q.tradeModel||!q.tradeBrand){
    const fields=[];
    if(!q.tradeBrand)fields.push('Marca');
    if(!q.tradeModel)fields.push('Modelo exacto');
    fields.push('Capacidad (GB)','Porcentaje de batería, si es iPhone','Si tiene algún detalle estético, falla interna o reparación');
    return {value:null,question:tradeDetailsReply(fields)};
  }
  const brand=q.tradeBrand as keyof typeof MODELOS_POR_MARCA;
  if(!MODELOS_POR_MARCA[brand]?.includes(q.tradeModel))return {value:null,manual:true};
  const missing=[];
  if(!q.tradeStorage)missing.push('Capacidad (GB)');
  if(brand==='iPhone'&&q.tradeBattery==null)missing.push('Porcentaje de batería');
  if(!q.tradeCondition||q.tradeRepaired==null||q.tradeInternalOk==null)missing.push('Si tiene algún detalle estético, falla interna o reparación');
  if(missing.length)return {value:null,question:tradeDetailsReply(missing)};
  if(!(brand==='iPhone'?STORAGE_IPHONE:STORAGE_ANDROID).some(x=>x===q.tradeStorage))return {value:null,question:'Necesito confirmar la capacidad exacta del equipo antes de valorarlo. ¿Cuántos GB tiene?'};
  if(!(brand==='iPhone'?ESTADOS_IPHONE:ESTADOS_ANDROID).some(x=>x===q.tradeCondition))return {value:null,manual:true};
  if(q.tradeRepaired||!q.tradeInternalOk)return {value:null,manual:true};
  const r=brand==='iPhone'?calcularCanjeiPhone({modelo:q.tradeModel,storage:q.tradeStorage as any,bateriaPct:q.tradeBattery,estado:q.tradeCondition as any}):calcularCanjeAndroid({marca:brand,modelo:q.tradeModel,storage:q.tradeStorage as any,estado:q.tradeCondition as any});
  if(r.valorFinal==null)return {value:null,manual:true};
  return {value:brand==='iPhone'?r.valorFinal:Math.max(0,r.desglose.valorBase+r.desglose.ajusteStorage+r.desglose.ajusteEstado-s.androidDeductionUsd)};
}
export async function quote(id:number,stockId:number,applyDiscount=false, tradeCredit=0,qualification?:Qualification) {
  const c=await conversation(id); const s=await settings();
  const item=(await stockAvailable()).find(x=>Number(x.id)===stockId&&Number(x.available)>0);
  if(!item)throw new BusinessError('Ese equipo ya no está disponible');
  if(Number(item.precio_venta_usd)<=0)throw new BusinessError('El precio de Stock necesita revisión');
  const discount=discountFor(s,!!c.verified_returning,applyDiscount);
  const total=round2(Math.max(0,Number(item.precio_venta_usd)-discount-tradeCredit));
  const detail:any={opportunityId:c.opportunity_id,stockId,product:`${item.modelo} ${item.capacidad||''} ${item.color||''}`.trim(),condition:item.condicion,baseUsd:Number(item.precio_venta_usd),discountUsd:discount,tradeCreditUsd:tradeCredit,totalUsd:total,fx:s.usdArs,totalArs:round2(total*s.usdArs),battery:item.battery_pct,repairs:item.repairs,warrantyMonths:item.warranty_months,source:'stock',provisionalTrade:tradeCredit>0};
  const requested=qualification||c.qualification;
  if(requested.installments){const fees=(await db.execute({sql:'SELECT * FROM cuotas_fees WHERE cuotas=?',args:[requested.installments]})).rows[0];if(fees)detail.finance=finance(total,s.usdArs,fees);}
  const expires=new Date(Date.now()+15*60_000).toISOString();
  const r=await db.execute({sql:'INSERT INTO crm_quotes(conversation_id,stock_id,detail,total_usd,expires_at,created_at) VALUES(?,?,?,?,?,?)',args:[id,stockId,JSON.stringify(detail),total,expires,nowIso()]});
  return {id:Number(r.lastInsertRowid),...detail,expiresAt:expires};
}
export function quoteText(q:any):string {
  const lines=[`Tenemos disponible ${q.product}${q.condition?` (${q.condition})`:''}.`,`Precio: ${money(q.baseUsd)}.`];
  if(q.discountUsd)lines.push(`Con el beneficio aplicado: ${money(q.baseUsd-q.discountUsd)}.`);
  if(q.tradeCreditUsd)lines.push(tradeEstimateReply(money(q.tradeCreditUsd)),`Descontando el canje, la diferencia por el equipo que querés es de ${money(q.totalUsd)}.`);
  lines.push(`En pesos: ${pesos(q.totalArs)} (USD a ${q.fx}).`);
  if(q.finance)lines.push(`${q.finance.cuotas} cuotas con interés de ${pesos(q.finance.cuotaArs)}; total financiado ${pesos(q.finance.totalArs)}.`);
  if(q.battery!=null)lines.push(`Batería: ${q.battery}%.`);
  if(q.repairs)lines.push(`Reparaciones informadas: ${String(q.repairs).slice(0,250)}.`);
  if(q.warrantyMonths)lines.push(`Garantía comercial: ${q.warrantyMonths} meses.`);
  lines.push('La cotización vale 15 minutos. El stock se confirma al acreditar la seña.');
  return lines.join('\n');
}
export async function createReservation(conversationId:number,quoteId:number) {
  const c=await conversation(conversationId);
  if(c.sandbox)throw new BusinessError('La simulación no genera reservas reales');
  if(c.status!=='active')throw new BusinessError('La oportunidad está cerrada. No se puede generar otra reserva.');
  const r=await db.execute({sql:'SELECT * FROM crm_quotes WHERE id=? AND conversation_id=? AND expires_at>?',args:[quoteId,conversationId,nowIso()]});
  if(!r.rows[0])throw new BusinessError('La cotización venció. Generá una nueva.');
  const q:any=r.rows[0];const detail=JSON.parse(String(q.detail));
  if(detail.opportunityId!==c.opportunity_id)throw new BusinessError('Generá una cotización para la consulta actual');
  if(detail.provisionalTrade)throw new BusinessError('Oficina debe verificar el canje antes de reservar');
  const s=await settings();const amount=round2(Number(q.total_usd)*s.reservationPercent/100);
  if(amount<=0)throw new BusinessError('El importe necesita revisión');
  await db.execute({sql:"INSERT INTO crm_reservations(conversation_id,quote_id,stock_id,amount_usd,created_at) VALUES(?,?,?,?,?) ON CONFLICT(quote_id) DO NOTHING",args:[conversationId,quoteId,Number(q.stock_id),amount,nowIso()]});
  await event(conversationId,'reservation_requested','Pendiente de confirmación de dinero por administración');
  return (await db.execute({sql:'SELECT * FROM crm_reservations WHERE quote_id=?',args:[quoteId]})).rows[0];
}
export async function confirmDeposit(id:number,adminId:number,amount:number,reference:string) {
  if(!reference.trim()||!Number.isFinite(amount)||amount<=0)throw new BusinessError('Ingresá el importe recibido y la referencia del pago');
  const s=await settings();const tx=await db.transaction('write');
  try{
    const r:any=(await tx.execute({sql:'SELECT r.*,q.total_usd,q.detail,q.expires_at AS quote_expires FROM crm_reservations r JOIN crm_quotes q ON q.id=r.quote_id WHERE r.id=?',args:[id]})).rows[0];
    if(!r)throw new BusinessError('Reserva inexistente',404);
    if(r.status==='confirmed'){await tx.rollback();return r;}
    if(r.status!=='pending'||r.quote_expires<nowIso())throw new BusinessError('La reserva o cotización ya no está vigente');
    const current=await conversation(Number(r.conversation_id),tx);
    if(JSON.parse(String(r.detail)).opportunityId!==current.opportunity_id||current.status!=='active')throw new BusinessError('La consulta cambió. Revisá la reserva antes de confirmar dinero');
    const other=(await tx.execute({sql:"SELECT id FROM crm_reservations WHERE conversation_id=? AND id<>? AND status='confirmed' LIMIT 1",args:[current.id,id]})).rows[0];
    if(other)throw new BusinessError('Esta conversación ya tiene una reserva confirmada. Administración debe resolverla antes de confirmar otra.');
    if(amount<Number(r.amount_usd)||amount>Number(r.total_usd))throw new BusinessError('El importe debe cubrir el 30% y no superar el total');
    const item=(await stockAvailable(tx)).find(x=>Number(x.id)===Number(r.stock_id));
    if(!item||Number(item.available)<1)throw new BusinessError('Otro cliente ya reservó la última unidad',409);
    const expires=new Date(Date.now()+s.reservationDays*86400_000).toISOString();
    await tx.execute({sql:"UPDATE crm_reservations SET status='confirmed',amount_usd=?,confirmed_by=?,payment_reference=?,confirmed_at=?,expires_at=? WHERE id=?",args:[round2(amount),adminId,reference.slice(0,200),nowIso(),expires,id]});
    await tx.commit();await event(Number(r.conversation_id),'deposit_confirmed',`Reserva #${id}; seña verificada por administración`,adminId);return {id,expires_at:expires};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
export async function completeSale(id:number,adminId:number,paidTotal:number) {
  const tx=await db.transaction('write');
  try{
    const r:any=(await tx.execute({sql:'SELECT r.*,q.total_usd,q.detail FROM crm_reservations r JOIN crm_quotes q ON q.id=r.quote_id WHERE r.id=?',args:[id]})).rows[0];
    if(!r)throw new BusinessError('Reserva inexistente',404);
    if(r.status==='sold'){await tx.rollback();return {saleId:Number(r.sale_id)};}
    if(r.status!=='confirmed'||r.expires_at<nowIso())throw new BusinessError('La reserva no está vigente');
    if(!Number.isFinite(paidTotal)||Math.abs(paidTotal-Number(r.total_usd))>.005)throw new BusinessError('Confirmá el cobro del total exacto antes de cerrar');
    const c=await conversation(Number(r.conversation_id),tx);const q=JSON.parse(String(r.detail));
    if(q.opportunityId!==c.opportunity_id)throw new BusinessError('La consulta cambió; revisá la reserva antes de cerrar');
    const costRow=(await tx.execute({sql:'SELECT precio_costo_usd FROM stock WHERE id=?',args:[Number(r.stock_id)]})).rows[0];
    if(!costRow)throw new BusinessError('Stock inexistente',409);
    const knownCost=costRow.precio_costo_usd!=null&&Number.isFinite(Number(costRow.precio_costo_usd))&&Number(costRow.precio_costo_usd)>0;
    const cost=knownCost?Number(costRow.precio_costo_usd):0,profit=knownCost?round2(paidTotal-cost):0;
    const stock=await tx.execute({sql:'UPDATE stock SET cantidad=cantidad-1 WHERE id=? AND cantidad>0',args:[Number(r.stock_id)]});
    if(stock.rowsAffected!==1)throw new BusinessError('Stock insuficiente',409);
    const sale=await tx.execute({sql:`INSERT INTO ventas(closer_id,nombre_comprador,producto,precio_venta_usd,costo_usd,ganancia_usd,comision_usd,pago_completo,monto_senado_usd,falta_pagar_usd,estado,stock_id,crm_conversation_id,payment_confirmed_by,metodo_pago,notas) VALUES(?,?,?,?,?,?,?,1,?,0,'Completada',?,?,?,?,?)`,args:[c.owner_id||adminId,c.name,q.product,paidTotal,cost,profit,round2(Math.max(0,profit)*.2),paidTotal,Number(r.stock_id),c.id,adminId,c.qualification.payment||'Verificado por administración',knownCost?'Venta desde Atención IA':'Venta desde Atención IA · costo pendiente de revisión administrativa']});
    const saleId=Number(sale.lastInsertRowid);
    await tx.execute({sql:'INSERT INTO facturas(venta_id,closer_id,numero,cliente_nombre,producto,precio_usd,monto_senado,falta_pagar,estado) VALUES(?,?,?,?,?,?,?,0,?)',args:[saleId,c.owner_id||adminId,`FX-IA-${saleId}-${Date.now()}`,c.name,q.product,paidTotal,paidTotal,'Emitida']});
    let customerId=c.customer_id;
    if(!customerId){const customer=await tx.execute({sql:'INSERT INTO clientes(nombre,telefono,canal_origen,cantidad_compras,total_comprado_usd,closer_id) VALUES(?,?,?,0,0,?)',args:[c.name,c.phone,c.channel,c.owner_id]});customerId=Number(customer.lastInsertRowid);}
    await tx.execute({sql:'UPDATE clientes SET cantidad_compras=cantidad_compras+1,total_comprado_usd=total_comprado_usd+?,cliente_recurrente=1 WHERE id=?',args:[paidTotal,customerId]});
    await tx.execute({sql:'UPDATE crm_contacts SET customer_id=?,verified_returning=1 WHERE id=?',args:[customerId,c.contact_id]});
    await tx.execute({sql:"UPDATE crm_reservations SET status='sold',sale_id=? WHERE id=?",args:[saleId,id]});
    await tx.execute({sql:"UPDATE crm_conversations SET status='won',mode='human',updated_at=? WHERE id=?",args:[nowIso(),c.id]});
    await snapshotOpportunity(c,tx);
    await tx.execute({sql:"UPDATE crm_opportunities SET status='won',closed_at=?,sale_id=? WHERE id=?",args:[nowIso(),saleId,c.opportunity_id]});
    if(c.lead_id)await tx.execute({sql:"UPDATE leads SET estado='Ganado' WHERE id=?",args:[c.lead_id]});
    await tx.commit();await event(c.id,'sale_confirmed',`Venta #${saleId} cobrada y stock descontado`,adminId);return {saleId};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
export function localStamp(date:Date):string {
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Salta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);return parts.replace(' ','T');
}
export function validSlot(iso:string,now=Date.now()):boolean {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00)?(?:-03:00)?$/.test(iso))return false;
  const d=new Date(iso.endsWith('-03:00')?iso:iso+'-03:00');
  if(!Number.isFinite(d.getTime())||d.getTime()<=now||d.getTime()>now+31*86400_000)return false;
  const local=localStamp(d),hour=Number(local.slice(11,13)),minute=Number(local.slice(14,16));
  if(local!==iso.slice(0,16))return false;
  const dow=new Date(local.slice(0,10)+'T12:00:00-03:00').getUTCDay();const early=[1,3,5,6].includes(dow);
  return minute%15===0&&hour>=(early?11:13)&&(hour*60+minute+15)<=(early?18:20)*60;
}
async function occupied(owner:number,stamp:string,tx:any=db,exclude?:number):Promise<boolean>{
  const r=await tx.execute({sql:`SELECT id FROM turnos WHERE closer_id=? AND COALESCE(estado,'Pendiente')<>'Cancelado' AND datetime(replace(fecha_hora,'T',' '))>datetime(?,'-15 minutes') AND datetime(replace(fecha_hora,'T',' '))<datetime(?,'+15 minutes') ${exclude?'AND id<>?':''} LIMIT 1`,args:exclude?[owner,stamp,stamp,exclude]:[owner,stamp,stamp]});return !!r.rows.length;
}
export async function checkSlot(owner:number,iso:string,tx:any=db,exclude?:number) {
  if(!validSlot(iso))throw new BusinessError('Elegí un turno futuro de 15 minutos dentro del horario de atención');
  const stamp=localStamp(new Date(iso.endsWith('-03:00')?iso:iso+'-03:00'));
  if(await occupied(owner,stamp,tx,exclude))throw new BusinessError('Ese horario ya está ocupado',409);return stamp;
}
export async function slots(owner:number):Promise<string[]> {
  const result:string[]=[];let time=Math.ceil((Date.now()+60_000)/900_000)*900_000;
  for(let i=0;i<96*8&&result.length<3;i++,time+=900_000){const stamp=localStamp(new Date(time));if(validSlot(stamp)&&!await occupied(owner,stamp))result.push(stamp+'-03:00');}
  return result;
}
export async function bookAppointment(id:number,iso:string,cause?:number){
  const c=await conversation(id);if(!c.owner_id)throw new BusinessError('Falta un closer activo para asignar el turno');
  if(c.sandbox){await checkSlot(Number(c.owner_id),iso);return {preview:true,fecha_hora:iso};}
  const tx=await db.transaction('write');try{
    const current=await conversation(id,tx);
    if(cause){const latest=(await tx.execute({sql:"SELECT MAX(id) AS id FROM crm_messages WHERE conversation_id=? AND direction='in' AND processable=1",args:[id]})).rows[0];if(current.mode!=='auto'||Number(latest.id)!==cause)throw new BusinessError('La conversación cambió');}
    if(cause){
      const previous=(await tx.execute({sql:"SELECT result FROM crm_actions WHERE conversation_id=? AND cause_message_id=? AND kind='appointment'",args:[id,cause]})).rows[0];
      if(previous){
        const result=JSON.parse(String(previous.result));
        const active=(await tx.execute({sql:"SELECT id FROM turnos WHERE id=? AND COALESCE(estado,'Pendiente')<>'Cancelado'",args:[result.id]})).rows[0];
        if(!active)throw new BusinessError('El equipo modificó el turno; coordinar uno nuevo');
        await tx.rollback();return result;
      }
    }
    const stamp=await checkSlot(Number(c.owner_id),iso,tx);
    const r=await tx.execute({sql:"INSERT INTO turnos(closer_id,cliente_nombre,telefono,fecha_hora,motivo,producto_objetivo,modelo_detalle,confirmado,estado,notas,cliente_id) VALUES(?,?,?,?,?,?,?,'Confirmado','Pendiente',?,?)",args:[c.owner_id,c.name,c.phone,stamp,'Compra','Otro',c.qualification.product||'',`Atención IA · conversación #${id}`,c.customer_id]});
    await tx.execute({sql:'INSERT INTO crm_appointment_slots(conversation_id,owner_id,start_at,turno_id) VALUES(?,?,?,?) ON CONFLICT(owner_id,start_at) DO UPDATE SET conversation_id=excluded.conversation_id,turno_id=excluded.turno_id',args:[id,c.owner_id,stamp,Number(r.lastInsertRowid)]});
    if(cause)await tx.execute({sql:"INSERT INTO crm_actions(conversation_id,cause_message_id,kind,result,created_at) VALUES(?,?,'appointment',?,?)",args:[id,cause,JSON.stringify({id:Number(r.lastInsertRowid),fecha_hora:stamp}),nowIso()]});
    await tx.commit();await event(id,'appointment_booked',stamp);return {id:Number(r.lastInsertRowid),fecha_hora:stamp};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
