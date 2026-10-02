import type {ErrorRequestHandler,RequestHandler} from 'express';
import {BusinessError} from './automation/repository';

export const apiNotFound:RequestHandler=(_req,res)=>{res.status(404).json({error:'Ruta no encontrada'});};

export const apiErrorHandler:ErrorRequestHandler=(error,req,res,_next)=>{
  if(res.headersSent)return;
  if(error instanceof BusinessError){res.status(error.status).json({error:error.message});return;}
  if(error?.type==='entity.too.large'){res.status(413).json({error:'La solicitud supera el tamaño permitido'});return;}
  if(error instanceof SyntaxError&&'body' in error){res.status(400).json({error:'El contenido JSON no es válido'});return;}
  console.error(`[api] Error no controlado en ${req.method} ${req.path}`);
  res.status(500).json({error:'Error interno'});
};
