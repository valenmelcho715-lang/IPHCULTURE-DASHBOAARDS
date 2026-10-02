// Operaciones de recuperación solo por consola del servidor; no imprimen secretos.
require('../server/dist/config');
const fs=require('node:fs'),path=require('node:path');
const {db,initDb}=require('../server/dist/db'),{initAutomation}=require('../server/dist/automation/schema');
const storage=require('../server/dist/automation/storage');
async function main(){
 const [command,source,target]=process.argv.slice(2);
 if(command==='restore'){if(!source||!target)throw new Error('Uso: restore CARPETA_SNAPSHOT CARPETA_NUEVA');const m=await storage.restoreSnapshot(path.resolve(source),target);console.log(JSON.stringify({restored:true,counts:m.counts}));return;}
 if(command==='verify'){if(!source)throw new Error('Indicá una carpeta de snapshot');const m=await storage.verifySnapshot(path.resolve(source));console.log(JSON.stringify({verified:true,counts:m.counts}));return;}
 if(command==='external-init'){await storage.restic(['init']);console.log('Repositorio externo inicializado');return;}
 if(command==='external-check'){await storage.restic(['check','--read-data']);console.log('Verificación del repositorio externo completada');return;}
 if(command==='external-restore'){if(!source||!target||fs.existsSync(path.resolve(target)))throw new Error('Uso: external-restore SNAPSHOT_ID CARPETA_NUEVA');if(!/^(latest|[a-f0-9]{8,64})$/.test(source))throw new Error('Identificador de snapshot inválido');await storage.restic(['restore',source,'--tag','iphone-culture','--target',path.resolve(target)]);console.log('Descarga completada. Localizá manifest.json y ejecutá verify antes de recuperar.');return;}
 if(!['backup','status'].includes(command))throw new Error('Comandos: backup, status, verify, restore, external-init, external-check, external-restore');
 await initDb();await initAutomation();console.log(JSON.stringify(command==='backup'?await storage.runBackup():await storage.storageStatus(),null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.close());
