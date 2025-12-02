import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

function getInitials(nameOrEmail){
  if (!nameOrEmail) return '';
  const s = String(nameOrEmail).trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
}

function avatarColor(nameOrEmail){
  const s = String(nameOrEmail || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h},60%,45%)`;
}

function bmiCategory(bmi){
  if (bmi === null || bmi === undefined || Number.isNaN(bmi)) return '';
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
}

export default function ImcPage(){
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [offCanvasOpen, setOffCanvasOpen] = useState(false);
  const offCanvasRef = useRef(null);
  const [weight, setWeight] = useState(''); // kg
  const [height, setHeight] = useState(''); // cm
  const [bmi, setBmi] = useState(null);
  const [records, setRecords] = useState([]);
  const STORAGE_KEY = 'imc_records_v1';

  useEffect(()=>{ load(); },[]);

  // fetch user for header avatar and logout
  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try{
        const res = await fetch('/api/auth/me');
        if (!mounted) return;
        if (!res.ok) return setUser(null);
        const u = await res.json(); setUser(u);
      }catch(e){ if (mounted) setUser(null); }
    })();
    return ()=>{ mounted = false; };
  },[]);

  function load(){
    (async ()=>{
      try{
        const res = await fetch('/api/imc');
        if (res.status === 401) return router.replace('/login');
        const data = await res.json();
        const norm = Array.isArray(data) ? data.map(r => ({
          ...r,
          bmi: r.bmi === null || r.bmi === undefined ? null : Number(r.bmi),
          weight: r.weight === null || r.weight === undefined ? null : Number(r.weight),
          height: r.height === null || r.height === undefined ? null : Number(r.height)
        })) : [];
        setRecords(norm);
      }catch(e){ setRecords([]); }
    })();
  }

  function persist(arr){
    setRecords(arr);
  }

  function compute(){
    const w = Number(String(weight).replace(',','.') || '0');
    const hRaw = String(height).replace(',','.');
    let h = Number(hRaw);
    if (!h) { setBmi(null); return; }
    if (h > 10) h = h / 100; // assume input in cm if >10
    if (h <= 0) { setBmi(null); return; }
    const val = w / (h * h);
    const rounded = Math.round(val * 100) / 100;
    setBmi(Number.isFinite(rounded) ? rounded : null);
  }

  function saveRecord(){
    if (!bmi) return;
    (async ()=>{
      try{
        const body = { weight: Number(weight)||0, height: Number(height)||0, bmi };
        const res = await fetch('/api/imc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.status === 401) return router.replace('/login');
        if (!res.ok) return alert('Falha ao salvar registro');
        const created = await res.json();
        persist([created].concat(records).slice(0,500));
      }catch(e){ console.error(e); alert('Erro ao salvar registro'); }
    })();
  }

  function remove(id){
    (async ()=>{
      try{
        const res = await fetch(`/api/imc/${id}`, { method: 'DELETE' });
        if (res.status === 401) return router.replace('/login');
        if (!res.ok) return alert('Falha ao remover registro');
        persist(records.filter(r => r.id !== id));
      }catch(e){ console.error(e); alert('Erro ao remover registro'); }
    })();
  }

  function clearAll(){
    if (!confirm('Remover todos os registros de IMC?')) return;
    (async ()=>{
      try{
        const res = await fetch('/api/imc', { method: 'DELETE' });
        if (res.status === 401) return router.replace('/login');
        if (!res.ok) return alert('Falha ao limpar registros');
        persist([]);
      }catch(e){ console.error(e); alert('Erro ao limpar registros'); }
    })();
  }

  // close off-canvas on outside click or ESC
  useEffect(()=>{
    function onDoc(e){
      if (!offCanvasRef.current) return;
      if (!offCanvasRef.current.contains(e.target)) setOffCanvasOpen(false);
    }
    function onKey(e){ if (e.key === 'Escape') setOffCanvasOpen(false); }
    if (offCanvasOpen) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return ()=>{
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  },[offCanvasOpen]);

  function exportCSV(){
    const header = ['id','date','weight','height','bmi'];
    const rows = records.map(r => [r.id, r.date, r.weight, r.height, r.bmi]);
    const csv = [header].concat(rows).map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'imc_records.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  const stats = (function(){
    if (!records || records.length===0) return { count:0, avg:0, min:0, max:0 };
    const arr = records.map(r => r.bmi).filter(v => Number.isFinite(v));
    if (arr.length===0) return { count: records.length, avg:0, min:0, max:0 };
    const sum = arr.reduce((s,x)=>s+x,0);
    return { count: records.length, avg: Math.round((sum/arr.length)*100)/100, min: Math.min(...arr), max: Math.max(...arr) };
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <style jsx global>{`
        /* Off-canvas panel transitions: slower so user sees sliding */
        .offcanvas-panel {
          transform: translateX(100%);
          transition: transform 700ms cubic-bezier(.16,1,.3,1);
          will-change: transform;
        }
        .offcanvas-panel.offcanvas-open {
          transform: translateX(0);
        }
        /* overlay smooth fade */
        .fixed.inset-0.bg-black\/40 {
          transition: opacity 520ms ease;
        }

        @media (min-width: 1024px) {
          header.header { position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 80; background: #fff; box-shadow: 0 2px 8px rgba(2,6,23,0.04); display: flex; align-items: center; height: 64px; }
          .offcanvas-panel { z-index: 90; }
          main { min-height: calc(100vh - 64px); padding-top: 64px; }
        }
      `}</style>
      <header className="header p-4 bg-white shadow-sm flex items-center justify-between lg:fixed lg:top-0 lg:left-0 lg:right-0 lg:h-16 lg:z-50">
        <div className="flex items-center gap-3">
          <img src="/images/TRAINHUB.png" alt="TrainHub" className="h-8" />
        </div>
        <div className="flex gap-2 items-center">
          {/* menu button replaces voltar — abre off-canvas */}
          <button type="button" onClick={(e)=>{ e.preventDefault(); setOffCanvasOpen(v=>!v); }} className="flex items-center justify-center p-2" aria-haspopup="true" aria-expanded={offCanvasOpen} aria-label="Abrir menu" title="Abrir menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <path d="M10 6h10" />
              <path d="M4 12h16" />
              <path d="M7 12h13" />
              <path d="M4 18h10" />
            </svg>
          </button>
        </div>
      </header>

      <main className="p-4 w-full lg:pt-16">
        {/* Off-canvas overlay and panel (same behaviour as app.js) */}
        <>
          <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${offCanvasOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={()=>setOffCanvasOpen(false)} aria-hidden />
          <aside ref={offCanvasRef} className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 offcanvas-panel ${offCanvasOpen ? 'offcanvas-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!offCanvasOpen}>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: '#d4f522', color: '#072000' }} aria-hidden>
                {getInitials(user ? (user.name || user.email) : '')}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{user ? (user.name ? user.name : user.email) : 'Usuário'}</div>
                  <div className="text-xs text-slate-500">{user ? (user.email ? user.email : '') : ''}</div>
                </div>
                <div>
                  <button className="p-2 rounded hover:bg-slate-100" onClick={async ()=>{ setOffCanvasOpen(false); await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); }} aria-label="Sair">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M10 8v-2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-2" />
                      <path d="M15 12h-12l3 -3" />
                      <path d="M6 15l-3 -3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <nav className="p-4">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" onClick={()=>{ setOffCanvasOpen(false); router.push('/dashboard'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-600" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M8 3a3 3 0 0 1 3 3v1a3 3 0 0 1 -3 3h-2a3 3 0 0 1 -3 -3v-1a3 3 0 0 1 3 -3z" />
                  <path d="M8 12a3 3 0 0 1 3 3v3a3 3 0 0 1 -3 3h-2a3 3 0 0 1 -3 -3v-3a3 3 0 0 1 3 -3z" />
                  <path d="M18 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-2a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3z" />
                </svg>
                <span>Dashboard</span>
              </button>

              <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2 mt-2" onClick={()=>{ setOffCanvasOpen(false); router.push('/app'); }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-600" preserveAspectRatio="xMidYMid meet" aria-hidden>
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M4 7a1 1 0 0 1 1 1v8a1 1 0 0 1-2 0v-3H2a1 1 0 0 1 0-2h1V8a1 1 0 0 1 1-1" />
                  <path d="M20 7a1 1 0 0 1 1 1v3h1a1 1 0 0 1 0 2h-1v3a1 1 0 0 1-2 0v-8a1 1 0 0 1 1-1" />
                  <path d="M16 5a2 2 0 0 1 2 2v10a2 2 0 1 1-4 0v-4h-4v4a2 2 0 1 1-4 0V7a2 2 0 1 1 4 0v4h4V7a2 2 0 0 1 2-2" />
                </svg>
                <span>Treinos</span>
              </button>
            </nav>
          </aside>
        </>
        <section className="card p-4">
          <h2 className="font-semibold text-lg mb-2">Calculadora de IMC</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col">
              <span className="text-sm text-slate-600">Peso (kg)</span>
              <input className="mt-1 p-2 border rounded" inputMode="decimal" value={weight} onChange={(e)=>setWeight(e.target.value)} placeholder="Ex: 72.5" />
            </label>
            <label className="flex flex-col">
              <span className="text-sm text-slate-600">Altura (cm ou m)</span>
              <input className="mt-1 p-2 border rounded" inputMode="decimal" value={height} onChange={(e)=>setHeight(e.target.value)} placeholder="Ex: 175 ou 1.75" />
            </label>
            <div className="flex items-end">
              <div className="w-full flex gap-2">
                <button aria-label="Calcular" title="Calcular" className="btn px-3 py-2 rounded flex items-center justify-center" style={{ background: '#d4f522', color: '#072000' }} onClick={compute}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M18 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3zm-10 15a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm4 0a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm4 0a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm-8 -4a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm4 0a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm4 0a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883zm-1 -7h-6a2 2 0 0 0 -2 2v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2 -2v-1a2 2 0 0 0 -2 -2z" />
                  </svg>
                </button>
                <button aria-label="Salvar" title="Salvar" className="btn px-3 py-2 rounded flex items-center justify-center" style={{ background: '#d4f522', color: '#072000' }} onClick={saveRecord} disabled={!bmi}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
                    <path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                    <path d="M14 4l0 4l-6 0l0 -4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-slate-600">Resultado</div>
            <div className="mt-2 inline-flex items-baseline gap-3">
              <div className="text-3xl font-mono">{bmi ?? '—'}</div>
              <div className="text-sm text-slate-600">{bmi ? `(${bmiCategory(bmi)})` : ''}</div>
            </div>
          </div>
        </section>

        <section className="mt-4 card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Histórico</h3>
            <div className="flex items-center gap-2">
              <button className="btn text-sm px-3 py-1" onClick={exportCSV} disabled={!records.length}>Exportar CSV</button>
              <button className="btn text-sm px-3 py-1 text-red-600" onClick={clearAll} disabled={!records.length}>Limpar</button>
            </div>
          </div>

          {records.length===0 ? (
            <div className="text-sm text-slate-500">Nenhum registro salvo ainda. Calcule e salve seu IMC.</div>
          ) : (
            <div>
              <div className="text-sm text-slate-600 mb-2">Relatório rápido: {stats.count} registros • Média {stats.avg} • Mín {stats.min} • Máx {stats.max}</div>
              <ul className="space-y-2">
                {records.map(r => (
                  <li key={r.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="text-sm font-medium">{new Date(r.date).toLocaleString()}</div>
                      <div className="text-sm text-slate-600">Peso: {r.weight} kg • Altura: {r.height} • IMC: {r.bmi} ({bmiCategory(r.bmi)})</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button className="btn text-sm text-red-600" onClick={()=>remove(r.id)}>Remover</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
