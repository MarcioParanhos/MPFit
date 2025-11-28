import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

function DayIcon({ label }){
  const L = (label||'').charAt(0).toUpperCase();
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="44" height="44" rx="10" fill="#FFF" stroke="#E6EEF8"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fontFamily="Inter, Roboto, system-ui, Arial" fill="#0f172a">{L}</text>
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
  const [days,setDays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [workouts, setWorkouts] = useState([]);

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
    const { value: name } = await Swal.fire({
      title: 'Nome do dia',
      input: 'text',
      inputPlaceholder: 'Ex: Segunda, Pernas',
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
    });
    if (!name) return;
    await fetch('/api/days',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})});
    await loadDays();
  }

  async function addWorkout(){
    if(!selected) return Swal.fire({ icon: 'warning', text: 'Selecione um dia' });

    const html = `
      <input id="swal-name" class="swal2-input" placeholder="Nome do treino">
      <input id="swal-sets" class="swal2-input" placeholder="Séries (ex: 3)">
      <input id="swal-reps" class="swal2-input" placeholder="Reps por série (ex: 8)">
      <input id="swal-youtube" class="swal2-input" placeholder="URL do YouTube (opcional)">
    `;

    const result = await Swal.fire({
      title: 'Novo treino',
      html,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Adicionar',
      preConfirm: () => {
        const name = document.getElementById('swal-name').value;
        const plannedSets = document.getElementById('swal-sets').value;
        const plannedReps = document.getElementById('swal-reps').value;
        const youtube = document.getElementById('swal-youtube').value;
        if (!name) Swal.showValidationMessage('Nome do treino é obrigatório');
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
      title: 'Excluir treino?',
      text: 'Isto removerá o treino e todos os registros relacionados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    await fetch(`/api/workouts/${workoutId}`, { method: 'DELETE' });
    const res = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await res.json());
    Swal.fire({ icon: 'success', text: 'Treino excluído' });
  }

  return (
    <div className="app-shell mx-auto">
      <header className="header">
        <h1 className="text-lg font-bold">MPFit</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={addDay}>Adicionar Dia</button>
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

        <section className="mt-4">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <div className="flex items-center gap-2">
                  <button className="btn" onClick={addWorkout}>+ Treino</button>
                  <button className="btn bg-red-600 p-2" onClick={async ()=>{
                    const result = await Swal.fire({
                      title: 'Excluir dia?',
                      text: 'Isto removerá o dia e todos os treinos e registros vinculados.',
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
                  }} aria-label="Excluir dia">
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
              <div className="space-y-3">
                {workouts.length===0 && <div className="card">Nenhum treino neste dia.</div>}
                {workouts.map(w=> (
                  <div key={w.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{w.name}</div>
                        <div className="text-sm text-slate-500">Séries: {w.plannedSets} • Reps: {w.plannedReps}</div>
                      </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div className="text-sm text-slate-500">Peso atual: <span className="font-semibold">{w.currentWeight? w.currentWeight + ' kg' : '—'}</span></div>
                          <div className="flex gap-2">
                            <button className="btn" onClick={()=>setCurrentWeight(w.id)}>Definir peso atual</button>
                            <button className="btn bg-red-600 p-2" onClick={()=>deleteWorkout(w.id)} aria-label="Excluir treino">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                          {w.youtube && <a className="text-indigo-600 text-sm" href={w.youtube} target="_blank" rel="noreferrer">Vídeo</a>}
                        </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm text-slate-600 mb-2">Registros recentes:</div>
                      <ul className="space-y-2">
                        {(w.logs || []).slice(0,5).map(l=> (
                          <li key={l.id} className="flex justify-between text-sm text-slate-700">
                            <div>{new Date(l.date).toLocaleString()} • S{l.series} R{l.reps}</div>
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
            <div className="card">Selecione um dia para ver e adicionar treinos.</div>
          )}
        </section>
      </main>
    </div>
  )
}
