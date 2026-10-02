// Diagnóstico local: no muestra secretos ni llama a ningún servicio externo.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['.env.local','.env']){try{process.loadEnvFile(path.join(root,file));}catch(e){if(e.code!=='ENOENT')throw e;}}
const present=name=>!!process.env[name]?.trim();
const live=process.argv.includes('--live');
const checks=[
 ['Build del servidor',fs.existsSync(path.join(root,'server/dist/index.js')),true],
 ['Build de la interfaz',fs.existsSync(path.join(root,'client/dist/index.html')),true],
 ['Secreto de sesión de producción',(process.env.JWT_SECRET||'').length>=32,true],
 ['Volúmenes persistentes declarados',process.env.PERSISTENT_STORAGE==='true',true],
 ['Respaldo externo configurado',present('RESTIC_REPOSITORY')&&(present('RESTIC_PASSWORD')||present('RESTIC_PASSWORD_FILE')),true],
 ['Carpeta privada para adjuntos',present('MEDIA_DIR'),true],
 ['Clave de IA',present('OPENAI_API_KEY'),true],
 ['Versión de Meta',/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||''),true],
 ['Verificación de webhooks',present('META_APP_SECRET')&&present('META_VERIFY_TOKEN'),true],
 ['Credenciales de WhatsApp',present('WHATSAPP_PHONE_NUMBER_ID')&&present('WHATSAPP_ACCESS_TOKEN'),true],
 ['Credenciales de Instagram',present('INSTAGRAM_ACCOUNT_ID')&&present('INSTAGRAM_ACCESS_TOKEN'),false],
 [live?'Envíos reales habilitados':'Envíos reales bloqueados para piloto',process.env.ALLOW_LIVE_MESSAGES===(live?'true':'false'),true],
];
for(const [label,ok,required] of checks)console.log(`${ok?'CONFIGURADO':'PENDIENTE'} · ${label}${required?'':' (opcional para piloto de WhatsApp)'}`);
console.log('Envíos reales: '+(process.env.ALLOW_LIVE_MESSAGES==='true'?'habilitados en servidor; también depende del panel':'desactivados'));
console.log('Este diagnóstico solo comprueba configuración local. No valida permisos, saldo ni entrega real.');
if(process.argv.includes('--strict')&&checks.some(([,ok,required])=>required&&!ok))process.exitCode=1;
