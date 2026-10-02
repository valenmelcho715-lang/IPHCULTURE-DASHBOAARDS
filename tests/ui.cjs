// Prueba opcional de interfaz sobre `npm run demo`; nunca usa cuentas reales.
const fs=require('node:fs');const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']};
if(process.env.CHROME_BIN)options.executablePath=process.env.CHROME_BIN;
const root=process.env.DEMO_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch(options);try{
  fs.mkdirSync('artifacts',{recursive:true});const page=await browser.newPage({viewport:{width:1600,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=JSON.parse(fs.readFileSync('.demo/access.json','utf8'));
  await page.goto(root+'/login');await page.locator('input[type=email]').fill(login.email);await page.locator('input[type=password]').fill(login.password);await page.locator('button[type=submit]').click();await page.waitForURL(root+'/');
  await page.goto(root+'/atencion');await page.getByText('Ver conversaciones de prueba',{exact:true}).click();await page.getByRole('button',{name:/Consulta de compra/}).click();await page.getByText('Intención de compra',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'artifacts/atencion-escritorio.png',fullPage:true});
  await page.getByRole('button',{name:'Probar conversación'}).click();await page.getByRole('button',{name:'Hola, quiero un iPhone 13 en 12 cuotas.'}).click();await page.getByRole('button',{name:'Iniciar prueba',exact:true}).click();await page.getByText('Prueba procesada. No se envió ningún mensaje externo.',{exact:true}).waitFor();
  await page.getByLabel('Mensaje del cliente simulado').fill('No me escribas más');await page.getByRole('button',{name:'Simular cliente'}).click();await page.getByText('El cliente pidió no recibir mensajes',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Automatización',exact:true}).click();await page.getByRole('heading',{name:'Reglas comerciales'}).waitFor();await page.screenshot({path:'artifacts/automatizacion.png',fullPage:true});
  await page.getByRole('button',{name:'Resultados',exact:true}).click();await page.getByRole('heading',{name:'Reparto de conversaciones'}).waitFor();
  await page.getByRole('button',{name:'Conversaciones',exact:true}).click();await page.getByRole('button',{name:/Consulta de compra/}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/atencion-movil.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('UI: login, bandeja, simulación, baja, configuración, métricas y vista móvil verificados.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
