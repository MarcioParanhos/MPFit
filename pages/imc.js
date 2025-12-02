import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

function bmiCategory(bmi){
  if (bmi === null || bmi === undefined || Number.isNaN(bmi)) return '';
  if (bmi < 18.5) return 'Abaixo do peso';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidade';
}

export default function ImcPage(){
  const router = useRouter();
  const [weight, setWeight] = useState(''); // kg
  const [height, setHeight] = useState(''); // cm
  const [bmi, setBmi] = useState(null);
  const [records, setRecords] = useState([]);
  const STORAGE_KEY = 'imc_records_v1';

  useEffect(()=>{ load(); },[]);

  function load(){
    (async ()=>{
      try{
        const res = await fetch('/api/imc');
        if (res.status === 401) return router.replace('/login');
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
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
      <header className="header p-4 bg-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/images/TRAINHUB.png" alt="TrainHub" className="h-8" />
          <h1 className="text-lg font-semibold">IMC</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn px-3 py-1 text-sm" onClick={()=>router.push('/app')}>Voltar</button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
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
                <button className="btn bg-indigo-600 text-white px-3 py-2 rounded" onClick={compute}>Calcular</button>
                <button className="btn bg-emerald-600 text-white px-3 py-2 rounded" onClick={saveRecord} disabled={!bmi}>Salvar</button>
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
