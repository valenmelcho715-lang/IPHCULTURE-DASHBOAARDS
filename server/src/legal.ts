import type {Request,Response} from 'express';

const shell=(title:string,body:string)=>`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>${title} | iPhone Culture</title>
  <style>
    :root{color-scheme:dark}body{margin:0;background:#080a0f;color:#e8edf5;font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:780px;margin:auto;padding:48px 22px 72px}h1,h2{line-height:1.2;color:#fff}h1{font-size:clamp(2rem,6vw,3rem)}h2{margin-top:2rem;font-size:1.2rem}a{color:#54e3c2}p,li{color:#c3ccda}.card{padding:18px 20px;border:1px solid #263142;border-radius:16px;background:#10151e}.muted{color:#8793a5;font-size:.92rem}
  </style>
</head>
<body><main>${body}</main></body>
</html>`;

export function privacyPolicy(_req:Request,res:Response):void{
  res.type('html').send(shell('Política de privacidad',`
    <p class="muted">Última actualización: 3 de octubre de 2026</p>
    <h1>Política de privacidad</h1>
    <p>iPhone Culture utiliza WhatsApp, Instagram y su sistema interno de atención para responder consultas, preparar cotizaciones, coordinar ventas, turnos, entregas y servicios de posventa.</p>
    <h2>Datos que tratamos</h2>
    <p>Podemos recibir el nombre de perfil, identificador o número de contacto, mensajes y archivos enviados voluntariamente, junto con los datos comerciales necesarios para atender la consulta. No solicitamos contraseñas, códigos de acceso ni datos completos de tarjetas.</p>
    <h2>Para qué los usamos</h2>
    <ul><li>Responder mensajes y mantener el historial de atención.</li><li>Preparar precios, canjes, financiación y seguimiento solicitados.</li><li>Derivar la conversación a una persona cuando sea necesario.</li><li>Proteger el servicio, prevenir abusos y cumplir obligaciones legales.</li></ul>
    <h2>Proveedores y transferencias</h2>
    <p>Usamos servicios tecnológicos necesarios para operar la mensajería, el alojamiento y las funciones de asistencia automatizada. Entre ellos pueden estar Meta Platforms, nuestro proveedor de infraestructura y proveedores de inteligencia artificial. Solo se comparte la información necesaria para prestar el servicio y se aplican sus términos y medidas de seguridad.</p>
    <h2>Conservación y seguridad</h2>
    <p>Conservamos los datos durante el tiempo razonablemente necesario para atender la relación comercial, resolver reclamos y cumplir obligaciones aplicables. Aplicamos controles de acceso, credenciales protegidas, registros de actividad y comunicaciones cifradas.</p>
    <h2>Tus opciones</h2>
    <p>Podés pedir acceso, corrección o eliminación de tus datos, u oponerte a comunicaciones de seguimiento, escribiendo por cualquiera de los canales oficiales de iPhone Culture. También podés consultar las <a href="/eliminar-datos">instrucciones para solicitar la eliminación de datos</a>.</p>
    <h2>Cambios</h2>
    <p>Podemos actualizar esta política cuando cambien el servicio o los requisitos aplicables. La versión vigente siempre estará publicada en esta URL.</p>
  `));
}

export function dataDeletion(_req:Request,res:Response):void{
  res.type('html').send(shell('Eliminación de datos',`
    <h1>Solicitud de eliminación de datos</h1>
    <div class="card">
      <p>Para solicitar la eliminación de tus datos, escribinos desde el mismo número o cuenta con la que te comunicaste y enviá el texto <strong>“Eliminar mis datos”</strong>.</p>
      <p>Verificaremos que la solicitud corresponda al titular y eliminaremos o anonimizaremos la información que no debamos conservar por obligaciones legales, contables, de garantía o prevención de fraude.</p>
      <p>Confirmaremos la recepción y el resultado por el mismo canal. Si no podés acceder a esa cuenta, contactanos por otro canal oficial de iPhone Culture e indicá cuál era el medio de contacto original.</p>
    </div>
    <p><a href="/privacidad">Volver a la política de privacidad</a></p>
  `));
}
