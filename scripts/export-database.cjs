#!/usr/bin/env node
// Exporta una base libSQL/Turso a SQLite sin imprimir URL ni credenciales.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@libsql/client');
const root=path.resolve(__dirname,'..');

const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
const scalar=value=>value===undefined?null:value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):value;
async function digest(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}

async function exportDatabase({sourceUrl,authToken,targetPath}){
  if(!sourceUrl)throw new Error('Falta SOURCE_DATABASE_URL');
  if(!/^file:/.test(sourceUrl)&&!authToken)throw new Error('Falta SOURCE_AUTH_TOKEN para la base remota');
  const destination=path.resolve(targetPath);if(fs.existsSync(destination))throw new Error('El archivo de destino ya existe');
  fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  const partial=destination+'.partial-'+crypto.randomUUID();
  const source=createClient(authToken?{url:sourceUrl,authToken}:{url:sourceUrl});
  const target=createClient({url:'file:'+partial});let transaction;const counts={};
  try{
    transaction=await source.transaction('read');
    const objects=(await transaction.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END,name")).rows;
    const tables=objects.filter(row=>row.type==='table');
    await target.execute('PRAGMA foreign_keys=OFF');
    for(const row of tables)await target.execute(String(row.sql));
    for(const row of tables){
      const table=String(row.name),columns=(await transaction.execute(`PRAGMA table_info(${quote(table)})`)).rows.map(item=>String(item.name));
      if(!columns.length)continue;
      const total=Number((await transaction.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)).rows[0].n);counts[table]=total;
      const insert=`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`;
      for(let offset=0;offset<total;offset+=250){
        const rows=(await transaction.execute({sql:`SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} LIMIT ? OFFSET ?`,args:[250,offset]})).rows;
        if(rows.length)await target.batch(rows.map(item=>({sql:insert,args:columns.map(column=>scalar(item[column]))})),'write');
      }
    }
    await transaction.commit();transaction=null;
    for(const row of objects.filter(item=>item.type!=='table'&&item.type!=='view'))await target.execute(String(row.sql));
    for(const row of objects.filter(item=>item.type==='view'))await target.execute(String(row.sql));
    await target.execute('PRAGMA foreign_keys=ON');
    const foreign=(await target.execute('PRAGMA foreign_key_check')).rows;
    if(foreign.length)throw new Error('La copia contiene referencias inválidas');
    const integrity=String((await target.execute('PRAGMA integrity_check')).rows[0].integrity_check);
    if(integrity!=='ok')throw new Error('La copia no pasó la verificación de integridad');
    target.close();source.close();
    fs.chmodSync(partial,0o600);fs.renameSync(partial,destination);
    return {format:'iphone-culture-libsql-export-v1',createdAt:new Date().toISOString(),integrity,counts,sha256:await digest(destination)};
  }catch(error){
    if(transaction)try{await transaction.rollback();}catch{}
    try{target.close();}catch{}try{source.close();}catch{}fs.rmSync(partial,{force:true});throw error;
  }
}

async function main(){
  for(const file of ['.env.local','.env'])try{process.loadEnvFile(path.join(root,file));}catch(error){if(error.code!=='ENOENT')throw error;}
  const output=process.argv[2];if(!output)throw new Error('Uso: npm run migration:export -- /ruta/nueva/export.db');
  const report=await exportDatabase({sourceUrl:process.env.SOURCE_DATABASE_URL,authToken:process.env.SOURCE_AUTH_TOKEN,targetPath:output});
  const reportPath=path.resolve(output)+'.json';fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(`Exportación verificada: ${Object.keys(report.counts).length} tablas, integridad ${report.integrity}. Informe: ${reportPath}`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={exportDatabase};
