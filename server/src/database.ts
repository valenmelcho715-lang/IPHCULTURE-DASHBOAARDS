import type {Client,Transaction} from '@libsql/client';

// SQLite admite un escritor por vez. @libsql/client abre otra conexión durante
// una transacción; ordenar el acceso evita SQLITE_BUSY y lecturas parciales.
// La red y la IA se ejecutan fuera de este bloqueo y pueden trabajar en paralelo.
export function serializeDatabase(client:Client):Client {
  let tail=Promise.resolve();
  async function acquire(){
    const previous=tail;let release!:()=>void;
    tail=new Promise<void>(resolve=>{release=resolve;});
    await previous;let released=false;
    return ()=>{if(!released){released=true;release();}};
  }
  const operations=new Set(['execute','batch','executeMultiple','migrate','sync','reconnect']);
  return new Proxy(client,{
    get(target,key){
      const value=Reflect.get(target,key,target);
      if(key==='transaction')return async(...args:any[])=>{
        const release=await acquire();let transaction:Transaction;
        try{transaction=await value.apply(target,args);}catch(e){release();throw e;}
        return new Proxy(transaction,{
          get(tx,method){
            const action=Reflect.get(tx,method,tx);
            if(method==='commit')return async()=>{await action.call(tx);release();};
            if(method==='rollback')return async()=>{try{await action.call(tx);}finally{release();}};
            if(method==='close')return ()=>{try{action.call(tx);}finally{release();}};
            return typeof action==='function'?action.bind(tx):action;
          }
        });
      };
      if(operations.has(String(key)))return async(...args:any[])=>{
        const release=await acquire();try{return await value.apply(target,args);}finally{release();}
      };
      return typeof value==='function'?value.bind(target):value;
    }
  });
}
