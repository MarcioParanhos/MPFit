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

function CategoryBadge({ bmi }){
  if (bmi === null || bmi === undefined || Number.isNaN(bmi)) return null;
  const cat = bmiCategory(bmi);
  let classes = 'inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ';
  // choose gentle background + darker text for contrast
  if (cat === 'Abaixo do peso') classes += 'bg-blue-100 text-blue-800';
  else if (cat === 'Normal') classes += 'bg-emerald-100 text-emerald-800';
  else if (cat === 'Sobrepeso') classes += 'bg-amber-100 text-amber-800';
  else classes += 'bg-red-100 text-red-800';
  return <span className={classes} aria-hidden>{cat}</span>;
}

export default function ImcPage(){
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [offCanvasOpen, setOffCanvasOpen] = useState(false);
  const offCanvasRef = useRef(null);
  // offcanvas user dropdown state
  const [offcanvasUserDropdownOpen, setOffcanvasUserDropdownOpen] = useState(false);
  const offcanvasUserDropdownRef = useRef(null);
  // logout modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutModalLoading, setLogoutModalLoading] = useState(false);
  const [logoutModalError, setLogoutModalError] = useState('');
  const logoutModalFirstRef = useRef(null);
  // help modal for IMC info
  const [showHelpModal, setShowHelpModal] = useState(false);
  const helpModalFirstRef = useRef(null);
  // IMC goal state (persisted in localStorage)
  const [goalBmi, setGoalBmi] = useState('');
  const [predictedDate, setPredictedDate] = useState(null);
  const [weight, setWeight] = useState(''); // kg
  const [height, setHeight] = useState(''); // cm
  const [bmi, setBmi] = useState(null);
  const [records, setRecords] = useState([]);
  const STORAGE_KEY = 'imc_records_v1';

  useEffect(()=>{ load(); },[]);

  // load goal from localStorage
  useEffect(()=>{
    try{
      const raw = localStorage.getItem('imc_goal_bmi');
      if (raw) setGoalBmi(raw);
    }catch(e){}
  },[]);

  // recompute prediction when records or goal change
  useEffect(()=>{
    if (!goalBmi) { setPredictedDate(null); return; }
    const g = Number(String(goalBmi).replace(',','.'));
    if (!Number.isFinite(g)) { setPredictedDate(null); return; }
    const pd = computeTrendPrediction(records, g);
    setPredictedDate(pd);
  },[records, goalBmi]);

  function saveGoal(){
    try{ localStorage.setItem('imc_goal_bmi', String(goalBmi)); }catch(e){}
    const g = Number(String(goalBmi).replace(',','.'));
    const pd = computeTrendPrediction(records, g);
    setPredictedDate(pd);
  }

  function clearGoal(){
    try{ localStorage.removeItem('imc_goal_bmi'); }catch(e){}
    setGoalBmi(''); setPredictedDate(null);
  }

  // compute simple linear regression on recent records to predict when BMI will reach goal
  function computeTrendPrediction(recordsArr, goal){
    if (!Array.isArray(recordsArr) || recordsArr.length < 2) return null;
    // use last up to 10 chronological points (oldest -> newest)
    const pts = recordsArr.slice().reverse().slice(-10).filter(r => r && Number.isFinite(r.bmi) && r.date).map(r=>({ t: new Date(r.date).getTime(), y: Number(r.bmi) }));
    if (pts.length < 2) return null;
    // linear regression y = m*t + b
    const n = pts.length;
    const sumT = pts.reduce((s,p)=>s+p.t,0);
    const sumY = pts.reduce((s,p)=>s+p.y,0);
    const sumTT = pts.reduce((s,p)=>s+p.t*p.t,0);
    const sumTY = pts.reduce((s,p)=>s+p.t*p.y,0);
    const denom = (n*sumTT - sumT*sumT);
    if (!denom) return null;
    const m = (n*sumTY - sumT*sumY)/denom;
    const b = (sumY - m*sumT)/n;
    if (!Number.isFinite(m) || Math.abs(m) < 1e-12) return null;
    const tGoal = (goal - b)/m;
    if (!Number.isFinite(tGoal)) return null;
    return new Date(Math.round(tGoal));
  }

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

  async function handleConfirmLogout(){
    try{
      setLogoutModalError('');
      setLogoutModalLoading(true);
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      setLogoutModalLoading(false);
      setShowLogoutModal(false);
      if (res.status === 401) return router.replace('/login');
      if (!res.ok) return setLogoutModalError('Falha ao sair');
      router.replace('/login');
    }catch(e){ setLogoutModalLoading(false); setLogoutModalError('Erro ao sair'); }
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

  // close offcanvas user dropdown when clicking outside or pressing Escape
  useEffect(()=>{
    if (!offcanvasUserDropdownOpen) return;
    function onDoc(e){ if (!offcanvasUserDropdownRef.current) return; if (!offcanvasUserDropdownRef.current.contains(e.target)) setOffcanvasUserDropdownOpen(false); }
    function onKey(e){ if (e.key === 'Escape') setOffcanvasUserDropdownOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return ()=>{
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  },[offcanvasUserDropdownOpen]);

  // focus first element in logout modal when opened
  useEffect(()=>{
    if (!showLogoutModal) return;
    const t = setTimeout(()=>{ try{ logoutModalFirstRef.current?.focus(); }catch(e){} }, 60);
    return ()=>clearTimeout(t);
  },[showLogoutModal]);

  // focus first element in help modal when opened
  useEffect(()=>{
    if (!showHelpModal) return;
    const t = setTimeout(()=>{ try{ helpModalFirstRef.current?.focus(); }catch(e){} }, 60);
    return ()=>clearTimeout(t);
  },[showHelpModal]);

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
                <div className="relative">
                  <button type="button" onClick={()=>setOffcanvasUserDropdownOpen(v=>!v)} className="text-left" aria-haspopup="true" aria-expanded={offcanvasUserDropdownOpen}>
                    <div className="font-semibold">{user ? (user.name ? user.name : user.email) : 'Usuário'}</div>
                    <div className="text-xs text-slate-500">{user ? (user.email ? user.email : '') : ''}</div>
                  </button>
                  {offcanvasUserDropdownOpen && (
                    <div ref={offcanvasUserDropdownRef} className="absolute left-0 mt-2 w-44 bg-white border rounded shadow z-50" role="menu">
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50" role="menuitem" onClick={()=>{ setOffCanvasOpen(false); setOffcanvasUserDropdownOpen(false); router.push('/settings'); }}>
                        Configurações
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-rose-600" role="menuitem" onClick={()=>{ setOffcanvasUserDropdownOpen(false); setShowLogoutModal(true); }}>
                        Sair
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <button aria-label="Fechar" title="Fechar" className="p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setOffCanvasOpen(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
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

          {showLogoutModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="fixed inset-0 bg-black/40" onClick={()=>setShowLogoutModal(false)} aria-hidden />
              <div className="bg-white rounded shadow-lg p-4 z-60 max-w-lg w-full mx-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">!
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Sair</div>
                    <div className="text-sm text-slate-600 mt-1">Tem certeza que deseja sair da sua conta?</div>
                  </div>
                </div>
                {logoutModalError ? <div className="text-sm text-rose-600 mt-3">{logoutModalError}</div> : null}
                <div className="mt-4 flex gap-2 justify-end">
                  <button ref={logoutModalFirstRef} className="px-3 py-2 rounded border" onClick={()=>setShowLogoutModal(false)} disabled={logoutModalLoading}>Cancelar</button>
                  <button className="px-3 py-2 rounded" style={{ background: '#d4f522', color: '#072000' }} onClick={handleConfirmLogout} disabled={logoutModalLoading}>{logoutModalLoading ? 'Saindo...' : 'Sair'}</button>
                </div>
              </div>
            </div>
          )}
        </>

        {showHelpModal && (
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
            <div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowHelpModal(false); }} aria-hidden />
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
              <button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowHelpModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Sobre o cálculo do IMC</h3>
                <div className="text-sm text-slate-500">Tabela com as faixas de IMC e a fórmula</div>
              </div>
              <div className="mt-2">
                <div className="text-sm mb-2">Fórmula: <code>IMC = peso(kg) / (altura(m))²</code></div>
                <div className="overflow-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left pb-2">Categoria</th>
                        <th className="text-left pb-2">Faixa de IMC</th>
                        <th className="text-left pb-2">Interpretação</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pt-2">Abaixo do peso</td>
                        <td className="pt-2">&lt; 18.5</td>
                        <td className="pt-2">Pode indicar insuficiência alimentar; avaliar composição corporal.</td>
                      </tr>
                      <tr>
                        <td className="pt-2">Normal</td>
                        <td className="pt-2">18.5 – 24.9</td>
                        <td className="pt-2">Faixa considerada saudável para a maioria das pessoas.</td>
                      </tr>
                      <tr>
                        <td className="pt-2">Sobrepeso</td>
                        <td className="pt-2">25.0 – 29.9</td>
                        <td className="pt-2">Aumento do risco de problemas metabólicos; monitorar alterações.</td>
                      </tr>
                      <tr>
                        <td className="pt-2">Obesidade</td>
                        <td className="pt-2">≥ 30.0</td>
                        <td className="pt-2">Maior risco para doenças crônicas; aconselha-se acompanhamento profissional.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-slate-500 mt-3">Observação: IMC é uma medida populacional e não substitui avaliação clínica individual, especialmente para atletas ou idosos.</div>
              </div>
            </div>
          </div>
        )}

        <section className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold text-lg">Calculadora de IMC</h2>
            <button aria-label="Ajuda IMC" title="Ajuda" onClick={()=>setShowHelpModal(true)} className="text-slate-600 hover:bg-slate-100 p-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 1 1 5.82 1c0 1.5-2 2.25-2 3.5" />
                <path d="M12 17h.01" />
              </svg>
            </button>
          </div>
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
              <div className="text-sm">{bmi ? <CategoryBadge bmi={bmi} /> : ''}</div>
            </div>
          </div>
          {/* Chart and goal panel */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Evolução do IMC</h3>
              <div className="text-sm text-slate-500">Últimos registros</div>
            </div>
            <div className="w-full bg-white border rounded p-3">
              {records && records.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="col-span-1 lg:col-span-2">
                    <div className="w-full overflow-hidden">
                      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="w-full h-40">
                        {(() => {
                          const pts = (records || []).slice().reverse().filter(r => r && Number.isFinite(r.bmi) && r.date);
                          if (pts.length === 0) return null;
                          const times = pts.map(p => new Date(p.date).getTime());
                          const bmis = pts.map(p => Number(p.bmi));
                          const minT = Math.min(...times);
                          const maxT = Math.max(...times);
                          const minB = Math.min(...bmis) - 1;
                          const maxB = Math.max(...bmis) + 1;
                          const mapX = (t) => 20 + 560 * ((t - minT) / Math.max(1, (maxT - minT)));
                          const mapY = (y) => 180 - 160 * ((y - minB) / Math.max(1e-6, (maxB - minB)));
                          const points = pts.map(p => `${mapX(new Date(p.date).getTime())},${mapY(Number(p.bmi))}`).join(' ');
                          // goal line
                          const goalLineY = (goalBmi && Number.isFinite(Number(String(goalBmi).replace(',','.'))) ) ? mapY(Number(String(goalBmi).replace(',','.'))) : null;
                          return (
                            <g>
                              {/* grid lines */}
                              <rect x="0" y="0" width="600" height="200" fill="transparent" />
                              {/* polyline */}
                              <polyline fill="none" stroke="#0f172a" strokeWidth="2" points={points} strokeOpacity="0.9" />
                              {/* points */}
                              {pts.map((p,i)=> (
                                <circle key={i} cx={mapX(new Date(p.date).getTime())} cy={mapY(Number(p.bmi))} r="3" fill="#d4f522" stroke="#072000" strokeWidth="0.5" />
                              ))}
                              {/* goal horizontal line */}
                              {goalLineY !== null ? <line x1="20" x2="580" y1={goalLineY} y2={goalLineY} stroke="#ef4444" strokeDasharray="4 4" strokeWidth="1" /> : null}
                              {/* predicted vertical line */}
                              {predictedDate ? (()=>{ const tx = mapX(predictedDate.getTime()); return <line x1={tx} x2={tx} y1="10" y2="190" stroke="#f97316" strokeDasharray="3 3" strokeWidth="1" /> })() : null}
                            </g>
                          );
                        })()}
                      </svg>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Pontos representam registros salvos. Linha vermelha: meta (se definida). Linha laranja: previsão de quando a meta será atingida (se disponível).</div>
                  </div>
                  <div className="col-span-1 flex flex-col gap-3">
                    <div>
                      <label className="text-sm text-slate-600">Meta de IMC</label>
                      <div className="mt-1 flex gap-2">
                        <input inputMode="decimal" value={goalBmi} onChange={(e)=>setGoalBmi(e.target.value)} placeholder="Ex: 22.5" className="p-2 border rounded w-full" />
                        <button className="px-3 py-2 rounded" style={{ background: '#d4f522', color: '#072000' }} onClick={saveGoal}>Salvar</button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button className="text-sm text-slate-600 underline" onClick={clearGoal}>Limpar meta</button>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">Progresso</div>
                      {(() => {
                        const cur = (records && records[0] && Number.isFinite(records[0].bmi)) ? Number(records[0].bmi) : (Number.isFinite(bmi) ? bmi : null);
                        const start = (records && records.length ? (Number.isFinite(records[records.length-1].bmi) ? Number(records[records.length-1].bmi) : cur) : cur);
                        const g = Number(String(goalBmi).replace(',','.'));
                        if (!cur || !start || !g || !Number.isFinite(g)) return <div className="text-sm text-slate-500">Defina uma meta para ver progresso.</div>;
                        let pct = 0;
                        if (g < start) { pct = ((start - cur) / (start - g)) * 100; }
                        else { pct = ((cur - start) / (g - start)) * 100; }
                        pct = Math.max(0, Math.min(100, Math.round(pct)));
                        return (
                          <div>
                            <div className="w-full bg-slate-100 rounded h-3 overflow-hidden mt-2">
                              <div style={{ width: `${pct}%` }} className="h-3 bg-emerald-500" />
                            </div>
                            <div className="text-sm text-slate-600 mt-2">{pct}% concluído • Atual: {cur} • Meta: {g}</div>
                            {predictedDate ? <div className="text-sm text-slate-600 mt-1">Previsão: {predictedDate.toLocaleDateString()}</div> : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Nenhum registro para desenhar o gráfico. Salve registros para visualizar a evolução.</div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Histórico</h3>
          </div>

          {records.length===0 ? (
            <div className="text-sm text-slate-500">Nenhum registro salvo ainda. Calcule e salve seu IMC.</div>
          ) : (
            <div>
              <div className="text-sm text-slate-600 mb-2">Relatório rápido: {stats.count} registros • Média {stats.avg} • Mín {stats.min} • Máx {stats.max}</div>
              <ul className="space-y-2">
                {records.map(r => (
                  <li key={r.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium whitespace-normal break-words">{new Date(r.date).toLocaleString()}</div>
                      <div className="text-sm text-slate-600 whitespace-normal break-words">Peso: {r.weight} kg • Altura: {r.height} • IMC: {r.bmi} <span className="ml-2 inline-block align-middle">{<CategoryBadge bmi={r.bmi} />}</span></div>
                    </div>
                    <div className="flex flex-none items-center ml-3">
                      <button aria-label="Remover" title="Remover" onClick={()=>remove(r.id)} className="p-2 rounded" style={{ background: '#d4f522', color: '#072000' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                          <path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16z" />
                          <path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z" />
                        </svg>
                      </button>
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
