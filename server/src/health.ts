import type {RequestHandler} from 'express';
import {db} from './db';

export const healthHandler:RequestHandler=async(_req,res)=>{
  try{
    await db.execute('SELECT 1 AS healthy');
    res.json({ok:true,service:'iphone-culture',database:'available',time:new Date().toISOString()});
  }catch{
    res.status(503).json({ok:false,service:'iphone-culture',database:'unavailable',time:new Date().toISOString()});
  }
};
