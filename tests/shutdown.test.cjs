const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {spawn}=require('node:child_process');

test('SIGTERM espera el apagado ordenado y termina sin error',{timeout:15000},async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'iphone-culture-shutdown-'));let output='';
  const child=spawn(process.execPath,['scripts/demo.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DEMO_PORT:'0',DEMO_DIR:directory},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
  try{
    await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(new Error('El servidor no inició')),10000);const inspect=data=>{if(String(data).includes('API lista')){clearTimeout(deadline);child.stdout.off('data',inspect);resolve();}};child.stdout.on('data',inspect);child.once('error',reject);});
    child.kill('SIGTERM');const result=await new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
    assert.deepEqual(result,{code:0,signal:null});assert.match(output,/Apagado ordenado por SIGTERM/);assert.doesNotMatch(output,/excedió|No se pudo completar/);
  }finally{if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});}
});
