const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createClient}=require('@libsql/client');const {exportDatabase}=require('../scripts/export-database.cjs');

test('La exportación remota conserva esquema, datos y caracteres especiales',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'iphone-culture-export-')),sourcePath=path.join(directory,'source.db'),targetPath=path.join(directory,'target.db');
  const source=createClient({url:'file:'+sourcePath});
  await source.execute('CREATE TABLE personas(id INTEGER PRIMARY KEY AUTOINCREMENT,nombre TEXT NOT NULL,archivo BLOB)');
  await source.execute({sql:'INSERT INTO personas(nombre,archivo) VALUES(?,?)',args:['José "Prueba"',new Uint8Array([0,1,2,255])]});
  await source.execute('CREATE INDEX personas_nombre ON personas(nombre)');source.close();
  const report=await exportDatabase({sourceUrl:'file:'+sourcePath,targetPath});assert.equal(report.integrity,'ok');assert.equal(report.counts.personas,1);assert.match(report.sha256,/^[a-f0-9]{64}$/);
  const target=createClient({url:'file:'+targetPath});const row=(await target.execute('SELECT nombre,archivo FROM personas')).rows[0];assert.equal(row.nombre,'José "Prueba"');assert.deepEqual(Array.from(new Uint8Array(row.archivo)),[0,1,2,255]);
  assert.equal(Number((await target.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='personas_nombre'")).rows[0].n),1);target.close();
  await assert.rejects(exportDatabase({sourceUrl:'file:'+sourcePath,targetPath}),/ya existe/);fs.rmSync(directory,{recursive:true,force:true});
});
