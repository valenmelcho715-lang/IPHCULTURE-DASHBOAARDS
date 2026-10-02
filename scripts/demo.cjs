// Entorno de demostración aislado. Nunca usa la base real ni envía mensajes externos.
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const dir=path.resolve(process.env.DEMO_DIR||path.join(root,'.demo'));fs.mkdirSync(dir,{recursive:true});
process.env.TURSO_DATABASE_URL=`file:${path.join(dir,'demo.db')}`;
process.env.RESTIC_REPOSITORY='';process.env.ALLOW_MEDIA_DOWNLOADS='false';process.env.MEDIA_DIR=path.join(dir,'media');process.env.PERSISTENT_STORAGE='false';
process.env.AUTO_AI_PROVIDER='demo';process.env.ALLOW_LIVE_MESSAGES='false';process.env.DEMO_SEED='false';
process.env.NODE_ENV='development';process.env.HOST='127.0.0.1';process.env.PORT=process.env.DEMO_PORT||'8080';
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');process.env.OPENAI_API_KEY='';
process.env.BOOTSTRAP_ADMIN_EMAIL='';process.env.BOOTSTRAP_ADMIN_PASSWORD='';
process.env.BACKUP_DIR=path.join(dir,'backups');
const {db,initDb}=require('../server/dist/db');const {initAutomation}=require('../server/dist/automation/schema');
const {receive}=require('../server/dist/automation/repository');const {processJob}=require('../server/dist/automation/engine');
async function main(){
  await initDb();await initAutomation();
  const bcrypt=require('bcryptjs');const password=crypto.randomBytes(15).toString('base64url');
  for(const [nombre,email,rol] of [['Administrador demo','admin@demo.local','admin'],['Closer A','closer-a@demo.local','closer'],['Closer B','closer-b@demo.local','closer'],['Oficina demo','oficina@demo.local','oficina']]){
    await db.execute({sql:'INSERT INTO users(nombre,email,password_hash,rol) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash',args:[nombre,email,bcrypt.hashSync(password,10),rol]});
  }
  if(!Number((await db.execute('SELECT COUNT(*) AS n FROM stock')).rows[0].n)){
    for(const item of [['iPhone','iPhone 13','128GB','Negro','Seminuevo',420,600,3,'iPhone',91,3],['iPhone','iPhone 15','128GB','Azul','Nuevo sellado',650,800,2,'iPhone',100,12],['iPhone','iPhone 14 Pro','128GB','Violeta','OEM',550,700,2,'iPhone',100,6],['MacBook','MacBook Air M2','256GB','Medianoche','Nuevo sellado',650,850,1,'MacBook',null,12]])await db.execute({sql:'INSERT INTO stock(producto,modelo,capacidad,color,condicion,precio_costo_usd,precio_venta_usd,cantidad,categoria,battery_pct,warranty_months) VALUES(?,?,?,?,?,?,?,?,?,?,?)',args:item});
  }
  if(!Number((await db.execute('SELECT COUNT(*) AS n FROM crm_conversations')).rows[0].n)){
    for(const [name,channel,text] of [['Consulta de compra','whatsapp','Quiero un iPhone 13, tengo USD 600 y pago en efectivo hoy'],['Consulta de cuotas','instagram','Hola, quiero un iPhone 15 en 12 cuotas'],['Seña para verificar','whatsapp','Ya transferí la seña, te paso el comprobante'],['Garantía de un equipo','instagram','Mi teléfono no funciona, necesito usar la garantía']]){
      const r=await receive({channel,externalId:crypto.randomUUID(),providerId:crypto.randomUUID(),name,text,sandbox:true});await processJob({conversation_id:r.id,message_id:r.messageId});await db.execute({sql:"UPDATE crm_jobs SET status='done' WHERE message_id=?",args:[r.messageId]});
    }
  }
  fs.writeFileSync(path.join(dir,'access.json'),JSON.stringify({email:'admin@demo.local',password}),{mode:0o600});
  fs.writeFileSync(path.join(dir,'acceso.txt'),`Demostración local de iPhone Culture\nUsuario: admin@demo.local\nContraseña: ${password}\nURL: http://127.0.0.1:${process.env.PORT}/atencion\n`,{mode:0o600});
  console.log(`Demostración disponible en http://127.0.0.1:${process.env.PORT}/atencion. Datos de acceso guardados en la carpeta privada de demostración.`);
  require('../server/dist/index');
}
main().catch(()=>{console.error('No se pudo iniciar la demostración');process.exit(1);});
