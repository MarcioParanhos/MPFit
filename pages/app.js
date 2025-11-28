import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

function DayIcon({ label }){
  const L = (label||'').charAt(0).toUpperCase();
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="36" height="36" rx="8" fill="#FFF" stroke="#E6EEF8"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontFamily="Inter, Roboto, system-ui, Arial" fill="#0f172a">{L}</text>
    </svg>
  )
}

function DayItem({ d, active, onClick }) {
  return (
    <div onClick={onClick} className={`day-item ${active? 'active':''}`} aria-label={d.name} title={d.name}>
      <DayIcon label={d.name} />
    </div>
  )
}

export default function Home(){
  const router = useRouter();
  const [days,setDays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const dayMenuRef = useRef(null);

  const totalExercises = workouts.length;
  const completedExercises = workouts.filter(w => !!w.completed).length;

  useEffect(()=>{ loadDays(); },[]);

  async function loadDays(){
    const res = await fetch('/api/days'); const data = await res.json(); setDays(data);
  }

  async function selectDay(d){
    setSelected(d);
    const res = await fetch(`/api/days/${d.id}/workouts`);
    const w = await res.json(); setWorkouts(w);
  }

  async function addDay(){
    const html = `
      <input id="swal-name" class="swal2-input" placeholder="Ex: Segunda, Pernas">
      <input id="swal-subtitle" class="swal2-input" placeholder="Legenda (opcional) - Ex: Biceps - Triceps">
    `;

    const result = await Swal.fire({
      title: 'Novo dia',
      html,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      preConfirm: () => {
        const name = document.getElementById('swal-name').value;
        const subtitle = document.getElementById('swal-subtitle').value;
        if (!name || !String(name).trim()) { Swal.showValidationMessage('Nome do dia é obrigatório'); return false; }
        if (!subtitle || !String(subtitle).trim()) { Swal.showValidationMessage('Legenda é obrigatória'); return false; }
        return { name: String(name).trim(), subtitle: String(subtitle).trim() };
      }
    });
    if (!result.value) return;
    const { name, subtitle } = result.value;
    await fetch('/api/days',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, subtitle})});
    await loadDays();
  }

  async function addWorkout(){
    if(!selected) return Swal.fire({ icon: 'warning', text: 'Selecione um dia' });

    const html = `
      <input id="swal-name" class="swal2-input" placeholder="Nome do exercício">
      <input id="swal-sets" class="swal2-input" placeholder="Séries (ex: 3)">
      <input id="swal-reps" class="swal2-input" placeholder="Reps por série (ex: 8)">
      <input id="swal-youtube" class="swal2-input" placeholder="URL do YouTube (opcional)">
    `;

    const result = await Swal.fire({
      title: 'Novo exercício',
      html,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      preConfirm: () => {
        const name = document.getElementById('swal-name').value;
        const plannedSets = document.getElementById('swal-sets').value;
        const plannedReps = document.getElementById('swal-reps').value;
        const youtube = document.getElementById('swal-youtube').value;
        if (!name) Swal.showValidationMessage('Nome do exercício é obrigatório');
        return { name, plannedSets, plannedReps, youtube };
      }
    });

    if (!result.value) return;
    const { name, plannedSets, plannedReps, youtube } = result.value;
    await fetch(`/api/days/${selected.id}/workouts`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, plannedSets, plannedReps, youtube})});
    const res = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await res.json());
  }

  async function addLog(workoutId){
    const html = `
      <input id="swal-series" class="swal2-input" placeholder="Série (número)">
      <input id="swal-reps" class="swal2-input" placeholder="Repetições">
      <input id="swal-weight" class="swal2-input" placeholder="Peso (kg)">
    `;
    const result = await Swal.fire({
      title: 'Registrar peso',
      html,
      showCancelButton: true,
      confirmButtonText: 'Salvar',
      preConfirm: () => {
        const series = document.getElementById('swal-series').value;
        const reps = document.getElementById('swal-reps').value;
        const weight = document.getElementById('swal-weight').value;
        if (!series || !reps || !weight) Swal.showValidationMessage('Preencha série, repetições e peso');
        return { series, reps, weight };
      }
    });
    if (!result.value) return;
    const { series, reps, weight } = result.value;
    await fetch(`/api/workouts/${workoutId}/weights`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({series, reps, weight})});
    // refresh
    const res = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await res.json());
  }

  async function setCurrentWeight(workoutId){
    const { value: wt } = await Swal.fire({
      title: 'Peso atual (kg)',
      input: 'text',
      inputPlaceholder: 'Ex: 35 (deixe vazio para limpar)',
      showCancelButton: true,
      confirmButtonText: 'Salvar'
    });
    if (wt === undefined) return; // cancelled
    const body = wt === '' ? { weight: null } : { weight: Number(wt) };
    await fetch(`/api/workouts/${workoutId}/current`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const res = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await res.json());
  }

  async function deleteWorkout(workoutId){
    const result = await Swal.fire({
      title: 'Excluir exercício?',
      text: 'Isto removerá o exercício e todos os registros relacionados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    await fetch(`/api/workouts/${workoutId}`, { method: 'DELETE' });
    const res = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await res.json());
    Swal.fire({ icon: 'success', text: 'Exercício excluído' });
  }

  // close day menu on outside click
  useEffect(()=>{
    function onDoc(e){
      if (!dayMenuRef.current) return;
      if (!dayMenuRef.current.contains(e.target)) setDayMenuOpen(false);
    }
    if (dayMenuOpen) document.addEventListener('mousedown', onDoc);
    return ()=> document.removeEventListener('mousedown', onDoc);
  },[dayMenuOpen]);

  async function persistOrder(newOrder) {
    if (!selected) return;
    try {
      await fetch(`/api/days/${selected.id}/workouts/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds: newOrder }) });
    } catch (e) {
      console.error('Failed to persist order', e);
    }
  }

  return (
    <div className="app-shell mx-auto">
      <header className="header">
        <h1 className="text-lg font-bold">MPFit</h1>
        <div className="flex gap-2">
          <button className="btn p-2" onClick={addDay} aria-label="Adicionar Dia">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5" />
              <path d="M16 3v4" />
              <path d="M8 3v4" />
              <path d="M4 11h16" />
              <path d="M16 19h6" />
              <path d="M19 16v6" />
            </svg>
          </button>
          <button className="btn bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => router.push('/')} aria-label="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M10 8v-2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-2" />
              <path d="M15 12h-12l3 -3" />
              <path d="M6 15l-3 -3" />
            </svg>
          </button>
        </div>
      </header>
      <main className="p-4">
        <section>
          <div className="day-list">
            {days.length===0 && (
              <div className="card w-full text-center">
                <p className="mb-3">Você ainda não adicionou dias.</p>
                <button className="btn" onClick={addDay}>Adicionar primeiro dia</button>
              </div>
            )}
            {days.map(d => <DayItem key={d.id} d={d} active={selected && selected.id===d.id} onClick={()=>selectDay(d)} />)}
          </div>
        </section>

        <div className="my-4" aria-hidden>
          <div className="h-px bg-slate-200 w-full" />
        </div>

        

        <section className="mt-4">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  {selected.subtitle && <div className="text-sm text-slate-500">{selected.subtitle}</div>}
                </div>
                <div className="flex items-center gap-2" ref={dayMenuRef}>
                  <div className="relative">
                    <button className="btn p-2 bg-transparent text-slate-600" onClick={()=>setDayMenuOpen(v=>!v)} aria-haspopup="true" aria-expanded={dayMenuOpen} aria-label="Opções do dia">
                      {/* kebab / more icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    {dayMenuOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded shadow-sm z-50">
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100" onClick={async ()=>{
                          setDayMenuOpen(false);
                          await addWorkout();
                        }}>Adicionar exercício</button>

                        <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-slate-50" onClick={async ()=>{
                          setDayMenuOpen(false);
                          const result = await Swal.fire({
                            title: 'Excluir dia?',
                            text: 'Isto removerá o dia e todos os exercícios e registros vinculados.',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Sim, excluir',
                            cancelButtonText: 'Cancelar'
                          });
                          if (!result.isConfirmed) return;
                          await fetch(`/api/days/${selected.id}`, { method: 'DELETE' });
                          await loadDays();
                          setSelected(null);
                          setWorkouts([]);
                          Swal.fire({ icon: 'success', text: 'Dia e registros excluídos' });
                        }}>Excluir dia</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mb-3 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm shadow-sm">
                  {/* exercise icon (user-provided treadmill SVG) */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-500" aria-hidden>
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M10 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
                    <path d="M3 14l4 1l.5 -.5" />
                    <path d="M12 18v-3l-3 -2.923l.75 -5.077" />
                    <path d="M6 10v-2l4 -1l2.5 2.5l2.5 .5" />
                    <path d="M21 22a1 1 0 0 0 -1 -1h-16a1 1 0 0 0 -1 1" />
                    <path d="M18 21l1 -11l2 -1" />
                  </svg>
                  <span className="text-xs text-slate-500">Exercícios</span>
                  <span className="font-semibold">{totalExercises}</span>
                </div>

                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm shadow-sm">
                  {/* completed icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-xs text-emerald-600">Concluídos</span>
                  <span className="font-semibold">{completedExercises}</span>
                </div>
              </div>
              <div className="space-y-3">
                {workouts.length===0 && <div className="card">Nenhum exercício neste dia.</div>}
                {workouts.map((w, idx) => (
                  <div key={w.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(w.id)); setDraggingId(w.id); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                    onDrop={async (e) => {
                      e.preventDefault(); const dragged = Number(e.dataTransfer.getData('text/plain'));
                      const from = workouts.findIndex(x => x.id === dragged);
                      const to = idx;
                      if (from === -1) return;
                      const copy = workouts.slice();
                      const [moved] = copy.splice(from,1);
                      copy.splice(to,0,moved);
                      setWorkouts(copy);
                      setDraggingId(null); setDragOverIndex(null);
                      await persistOrder(copy.map(x=>x.id));
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverIndex(null); }}
                    className={`card ${w.completed ? 'completed' : ''} ${draggingId===w.id ? 'opacity-60' : ''} ${dragOverIndex===idx ? 'ring-2 ring-dashed ring-slate-300' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg truncate">{w.name}</div>
                        <div className="text-sm text-slate-500 truncate">Séries: {w.plannedSets} • Reps: {w.plannedReps}</div>
                        {w.youtube && <div className="mt-1"><a className="text-indigo-600 text-sm" href={w.youtube} target="_blank" rel="noreferrer">Vídeo</a></div>}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm text-slate-500">Peso atual: <span className="font-semibold">{w.currentWeight ? w.currentWeight + ' kg' : '—'}</span></div>
                        <div className="flex items-center gap-2">
                          <button className="btn text-sm px-2 py-1" onClick={() => setCurrentWeight(w.id)} aria-label="Definir peso">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icon-tabler-barbell">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                              <path d="M2 12h1" />
                              <path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2" />
                              <path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z" />
                              <path d="M9 12h6" />
                              <path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z" />
                              <path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2" />
                              <path d="M22 12h-1" />
                            </svg>
                          </button>
                          <button className="btn bg-red-600 text-white p-2 hover:bg-red-700" onClick={() => deleteWorkout(w.id)} aria-label="Excluir exercício">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!w.completed} onChange={async (e) => {
                            const next = e.target.checked;
                            await fetch(`/api/workouts/${w.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: next }) });
                            const res = await fetch(`/api/days/${selected.id}/workouts`);
                            setWorkouts(await res.json());
                          }} />
                          <span className="whitespace-nowrap">{w.completed ? 'Concluído' : 'Marcar concluído'}</span>
                        </label>
                        <div className="text-sm text-slate-600">&nbsp;</div>
                      </div>
                      <ul className="space-y-2">
                        {(w.logs || []).slice(0,5).map(l => (
                          <li key={l.id} className="flex justify-between text-sm text-slate-700">
                            <div className="truncate">{new Date(l.date).toLocaleString()} • S{l.series} R{l.reps}</div>
                            <div className="font-semibold">{l.weight} kg</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">Selecione um dia para ver e adicionar exercícios.</div>
          )}
        </section>
      </main>
    </div>
  )
}
