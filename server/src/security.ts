import crypto from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';

type Attempt = {count:number; resetAt:number};
const attempts = new Map<string, Attempt>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginKey(req:Request):string {
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase().slice(0,254):'';
  // No conservamos direcciones IP ni correos en claro dentro del proceso.
  return crypto.createHash('sha256').update(`${req.ip}|${email}`).digest('hex');
}

export function loginRateLimit(req:Request,res:Response,next:NextFunction):void {
  const now=Date.now(),key=loginKey(req),prior=attempts.get(key);
  const current=!prior||prior.resetAt<=now?{count:0,resetAt:now+LOGIN_WINDOW_MS}:prior;
  current.count+=1;attempts.set(key,current);
  res.setHeader('RateLimit-Limit',String(LOGIN_MAX_ATTEMPTS));
  res.setHeader('RateLimit-Remaining',String(Math.max(0,LOGIN_MAX_ATTEMPTS-current.count)));
  res.setHeader('RateLimit-Reset',String(Math.ceil(current.resetAt/1000)));
  if(current.count>LOGIN_MAX_ATTEMPTS){
    res.setHeader('Retry-After',String(Math.ceil((current.resetAt-now)/1000)));
    res.status(429).json({error:'Demasiados intentos. Esperá unos minutos antes de volver a probar.'});return;
  }
  // Evita crecimiento indefinido bajo tráfico hostil sin guardar datos identificables.
  if(attempts.size>5000)for(const [candidate,value] of attempts)if(value.resetAt<=now)attempts.delete(candidate);
  next();
}

export function securityHeaders(req:Request,res:Response,next:NextFunction):void {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  // Embedded Signup usa el SDK de Meta y una ventana emergente que devuelve el
  // codigo temporal al panel. `same-origin` aisla esa ventana y una CSP solo
  // local impide que el SDK cargue, dejando el boton de conexion deshabilitado.
  res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
  if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self' https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://graph.facebook.com https://www.facebook.com https://connect.facebook.net; frame-src https://www.facebook.com https://web.facebook.com"
  );
  if(process.env.NODE_ENV==='production'&&(req.secure||req.header('x-forwarded-proto')==='https'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
}
