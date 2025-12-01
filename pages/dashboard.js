import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

function StatCard({ title, value, subtitle, icon, gradient }){
  return (
    <div className="p-4 rounded-lg shadow-sm hover:shadow-md transition" style={{background: gradient}}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-white/90">{title}</div>
          <div className="text-2xl font-bold text-white mt-1">{value}</div>
          {subtitle && <div className="text-xs text-white/80 mt-1">{subtitle}</div>}
        </div>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">{icon}</div>
      </div>
    </div>
  )
}

function Sparkline({ values, color='rgba(255,255,255,0.9)' }){
  const w = 120, h = 32; const max = Math.max(...values,1);
  const step = w / Math.max(1, values.length-1);
  const points = values.map((v,i)=>`${i*step},${h - (v/max)*(h-4)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DashboardPage(){
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(()=>{
    let mounted = true;
    async function load(){
      try{
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          if (res.status === 401) return router.replace('/login');
          throw new Error('Failed to load');
        }
        const json = await res.json();
        if (mounted) setData(json);
      }catch(e){
        console.error('dashboard load', e);
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return ()=>{ mounted = false; }
  },[]);

  if (loading) return (<div className="p-6">Carregando painel...</div>);
  if (!data) return (<div className="p-6">Erro ao carregar painel.</div>);

  const { totalDays, completedDays, totalWorkouts, totalVolume, lastWorkoutDate, weekly, recentDays, avgDurationSeconds } = data;
  const maxVol = Math.max(...weekly.map(w=>w.volume), 1);

  function formatDuration(sec){
    if (sec === null || sec === undefined) return '—';
    const s = Number(sec);
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s%60;
    if (h>0) return `${h}h ${m}m`;
    return `${m}m ${ss}s`;
  }

  const handleBarClick = (w) => {
    Swal.fire({ title: `Detalhes ${w.date}`, html: `Volume: <b>${Math.round(w.volume)}</b><br/>Sessões: <b>${w.sessions}</b>`, icon: 'info' });
  }

  return (
    <div className="mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <div className="text-sm text-slate-500">Visão geral dos seus treinos</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={()=>router.push('/app')}>Voltar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Dias" value={totalDays} subtitle={`Concluídos: ${completedDays}`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M7 14h.013" /><path d="M10.01 14h.005" /><path d="M13.01 14h.005" /><path d="M16.015 14h.005" /><path d="M13.015 17h.005" /><path d="M7.01 17h.005" /><path d="M10.01 17h.005" /></svg>} gradient="linear-gradient(90deg,#6366f1,#8b5cf6)" />

        <StatCard title="Exercícios" value={totalWorkouts} subtitle={`Último: ${lastWorkoutDate? new Date(lastWorkoutDate).toLocaleDateString() : '—'}`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M3 14l4 1l.5 -.5" /><path d="M12 18v-3l-3 -2.923l.75 -5.077" /><path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5" /><path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1" /><path d="M18 21l1 -11l2 -1" /></svg>} gradient="linear-gradient(90deg,#06b6d4,#0ea5e9)" />

        <StatCard title="Volume total" value={Math.round(totalVolume)} subtitle={"kg·reps"} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7a1 1 0 0 1 1 1v8a1 1 0 0 1 -2 0v-3h-1a1 1 0 0 1 0 -2h1v-3a1 1 0 0 1 1 -1" /><path d="M20 7a1 1 0 0 1 1 1v3h1a1 1 0 0 1 0 2h-1v3a1 1 0 0 1 -2 0v-8a1 1 0 0 1 1 -1" /><path d="M16 5a2 2 0 0 1 2 2v10a2 2 0 1 1 -4 0v-4h-4v4a2 2 0 1 1 -4 0v-10a2 2 0 1 1 4 0v4h4v-4a2 2 0 0 1 2 -2" /></svg>} gradient="linear-gradient(90deg,#10b981,#34d399)" />

        <StatCard title="Tempo médio" value={formatDuration(avgDurationSeconds)} subtitle={avgDurationSeconds ? `${Math.round(avgDurationSeconds/60)} min média` : '—'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 7v5l3 3" /><path d="M21 12a9 9 0 1 1 -18 0a9 9 0 0 1 18 0" /></svg>} gradient="linear-gradient(90deg,#f59e0b,#f97316)" />
      </div>

      <div className="mb-6 card p-4 relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Resumo semanal</h3>
          <div className="text-xs bg-white/90 px-2 py-1 rounded shadow-sm">Total semana: <b className="ml-1">{Math.round(weekly.reduce((s,x)=>s+(x.volume||0),0))}</b></div>
        </div>
        <div className="flex items-end gap-3 h-48">
          {weekly.map((w, idx) => (
            <div key={w.date} className="flex-1 text-center relative">
              <button
                onClick={()=>handleBarClick(w)}
                onMouseEnter={()=>setHoverInfo(w)}
                onMouseLeave={()=>setHoverInfo(null)}
                className="w-full h-full flex items-end justify-center"
                style={{background:'transparent'}}
                aria-label={`Dia ${w.date}`}>
                <div title={`${Math.round(w.volume)} kg·reps • ${w.sessions} sessões`} className="w-9 mx-auto rounded-t" style={{height: `${(w.volume/maxVol)*100}%`, background: `linear-gradient(180deg, rgba(99,102,241,0.95), rgba(139,92,246,0.9))`}} />
              </button>
              <div className="text-xs text-slate-500 mt-2">{w.date.slice(5)}</div>
            </div>
          ))}
          
        </div>

        {hoverInfo && (
          <div className="mt-3 text-sm text-slate-700"><b>{hoverInfo.date}</b>: {Math.round(hoverInfo.volume)} kg·reps • {hoverInfo.sessions} sessões</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-2">Últimos dias</h3>
          {recentDays.length===0 ? <div className="text-sm text-slate-500">Nenhum dia ainda.</div> : (
            <ul className="space-y-2">
              {recentDays.map(d => (
                <li key={d.id} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded cursor-pointer" onClick={()=>router.push(`/app`)}>
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-slate-500">{d.subtitle}</div>
                  </div>
                  <div className={`text-sm ${d.completed ? 'text-emerald-600' : 'text-slate-500'}`}>{d.completed ? 'Concluído' : 'Aberto'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium mb-2">Ações rápidas</h3>
          <div className="flex flex-col gap-2">
            <button className="btn" onClick={()=>router.push('/app')}>Ir para Meus Dias</button>
            <button className="btn" onClick={()=>Swal.fire({title:'Exportar CSV',text:'Exportar histórico CSV — Em breve',icon:'info'})}>Exportar histórico (CSV)</button>
            <button className="btn" onClick={()=>Swal.fire({title:'Sincronizar',text:'Sincronizar com nuvem — Em breve',icon:'info'})}>Sincronizar</button>
            <div className="mt-2">
              <div className="text-xs text-slate-500">Sparklines últimas 7 dias</div>
              <div className="mt-2">{<Sparkline values={weekly.map(w=>w.volume)} color="#0ea5e9"/>}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
