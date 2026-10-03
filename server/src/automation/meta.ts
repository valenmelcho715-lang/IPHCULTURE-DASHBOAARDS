import crypto from 'node:crypto';
import net from 'node:net';
import {Router} from 'express';
import {db} from '../db';
import {receive,BusinessError} from './repository';
import {transcriptionStatus} from './transcription';
export function validSignature(raw:Buffer,signature:string|undefined,secret:string):boolean {
  if(!secret||!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  const expected=crypto.createHmac('sha256',secret).update(raw).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature.slice(7),'hex'));
}
export function connectionStatus(){return {
  openai:!!process.env.OPENAI_API_KEY,
  whatsapp:!!(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.META_APP_SECRET&&process.env.META_VERIFY_TOKEN&&process.env.META_GRAPH_VERSION),
  instagram:!!(process.env.INSTAGRAM_ACCESS_TOKEN&&process.env.INSTAGRAM_ACCOUNT_ID&&process.env.META_APP_SECRET&&process.env.META_VERIFY_TOKEN&&process.env.META_GRAPH_VERSION),
  liveDelivery:process.env.ALLOW_LIVE_MESSAGES==='true',
  model:process.env.OPENAI_MODEL||'gpt-4.1-mini',demo:process.env.AUTO_AI_PROVIDER==='demo',transcription:transcriptionStatus(),
};}
export const metaRouter=Router();
async function configuredWhatsAppPhoneId():Promise<string|undefined>{
  try{
    const r=await db.execute("SELECT phone_number_id FROM meta_connection WHERE id=1");
    const value=String((r.rows[0] as any)?.phone_number_id||'');
    if(/^\d+$/.test(value))return value;
  }catch{}
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}
metaRouter.get('/',(req,res)=>{
  const token=process.env.META_VERIFY_TOKEN;
  if(token&&req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===token){res.type('text').send(String(req.query['hub.challenge']||''));return;}
  res.sendStatus(403);
});
metaRouter.post('/',async(req,res)=>{
  const raw=(req as any).rawBody as Buffer|undefined;
  if(!raw||!validSignature(raw,req.header('x-hub-signature-256'),process.env.META_APP_SECRET||'')){res.sendStatus(401);return;}
  try{
    const body=req.body;
    if(body.object==='whatsapp_business_account'){
      const configuredPhoneId=await configuredWhatsAppPhoneId();
      if(!configuredPhoneId){res.sendStatus(503);return;}
      for(const entry of body.entry||[])for(const change of entry.changes||[]){
        if(change.field&&change.field!=='messages')continue;
        const v=change.value||{};if(String(v.metadata?.phone_number_id)!==configuredPhoneId)continue;
        for(const m of v.messages||[]){
          if(!m.id||!m.from)continue;
          const content=m.text?.body||m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||m.button?.text||m.image?.caption||m.document?.caption||`[${String(m.type||'adjunto')}: requiere revisión]`;
          const time=new Date(Number(m.timestamp)*1000);
          await receive({channel:'whatsapp',externalId:String(m.from),providerId:String(m.id),name:v.contacts?.find((c:any)=>c.wa_id===m.from)?.profile?.name,text:String(content),kind:m.type||'text',attachments:m[m.type]?.id?[{providerId:String(m[m.type].id),mime:m[m.type].mime_type,name:m[m.type].filename,sha256:m[m.type].sha256}]:[],timestamp:Number.isFinite(time.getTime())?time.toISOString():undefined});
        }
        for(const status of v.statuses||[]){
          const ranks:Record<string,number>={sent:1,delivered:2,read:3};
          const r=await db.execute({sql:'SELECT id,delivery FROM crm_messages WHERE provider_id=?',args:[`whatsapp:0:${status.id}`]});
          const old:any=r.rows[0];
          if(old&&((status.status==='failed'&&(ranks[old.delivery]||0)<2)||(ranks[status.status]||0)>(ranks[old.delivery]||0))){
            await db.execute({sql:'UPDATE crm_messages SET delivery=? WHERE id=?',args:[String(status.status),Number(old.id)]});
            if(status.status==='failed')await db.execute({sql:"UPDATE crm_outbox SET status='failed',error='Meta informó que el mensaje no fue entregado' WHERE message_id=?",args:[Number(old.id)]});
          }
        }
      }
    }else if(body.object==='instagram'){
      if(!process.env.INSTAGRAM_ACCOUNT_ID){res.sendStatus(503);return;}
      for(const entry of body.entry||[]){
        if(String(entry.id)!==process.env.INSTAGRAM_ACCOUNT_ID)continue;
        for(const m of entry.messaging||[]){
          if(m.message?.is_echo||!m.message?.mid||!m.sender?.id||String(m.recipient?.id)!==process.env.INSTAGRAM_ACCOUNT_ID)continue;
          const time=new Date(Number(m.timestamp));
          await receive({channel:'instagram',externalId:String(m.sender.id),providerId:String(m.message.mid),text:String(m.message.text||'[Adjunto de Instagram: requiere revisión]'),kind:m.message.attachments?.length?'attachment':'text',attachments:(m.message.attachments||[]).filter((a:any)=>a.payload?.url).map((a:any)=>({url:a.payload.url,name:a.type||'adjunto'})),timestamp:Number.isFinite(time.getTime())?time.toISOString():undefined});
        }
      }
    }
    res.sendStatus(200);
  }catch{res.sendStatus(503);}
});
export class DeliveryError extends Error {constructor(message:string,public retryable=false,public uncertain=false){super(message);}}
export async function sendMeta(c:any,text:string,kind:string,options?:{name?:string;language?:string;url?:string}){
  if(c.sandbox)throw new BusinessError('Una simulación no puede enviar mensajes externos');
  if(process.env.ALLOW_LIVE_MESSAGES!=='true')throw new DeliveryError('La entrega en vivo está desactivada');
  const version=process.env.META_GRAPH_VERSION;
  if(!version||!/^v\d+\.\d+$/.test(version))throw new DeliveryError('Falta configurar la versión de Meta');
  if(kind==='image')try{const u=new URL(String(options?.url||''));if(u.protocol!=='https:'||u.username||u.password||u.port||net.isIP(u.hostname)||u.hostname==='localhost'||!u.hostname.includes('.'))throw new Error();}catch{throw new DeliveryError('La foto del producto no tiene una dirección HTTPS pública válida');}
  let url:string,token:string|undefined,body:any;
  if(c.channel==='whatsapp'){
    token=process.env.WHATSAPP_ACCESS_TOKEN;const phone=await configuredWhatsAppPhoneId();
    if(!token||!phone)throw new DeliveryError('WhatsApp no está conectado');
    url=`https://graph.facebook.com/${version}/${phone}/messages`;
    body=kind==='template'?{messaging_product:'whatsapp',to:c.external_id,type:'template',template:{name:options?.name,language:{code:options?.language}}}:kind==='image'?{messaging_product:'whatsapp',to:c.external_id,type:'image',image:{link:options?.url}}:{messaging_product:'whatsapp',to:c.external_id,type:'text',text:{body:text,preview_url:false}};
  }else{
    if(kind==='template')throw new DeliveryError('Instagram no permite este seguimiento automático');
    token=process.env.INSTAGRAM_ACCESS_TOKEN;const account=process.env.INSTAGRAM_ACCOUNT_ID;
    if(!token||!account)throw new DeliveryError('Instagram no está conectado');
    url=`https://graph.instagram.com/${version}/${account}/messages`;
    body=kind==='image'?{recipient:{id:c.external_id},message:{attachment:{type:'image',payload:{url:options?.url}}}}:{recipient:{id:c.external_id},message:{text}};
  }
  let r:globalThis.Response;
  try{r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw new DeliveryError('Meta no confirmó la recepción; revisar antes de reenviar',false,true);}
  if(r.status===429)throw new DeliveryError('Límite temporal de Meta',true);
  if(r.status>=500)throw new DeliveryError('Meta devolvió un error sin confirmar entrega',false,true);
  if(!r.ok)throw new DeliveryError(`Meta rechazó el envío (HTTP ${r.status})`);
  const result:any=await r.json();const id=result.messages?.[0]?.id||result.message_id;
  if(!id)throw new DeliveryError('Meta no devolvió identificador de envío',false,true);
  return String(id);
}
