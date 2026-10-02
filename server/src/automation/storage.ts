import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createClient} from '@libsql/client';
import {db} from '../db';
import {mediaRoot,attachmentPath} from './media';
import {nowIso,BusinessError} from './repository';
const execute=promisify(execFile);
const backupRoot=()=>path.resolve(process.env.BACKUP_DIR||'./backups');
export async function checksum(file:string){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function createSnapshot(){
  if(!(process.env.TURSO_DATABASE_URL||'').startsWith('file:'))throw new BusinessError('El respaldo integrado requiere SQLite local en volumen persistente');
  await fs.promises.mkdir(backupRoot(),{recursive:true,mode:0o700});
  const directory=path.join(backupRoot(),'snapshot-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());await fs.promises.mkdir(directory,{mode:0o700});
  const database=path.join(directory,'iphone-culture.db');
  try{
    await db.execute({sql:'VACUUM INTO ?',args:[database]});await fs.promises.chmod(database,0o600);
    const snapshot=createClient({url:'file:'+database});let attachments:any[],counts:any={};
    try{
      const check=await snapshot.execute('PRAGMA integrity_check');if(check.rows[0].integrity_check!=='ok')throw new Error('La copia de la base no pasó integridad');
      attachments=(await snapshot.execute("SELECT id,storage_key,size_bytes,sha256 FROM crm_attachments WHERE status='stored' ORDER BY id")).rows;
      for(const table of ['crm_contacts','crm_conversations','crm_messages','crm_opportunities','ventas'])counts[table]=Number((await snapshot.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
    }finally{snapshot.close();}
    await fs.promises.mkdir(path.join(directory,'media'),{mode:0o700});const files:any[]=[];
    for(const a of attachments){const target=path.join(directory,'media',String(a.storage_key));await fs.promises.link(attachmentPath(String(a.storage_key)),target).catch(()=>fs.promises.copyFile(attachmentPath(String(a.storage_key)),target,fs.constants.COPYFILE_FICLONE));await fs.promises.chmod(target,0o600);if(await checksum(target)!==a.sha256)throw new Error('Un adjunto no pasó la verificación de integridad');files.push({key:a.storage_key,size:Number(a.size_bytes),sha256:a.sha256});}
    const manifest={format:'iphone-culture-backup-v1',createdAt:nowIso(),databaseSha256:await checksum(database),counts,files};
    await fs.promises.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});return {directory,manifest};
  }catch(e){await fs.promises.rm(directory,{recursive:true,force:true});throw e;}
}
export async function verifySnapshot(directory:string){
  const manifest=JSON.parse(await fs.promises.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.format!=='iphone-culture-backup-v1')throw new Error('Formato de respaldo desconocido');
  const database=path.join(directory,'iphone-culture.db');if(await checksum(database)!==manifest.databaseSha256)throw new Error('La base no coincide con el respaldo');
  const client=createClient({url:'file:'+database});try{if((await client.execute('PRAGMA integrity_check')).rows[0].integrity_check!=='ok')throw new Error('Base dañada');}finally{client.close();}
  for(const f of manifest.files){if(!/^[a-f0-9-]+\.bin$/.test(f.key))throw new Error('Ruta de adjunto inválida');if(await checksum(path.join(directory,'media',f.key))!==f.sha256)throw new Error('Adjunto dañado');}
  return manifest;
}
export async function restoreSnapshot(directory:string,target:string){
  const destination=path.resolve(target);if(fs.existsSync(destination))throw new Error('El destino de recuperación debe ser una carpeta nueva; nunca se sobrescribe la base activa');
  const manifest=await verifySnapshot(directory);await fs.promises.mkdir(destination,{recursive:true,mode:0o700});
  try{await fs.promises.copyFile(path.join(directory,'iphone-culture.db'),path.join(destination,'iphone-culture.db'));await fs.promises.cp(path.join(directory,'media'),path.join(destination,'media'),{recursive:true,errorOnExist:true});await fs.promises.copyFile(path.join(directory,'manifest.json'),path.join(destination,'manifest.json'));await verifySnapshot(destination);
    // Una copia vieja puede contener envíos que Meta ya entregó después del backup.
    // Recuperar nunca los reenvía a ciegas ni reactiva la IA automáticamente.
    const recovered=createClient({url:'file:'+path.join(destination,'iphone-culture.db')});
    try{
      const row=(await recovered.execute('SELECT value FROM crm_settings WHERE id=1')).rows[0];const settings=JSON.parse(String(row.value));settings.enabled=false;
      await recovered.batch([
        {sql:'UPDATE crm_settings SET value=? WHERE id=1',args:[JSON.stringify(settings)]},
        "UPDATE crm_messages SET delivery='uncertain' WHERE id IN(SELECT message_id FROM crm_outbox WHERE status IN('pending','sending'))",
        "UPDATE crm_outbox SET status='uncertain',error='Recuperación desde respaldo: verificar en Meta antes de reenviar' WHERE status IN('pending','sending')",
        "UPDATE crm_jobs SET status='failed',error='Recuperación: revisar contexto antes de reprocesar' WHERE status IN('pending','processing')"
      ],'write');
      await recovered.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    }finally{recovered.close();}
    const restored={...manifest,sourceDatabaseSha256:manifest.databaseSha256,databaseSha256:await checksum(path.join(destination,'iphone-culture.db')),restoredAt:nowIso(),automationPaused:true};
    await fs.promises.writeFile(path.join(destination,'manifest.json'),JSON.stringify(restored,null,2),{mode:0o600});await verifySnapshot(destination);return restored;}
  catch(e){await fs.promises.rm(destination,{recursive:true,force:true});throw e;}
}
export async function restic(args:string[]){
  if(!process.env.RESTIC_REPOSITORY||(!process.env.RESTIC_PASSWORD_FILE&&!process.env.RESTIC_PASSWORD))throw new Error('Falta configurar el respaldo externo cifrado');
  if(process.env.NODE_ENV==='production'&&!/^s3:https:\/\//.test(process.env.RESTIC_REPOSITORY))throw new Error('En producción el respaldo externo debe usar un repositorio S3 con HTTPS');
  try{const result=await execute(process.env.RESTIC_BIN||'restic',args,{env:process.env,timeout:1800000,maxBuffer:8*1024*1024});return result.stdout;}
  catch{throw new Error('El respaldo externo no se pudo completar; revisar repositorio, credenciales, espacio y conectividad');}
}
let backupRunning=false;
export async function runBackup(){
  if(backupRunning)throw new BusinessError('Ya hay una copia de seguridad en curso',409);backupRunning=true;let runId=0;
  try{
    const r=await db.execute({sql:"INSERT INTO crm_storage_runs(kind,status,created_at) VALUES('backup','running',?)",args:[nowIso()]});runId=Number(r.lastInsertRowid);
    const snapshot=await createSnapshot();const external=!!process.env.RESTIC_REPOSITORY;
    if(external)await restic(['backup','--tag','iphone-culture','--host','iphone-culture',snapshot.directory]);
    await db.execute({sql:'UPDATE crm_storage_runs SET status=?,completed_at=?,detail=? WHERE id=?',args:[external?'external_ok':'local_only',nowIso(),JSON.stringify({snapshot:path.basename(snapshot.directory),counts:snapshot.manifest.counts,attachments:snapshot.manifest.files.length}),runId]});
    const entries=(await fs.promises.readdir(backupRoot())).filter(x=>/^snapshot-\d{4}-.+-[a-f0-9-]+$/.test(x)).sort();
    // Solo limpia snapshots propios ya completos; conserva las ocho copias locales más recientes.
    for(const name of entries.slice(0,-8)){const target=path.join(backupRoot(),name);if(fs.existsSync(path.join(target,'manifest.json')))await fs.promises.rm(target,{recursive:true,force:true});}
    return {status:external?'external_ok':'local_only',snapshot:path.basename(snapshot.directory)};
  }catch(e){if(runId)await db.execute({sql:"UPDATE crm_storage_runs SET status='failed',completed_at=?,detail='No se completó el respaldo. Revisar almacenamiento y configuración externa.' WHERE id=?",args:[nowIso(),runId]});throw e;}finally{backupRunning=false;}
}
export async function storageStatus(){
  const counts=(await db.execute("SELECT (SELECT COUNT(*) FROM crm_messages) AS messages,(SELECT COUNT(*) FROM crm_contacts WHERE id IN(SELECT contact_id FROM crm_conversations)) AS contacts,(SELECT COUNT(*) FROM crm_opportunities) AS opportunities,(SELECT COALESCE(SUM(size_bytes),0) FROM crm_attachments WHERE status='stored') AS media_bytes,(SELECT COUNT(*) FROM crm_attachments WHERE status='failed') AS failed_attachments")).rows[0];
  const runs=(await db.execute('SELECT * FROM crm_storage_runs ORDER BY id DESC LIMIT 10')).rows;
  let freeBytes:number|null=null;try{const stats=await fs.promises.statfs(mediaRoot());freeBytes=stats.bavail*stats.bsize;}catch{}
  return {counts,runs,freeBytes,mediaQuotaGb:Number(process.env.MEDIA_QUOTA_GB||20),persistentVolumeDeclared:process.env.PERSISTENT_STORAGE==='true',externalBackupConfigured:!!process.env.RESTIC_REPOSITORY,backupIntervalMinutes:backupIntervalMinutes(),mediaDownloadsEnabled:process.env.ALLOW_MEDIA_DOWNLOADS==='true',backupRunning,policy:'Historial sin eliminación automática. Archivar no borra. Copias locales: últimas 8. Copias externas: sin eliminación automática.'};
}

export function backupIntervalMinutes(){const n=Number(process.env.BACKUP_INTERVAL_MINUTES||60);return Number.isFinite(n)?Math.max(15,Math.min(1440,n)):60;}
