import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

function DayIcon({ label, completed }){
	const L = (label||'').charAt(0).toUpperCase();
	const rectFill = completed ? '#ECFDF5' : '#FFF';
	const rectStroke = completed ? '#D1FAE5' : '#E6EEF8';
	const textFill = completed ? '#065f46' : '#0f172a';
	return (
		<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
			<rect width="36" height="36" rx="8" fill={rectFill} stroke={rectStroke}/>
			<text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontFamily="Inter, Roboto, system-ui, Arial" fill={textFill}>{L}</text>
		</svg>
	)
}

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

function DayItem({ d, active, onClick }) {
	const completedClass = d && d.completed ? 'bg-emerald-50 ring-2 ring-emerald-200' : '';
	const title = d ? `${d.name}${d.completed ? ' (concluído)' : ''}` : '';
	return (
		<div onClick={onClick} className={`day-item ${active ? 'active' : ''} ${completedClass} p-1 rounded`} aria-label={title} title={title}>
			<DayIcon label={d.name} completed={!!d.completed} />
		</div>
	)
}

export default function AppPage(){
	const router = useRouter();
	const [days,setDays] = useState([]);
	const [user, setUser] = useState(null);
	const [selected, setSelected] = useState(null);
	const [workouts, setWorkouts] = useState([]);
	const [timerSeconds, setTimerSeconds] = useState(null);
	const timerRef = useRef(null);
	const [draggingId, setDraggingId] = useState(null);
	const [dragOverIndex, setDragOverIndex] = useState(null);
	const [dayMenuOpen, setDayMenuOpen] = useState(false);
	const dayMenuRef = useRef(null);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const userMenuRef = useRef(null);

	const totalExercises = workouts.length;
	const completedExercises = workouts.filter(w => !!w.completed).length;

	useEffect(()=>{
		async function initAuthAndLoad(){
			try{
				const meRes = await fetch('/api/auth/me');
				if (!meRes.ok) {
					router.replace('/login');
					return;
				}
				const me = await meRes.json();
				setUser(me);
				await loadDays();
			}catch(e){
				console.error('Auth check failed', e);
				router.replace('/login');
			}
		}
		initAuthAndLoad();
	},[]);

	async function loadDays(){
		try{ const res = await fetch('/api/days'); const data = await res.json(); setDays(data); }catch(e){console.error(e)}
	}

	async function selectDay(d){
		setSelected(d);
		// initialize timer state from day
		if (d && d.startedAt) {
			const s = Math.max(0, Math.round((Date.now() - new Date(d.startedAt).getTime())/1000));
			setTimerSeconds(s);
		} else if (d && (d.durationSeconds || d.durationSeconds === 0)) {
			setTimerSeconds(d.durationSeconds);
		} else {
			setTimerSeconds(null);
		}
		const res = await fetch(`/api/days/${d.id}/workouts`);
		const w = await res.json(); setWorkouts(w);
	}

	function formatDuration(sec){
		if (sec === null || sec === undefined) return '';
		const s = Number(sec);
		const h = Math.floor(s/3600);
		const m = Math.floor((s%3600)/60);
		const ss = s%60;
		if (h>0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
		return `${m}:${String(ss).padStart(2,'0')}`;
	}

	// manage running timer when a day is started
	useEffect(()=>{
		// clear previous
		if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
		if (selected && selected.startedAt) {
			// start interval
			setTimerSeconds(Math.max(0, Math.round((Date.now() - new Date(selected.startedAt).getTime())/1000)));
			timerRef.current = setInterval(()=>{
				setTimerSeconds(prev => (prev===null?0:prev+1));
			},1000);
		}
		return ()=>{ if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
	},[selected && selected.startedAt]);

	async function addDay(){
		const { value: form } = await Swal.fire({
			title: 'Novo dia',
			html: `<input id="swal-name" class="swal2-input" placeholder="Ex: Segunda, Pernas"><input id="swal-subtitle" class="swal2-input" placeholder="Legenda (obrigatória)">`,
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
		if (!form) return;
		await fetch('/api/days',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form)});
		await loadDays();
	}

	async function addWorkout(){
		if(!selected) return Swal.fire({ icon: 'warning', text: 'Selecione um dia' });
		const { value: result } = await Swal.fire({
			title: 'Novo exercício',
			html: `<input id="swal-name" class="swal2-input" placeholder="Nome do exercício"><input id="swal-sets" class="swal2-input" placeholder="Séries (ex: 3)"><input id="swal-reps" class="swal2-input" placeholder="Reps por série (ex: 8)"><input id="swal-youtube" class="swal2-input" placeholder="URL do YouTube (opcional)">`,
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
		if (!result) return;
		const { name, plannedSets, plannedReps, youtube } = result;
		await fetch(`/api/days/${selected.id}/workouts`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, plannedSets, plannedReps, youtube})});
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

	async function persistOrder(newOrder) {
		if (!selected) return;
		try {
			await fetch(`/api/days/${selected.id}/workouts/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds: newOrder }) });
		} catch (e) {
			console.error('Failed to persist order', e);
		}
	}

	async function startDayAction(){
		if (!selected) return Swal.fire({ icon: 'info', text: 'Selecione um dia' });
		const res = await fetch(`/api/days/${selected.id}/start`, { method: 'POST' });
		let body = null;
		try { body = await res.json(); } catch (e) { /* ignore parse error */ }
		if (!res.ok) {
			// if server returned a day-like object in body, proceed but warn
			if (body && body.id) {
				await loadDays();
				setSelected(body);
				const r = await fetch(`/api/days/${body.id}/workouts`); setWorkouts(await r.json());
				if (body && body.startedAt) {
					const s = Math.max(0, Math.round((Date.now() - new Date(body.startedAt).getTime())/1000));
					setTimerSeconds(s);
				}
				return Swal.fire({ icon: 'warning', text: 'Treino iniciado, mas o servidor retornou um erro não esperado' });
			}
			return Swal.fire({ icon: 'error', text: 'Falha ao iniciar treino' });
		}
		const day = body;
		// update days list and selected day
		await loadDays();
		setSelected(day);
		const r = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await r.json());
		// initialize timer
		if (day && day.startedAt) {
			const s = Math.max(0, Math.round((Date.now() - new Date(day.startedAt).getTime())/1000));
			setTimerSeconds(s);
		}
		Swal.fire({ icon: 'success', text: 'Treino iniciado: marcadores resetados' });
	}

	async function completeDayAction(){
		if (!selected) return Swal.fire({ icon: 'info', text: 'Selecione um dia' });
		const res = await fetch(`/api/days/${selected.id}/complete`, { method: 'POST' });
		let body = null;
		try { body = await res.json(); } catch (e) { /* ignore */ }
		if (!res.ok) {
			if (body && body.id) {
				await loadDays();
				setSelected(body);
				const r = await fetch(`/api/days/${body.id}/workouts`); setWorkouts(await r.json());
				if (body && (body.durationSeconds || body.durationSeconds === 0)) setTimerSeconds(body.durationSeconds);
				if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
				return Swal.fire({ icon: 'warning', text: 'Dia concluído, mas o servidor retornou um erro não esperado' });
			}
			return Swal.fire({ icon: 'error', text: 'Falha ao concluir treino' });
		}
		const day = body;
		await loadDays();
		setSelected(day);
		const r = await fetch(`/api/days/${selected.id}/workouts`); setWorkouts(await r.json());
		// set final duration and clear timer
		if (day && (day.durationSeconds || day.durationSeconds === 0)) {
			setTimerSeconds(day.durationSeconds);
		}
		if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
		Swal.fire({ icon: 'success', text: 'Dia marcado como concluído' });
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

// close user menu on outside click
useEffect(()=>{
    function onDoc(e){
        if (!userMenuRef.current) return;
        if (!userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    if (userMenuOpen) document.addEventListener('mousedown', onDoc);
    return ()=> document.removeEventListener('mousedown', onDoc);
},[userMenuOpen]);

	return (
		<div className="app-shell mx-auto">
			<header className="header">
				<div className="flex items-center gap-2">
					<img src="/images/TRAINHUB.png" alt="TrainHub" className="h-8" />
				</div>
					<div className="flex gap-2 items-center">
					{user && (
						<div className="relative ml-2" ref={userMenuRef}>
							<button type="button" onClick={(e)=>{ e.preventDefault(); setUserMenuOpen(v=>!v); }} className="flex items-center justify-center p-0" aria-haspopup="true" aria-expanded={userMenuOpen} aria-label="Usuário">
								<div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium border" style={{ backgroundColor: avatarColor(user.name || user.email), borderColor: 'rgba(255,255,255,0.08)' }} aria-hidden>
									{getInitials(user.name || user.email)}
								</div>
							</button>
							{userMenuOpen && (
								<div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-md shadow z-50">
									<div className="py-1">
										<button className="w-full text-left px-3 py-1 text-sm hover:bg-slate-100" onClick={async ()=>{ setUserMenuOpen(false); /* future: open profile */ }}>
											Perfil
										</button>
										<button className="w-full text-left px-3 py-1 text-sm text-red-600 hover:bg-slate-50" onClick={async ()=>{ setUserMenuOpen(false); await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); }}>
											Logout
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</header>
			<main className="p-4">
				<section>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium">Dias</h3>
						<button className="btn p-2" onClick={addDay} aria-label="Novo dia" title="Novo dia">
							<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
								<path stroke="none" d="M0 0h24v24H0z" fill="none" />
								<path d="M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5" />
								<path d="M16 3v4" />
								<path d="M8 3v4" />
								<path d="M4 11h16" />
								<path d="M16 19h6" />
								<path d="M19 16v6" />
							</svg>
						</button>
					</div>
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
									{selected.completed && (
										<div className="mt-1 inline-flex items-center gap-2 text-sm text-emerald-700">
											<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
											<span>Dia concluído</span>
										</div>
									)}
								</div>
								<div className="flex items-center gap-2" ref={dayMenuRef}>
										<div className="relative flex items-center gap-2">
											{typeof timerSeconds === 'number' && (
												<div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${selected && selected.startedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
													{selected && selected.startedAt ? <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden></span> : null}
													<span className="font-mono">{formatDuration(timerSeconds)}</span>
												</div>
											)}
											<button className="btn p-2 bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center" onClick={startDayAction} aria-label="Iniciar treino" title="Iniciar treino">
												<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
													<path d="M5 3l15 9L5 21V3z" />
												</svg>
											</button>
											<button className="btn p-2 bg-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center" onClick={completeDayAction} aria-label="Concluir dia" title="Concluir dia">
												<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
													<path d="M20 6L9 17l-5-5" />
												</svg>
											</button>

										<div className="relative">
											<button className="btn p-2 bg-transparent text-slate-600" onClick={()=>setDayMenuOpen(v=>!v)} aria-haspopup="true" aria-expanded={dayMenuOpen} aria-label="Opções do dia">⋮</button>

											{dayMenuOpen && (
												<div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded shadow-sm z-50">
													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" onClick={async ()=>{ setDayMenuOpen(false); await addWorkout(); }}>
														<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
															<path d="M12 5v14" />
															<path d="M5 12h14" />
														</svg>
														<span>Adicionar exercício</span>
													</button>

													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-red-600" onClick={async ()=>{
														setDayMenuOpen(false);
														const result = await Swal.fire({ title: 'Excluir dia?', text: 'Isto removerá o dia e todos os exercícios e registros vinculados.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar' });
														if (!result.isConfirmed) return;
														await fetch(`/api/days/${selected.id}`, { method: 'DELETE' });
														await loadDays(); setSelected(null); setWorkouts([]);
														Swal.fire({ icon: 'success', text: 'Dia e registros excluídos' });
													}}>
														<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
															<path d="M0 0h24v24H0z" fill="none"/>
															<path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16z" />
															<path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z" />
														</svg>
														<span>Excluir dia</span>
													</button>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className="mb-3 flex items-center gap-3">
								<div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm shadow-sm">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-500" aria-hidden>
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
									<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
										<path d="M20 6L9 17l-5-5" />
									</svg>
									<span className="text-xs text-emerald-600">Concluídos</span>
									<span className="font-semibold">{completedExercises}</span>
								</div>
							</div>

							<div className="space-y-3">
								{workouts.length===0 ? (
									<div className="card">Nenhum exercício neste dia.</div>
								) : (
									workouts.map((w, idx) => (
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
															<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
															<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
																<path d="M0 0h24v24H0z" fill="none"/>
																<path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16z" />
																<path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z" />
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
									))
								)}
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


