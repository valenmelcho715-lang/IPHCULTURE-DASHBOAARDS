import fs from 'node:fs';
import path from 'node:path';
import {db} from '../db';
import {BusinessError,nowIso} from './repository';

const AUDIO_MIME_EXTENSIONS:Record<string,string>={
  'audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'m4a','audio/m4a':'m4a',
  'audio/ogg':'ogg','audio/opus':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/webm':'webm',
};

export function transcriptionStatus(){return {
  configured:!!process.env.OPENAI_API_KEY,
  automatic:process.env.AUTO_TRANSCRIBE_AUDIO==='true'&&process.env.ALLOW_MEDIA_DOWNLOADS==='true',
  model:process.env.OPENAI_TRANSCRIPTION_MODEL||'gpt-transcribe',
};}

export async function transcribeAttachment(attachmentId:number):Promise<string>{
  const item:any=(await db.execute({sql:'SELECT * FROM crm_attachments WHERE id=?',args:[attachmentId]})).rows[0];
  if(!item)throw new BusinessError('Adjunto inexistente',404);
  if(item.transcript)return String(item.transcript);
  if(item.status!=='stored'||!item.storage_key)throw new BusinessError('El audio todavía no está disponible',409);
  const mime=String(item.mime||'').split(';')[0].toLowerCase();const ext=AUDIO_MIME_EXTENSIONS[mime];
  if(!ext)throw new BusinessError('El adjunto no es un audio compatible');
  const key=process.env.OPENAI_API_KEY;if(!key)throw new BusinessError('Falta conectar la clave de IA para transcribir audios',503);
  const filePath=path.join(path.resolve(process.env.MEDIA_DIR||'./private-media'),String(item.storage_key));const stat=await fs.promises.stat(filePath);
  if(stat.size<1||stat.size>25*1024*1024)throw new BusinessError('El audio debe pesar entre 1 byte y 25 MB');
  const form=new FormData();const bytes=await fs.promises.readFile(filePath);
  form.append('file',new Blob([bytes],{type:mime}),`audio-${attachmentId}.${ext}`);
  form.append('model',process.env.OPENAI_TRANSCRIPTION_MODEL||'gpt-transcribe');
  form.append('prompt','Conversación de ventas de iPhone Culture en español argentino. Productos Apple, iPhone, canje, batería, cuotas y Neuquén.');
  let response:globalThis.Response;
  try{response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(60000)});}catch{throw new BusinessError('No se pudo conectar con la transcripción de audio',503);}
  if(!response.ok){await response.body?.cancel();throw new BusinessError(`No se pudo transcribir el audio (HTTP ${response.status})`,503);}
  const result:any=await response.json();const text=String(result.text||'').trim();
  if(!text)throw new BusinessError('La transcripción no devolvió texto',503);
  await db.execute({sql:"UPDATE crm_attachments SET transcript=?,transcribed_at=?,transcription_status='completed' WHERE id=?",args:[text.slice(0,12000),nowIso(),attachmentId]});
  return text.slice(0,12000);
}
