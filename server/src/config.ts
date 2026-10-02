import path from 'node:path';
// La carpeta del proyecto es igual al ejecutar TypeScript o el build CommonJS.
export const projectRoot=path.resolve(__dirname,'../..');
for(const name of ['.env.local','.env']){
  try{process.loadEnvFile(path.join(projectRoot,name));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
}
if(!process.env.TURSO_DATABASE_URL)process.env.TURSO_DATABASE_URL=`file:${path.join(projectRoot,'iphone-culture.db')}`;
