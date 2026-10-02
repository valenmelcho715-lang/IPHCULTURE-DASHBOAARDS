import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {db} from '../db';
import {nowIso,BusinessError} from './repository';
export type IncomingAttachment={providerId?:string;url?:string;mime?:string;name?:string;sha256?:string};
export const mediaRoot=()=>path.resolve(process.env.MEDIA_DIR||'./private-media');
export function safeMediaUrl(value:string):URL {
  const u=new URL(value);
  const allowed=['fbcdn.net','fbsbx.com'];
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!(u.hostname==='graph.facebook.com'||allowed.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))))throw new Error('Origen de adjunto no permitido');
  return u;
}
export async function registerAttachments(messageId:number,c:any,items:IncomingAttachment[],tx:any=db){
  for(const item of items.slice(0,10)){
    if(!item.providerId&&!item.url)continue;
    if(item.url){try{safeMediaUrl(item.url);}catch{continue;}}
    await tx.execute({sql:'INSERT INTO crm_attachments(message_id,conversation_id,channel,provider_ref,source_url,mime,name,expected_sha256,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',args:[messageId,c.id,c.channel,item.providerId?.slice(0,200)||null,item.url?.slice(0,8000)||null,item.mime?.slice(0,100)||null,path.basename(item.name||'adjunto').slice(0,150),item.sha256||null,c.sandbox?'simulation':'pending',nowIso()]});
  }
}
async function downloadResponse(url:string,token?:string){
  let current=safeMediaUrl(url);
  for(let i=0;i<4;i++){
    const authorized=token&&['lookaside.fbsbx.com','graph.facebook.com'].includes(current.hostname);
    const r=await fetch(current.toString(),{headers:authorized?{Authorization:`Bearer ${token}`}:{},redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(r.status>=300&&r.status<400){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw new Error('Redirección inválida');current=safeMediaUrl(new URL(location,current).toString());continue;}
    if(!r.ok){await r.body?.cancel();throw new Error('El proveedor no entregó el adjunto');}return r;
  }throw new Error('Demasiadas redirecciones');
}
export async function storeResponse(r:globalThis.Response,key:string){
  const root=mediaRoot();await fs.promises.mkdir(root,{recursive:true,mode:0o700});
  if(!/^[a-f0-9-]+\.bin$/.test(key))throw new Error('Clave de archivo inválida');
  const max=25*1024*1024,expected=Number(r.headers.get('content-length')||0);
  if(expected>max||!r.body){await r.body?.cancel();throw new Error('Adjunto fuera del límite de 25 MB');}
  const stats=await fs.promises.statfs(root);if(stats.bavail*stats.bsize<max*4){await r.body.cancel();throw new Error('Espacio insuficiente para adjuntos');}
  const destination=path.join(root,key),temporary=destination+'.part';const file=await fs.promises.open(temporary,'wx',0o600);let size=0;const hash=crypto.createHash('sha256');
  try{for await(const chunk of r.body as any){size+=chunk.length;if(size>max)throw new Error('Adjunto fuera del límite de 25 MB');hash.update(chunk);await file.writeFile(chunk);}await file.sync();await file.close();await fs.promises.rename(temporary,destination);return {size,sha256:hash.digest('hex'),key};}
  catch(e){await file.close().catch(()=>{});await fs.promises.unlink(temporary).catch(()=>{});throw e;}
}
export async function processMedia(){
  if(process.env.ALLOW_MEDIA_DOWNLOADS!=='true')return;
  const cutoff=new Date(Date.now()-300000).toISOString();
  await db.execute({sql:"UPDATE crm_attachments SET status='pending' WHERE status='downloading' AND started_at<?",args:[cutoff]});
  const item:any=(await db.execute({sql:"SELECT a.* FROM crm_attachments a JOIN crm_conversations c ON c.id=a.conversation_id WHERE a.status='pending' AND c.sandbox=0 AND (a.retry_at IS NULL OR a.retry_at<=?) ORDER BY a.id LIMIT 1",args:[nowIso()]})).rows[0];if(!item)return;
  const claimed=await db.execute({sql:"UPDATE crm_attachments SET status='downloading',started_at=?,attempts=attempts+1 WHERE id=? AND status='pending'",args:[nowIso(),item.id]});if(!claimed.rowsAffected)return;
  try{
    let url=item.source_url,token:string|undefined,mime=item.mime;
    if(item.channel==='whatsapp'){
      token=process.env.WHATSAPP_ACCESS_TOKEN;const version=process.env.META_GRAPH_VERSION;
      if(!token||!/^v\d+\.\d+$/.test(version||'')||!/^\d+$/.test(item.provider_ref||''))throw new Error('Falta configurar acceso al adjunto de WhatsApp');
      const response=await fetch(`https://graph.facebook.com/${version}/${item.provider_ref}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok)throw new Error('No se pudo obtener el adjunto de WhatsApp');const info:any=await response.json();url=info.url;mime=info.mime_type||mime;
    }
    if(!url)throw new Error('Falta referencia de descarga');
    const used=Number((await db.execute("SELECT COALESCE(SUM(size_bytes),0) AS n FROM crm_attachments WHERE status='stored'")).rows[0].n);
    const quota=Number(process.env.MEDIA_QUOTA_GB||20)*1024**3;
    if(!Number.isFinite(quota)||used+25*1024**2>quota)throw new Error('Límite de almacenamiento de adjuntos alcanzado');
    const response=await downloadResponse(url,token);mime=String(mime||response.headers.get('content-type')||'application/octet-stream').split(';')[0];
    const stored=await storeResponse(response,crypto.randomUUID()+'.bin');
    if(item.expected_sha256&&Buffer.from(stored.sha256,'hex').toString('base64')!==item.expected_sha256&&stored.sha256!==item.expected_sha256){await fs.promises.unlink(path.join(mediaRoot(),stored.key));throw new Error('La integridad del adjunto no coincide');}
    await db.execute({sql:"UPDATE crm_attachments SET status='stored',storage_key=?,size_bytes=?,sha256=?,mime=?,source_url=NULL,error=NULL WHERE id=?",args:[stored.key,stored.size,stored.sha256,mime,item.id]});
  }catch(e){const message=e instanceof Error?e.message:'Error de almacenamiento';const allowed=/^(Falta|No se pudo|Origen|Adjunto|Espacio|Límite|La integridad|El proveedor|Demasiadas)/.test(message);await db.execute({sql:"UPDATE crm_attachments SET status=?,retry_at=?,error=? WHERE id=?",args:[Number(item.attempts)>=2?'failed':'pending',new Date(Date.now()+60000*2**Number(item.attempts)).toISOString(),allowed?message:'No se pudo almacenar el adjunto; revisar conexión y disco',item.id]});}
}
export function attachmentPath(key:string){if(!/^[a-f0-9-]+\.bin$/.test(key))throw new BusinessError('Adjunto inválido');return path.join(mediaRoot(),key);}
