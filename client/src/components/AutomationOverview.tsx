import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Bot,ArrowUpRight} from 'lucide-react';
import {api} from '../lib/api';
export default function AutomationOverview(){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{let active=true;const load=()=>void api.get('/api/atencion/metrics').then(x=>{if(active)setData(x);}).catch(()=>{});load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer);};},[]);
  if(!data)return null;
  return <Link to="/atencion" className="block rounded-2xl border border-neon/20 bg-neon/5 p-4 mb-5 hover:border-neon/50 transition-colors"><div className="flex flex-wrap items-center gap-4 justify-between"><span className="font-semibold text-neon flex items-center gap-2"><Bot size={20}/>Atención IA<ArrowUpRight size={15}/></span><div className="flex flex-wrap gap-5 text-sm"><span><b>{data.stats.contacts||0}</b> <span className="text-slate-400">personas</span></span><span><b>{data.stats.human||0}</b> <span className="text-slate-400">para el equipo</span></span><span><b>{data.conversion||0}%</b> <span className="text-slate-400">cierre cobrado</span></span><span><b>{data.stats.recoverable||0}</b> <span className="text-slate-400">recuperables</span></span></div></div></Link>;
}
