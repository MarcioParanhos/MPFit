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

function AddDayTile({ onClick }){
	return (
		<div onClick={onClick} className={`day-item add-day p-1 rounded`} role="button" tabIndex={0} aria-label="Adicionar dia" title="Adicionar dia">
			<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
				<rect width="36" height="36" rx="8" fill="#FFF" stroke="#E6EEF8"/>
				<g transform="translate(0,0)">
					<path d="M18 10v16" stroke="#072000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					<path d="M10 18h16" stroke="#072000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				</g>
			</svg>
		</div>
	);
}

export default function AppPage(){
	const router = useRouter();
	const [days,setDays] = useState([]);
	const [user, setUser] = useState(null);
	const [selected, setSelected] = useState(null);
	const [workouts, setWorkouts] = useState([]);
	const [exercisesList, setExercisesList] = useState([]);
	const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
	const [modalExerciseId, setModalExerciseId] = useState('');
	const [modalSets, setModalSets] = useState('');
	const [modalReps, setModalReps] = useState('');
	const [modalError, setModalError] = useState('');
	const [modalLoading, setModalLoading] = useState(false);
	const modalFirstRef = useRef(null);

	// Image preview modal state
	const [showImageModal, setShowImageModal] = useState(false);
	const [imageModalSrc, setImageModalSrc] = useState('');
	const [imageModalTitle, setImageModalTitle] = useState('');
	const imageModalCloseRef = useRef(null);

	// Edit modal state (new modal, same pattern as creation)
	const [showEditModal, setShowEditModal] = useState(false);
	const [editModalWorkout, setEditModalWorkout] = useState(null);
	const [editModalSets, setEditModalSets] = useState('');
	const [editModalReps, setEditModalReps] = useState('');
	const [editModalLoading, setEditModalLoading] = useState(false);
	const [editModalError, setEditModalError] = useState('');
	const editModalFirstRef = useRef(null);
	const [timerSeconds, setTimerSeconds] = useState(null);
	const timerRef = useRef(null);
	const [draggingId, setDraggingId] = useState(null);
	const [dragOverIndex, setDragOverIndex] = useState(null);
	const [dayMenuOpen, setDayMenuOpen] = useState(false);
	const dayMenuRef = useRef(null);

	// off-canvas state
	const [offCanvasOpen, setOffCanvasOpen] = useState(false);
	const offCanvasRef = useRef(null);

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
				// load exercises catalog for selects and card previews
				try { const r = await fetch('/api/exercises'); if (r.ok) setExercisesList(await r.json()); } catch(e) { /* ignore */ }
			}catch(e){
				console.error('Auth check failed', e);
				router.replace('/login');
			}
		}
		initAuthAndLoad();
	},[]);

	async function loadDays(){
		try{
			const res = await fetch('/api/days');
			const data = await res.json();
			if (!Array.isArray(data)) {
				console.warn('loadDays: unexpected response', data);
				// if unauthorized or error, clear days to avoid runtime crashes
				setDays([]);
				return;
			}
			setDays(data);
		}catch(e){console.error('loadDays error', e); setDays([]); }
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
	 			html: `
	 				<div style="display:flex;flex-direction:column;gap:8px">
	 					<input id="swal-name" class="swal2-input" placeholder="Nome (ex: Segunda, Pernas)">
	 					<input id="swal-subtitle" class="swal2-input" placeholder="Legenda (obrigatória)">
	 					<input id="swal-template" class="swal2-input" placeholder="Template ID (opcional)">
	 				</div>
	 			`,
	 			focusConfirm: false,
	 			showCancelButton: true,
	 			confirmButtonText: 'Adicionar',
	 			customClass: { popup: 'compact-swal' },
	 			preConfirm: () => {
	 				const name = document.getElementById('swal-name').value;
	 				const subtitle = document.getElementById('swal-subtitle').value;
	 				const template = document.getElementById('swal-template').value;
	 				if (template && String(template).trim()) {
	 					// when template provided, only template is necessary
	 					return { templateCode: String(template).trim() };
	 				}
	 				if (!name || !String(name).trim()) { Swal.showValidationMessage('Nome do dia é obrigatório'); return false; }
	 				if (!subtitle || !String(subtitle).trim()) { Swal.showValidationMessage('Legenda é obrigatória'); return false; }
	 				return { name: String(name).trim(), subtitle: String(subtitle).trim() };
	 			}
	 		});
		if (!form) return;
		// if templateCode provided, send as templateCode; otherwise send name/subtitle
		if (form.templateCode) {
			await fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateCode: form.templateCode }) });
		} else {
			await fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
		}
		await loadDays();
	}

	function addWorkout(){
		if(!selected) return Swal.fire({ icon: 'warning', text: 'Selecione um dia' });
		// load exercises then open modal
		(async ()=>{
			try {
				const r = await fetch('/api/exercises');
				let loaded = [];
				if (r.ok) loaded = await r.json();
				setExercisesList(loaded);
				// default selection: first exercise or empty
					setModalExerciseId(loaded && loaded.length ? String(loaded[0].id) : '');
			} catch(e) {
				console.error('failed loading exercises for modal', e);
				setModalExerciseId('__new');
			}
			setModalSets(''); setModalReps(''); setModalError('');
			setShowAddExerciseModal(true);
		})();
	}

	async function handleConfirmAddWorkout(){
		if (!selected) return;
		if (modalLoading) return;
		setModalError('');
		setModalLoading(true);
		try {
			let exerciseId = modalExerciseId ? Number(modalExerciseId) : null;
			let name = null;
			const plannedSets = modalSets === '' ? 0 : Number(modalSets);
			const plannedReps = modalReps === '' ? 0 : Number(modalReps);
			if (!exerciseId) {
				setModalError('Selecione um exercício do catálogo');
				setModalLoading(false);
				return;
			}
			// send workout creation (no youtube field)
			const createWorkoutRes = await fetch(`/api/days/${selected.id}/workouts`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, plannedSets, plannedReps, exerciseId })});
			if (!createWorkoutRes.ok) throw new Error('Falha ao criar treino');
			const res = await fetch(`/api/days/${selected.id}/workouts`);
			setWorkouts(await res.json());
			setShowAddExerciseModal(false);
		} catch (e) {
			console.error(e);
			setModalError(e.message || 'Erro inesperado');
		} finally {
			setModalLoading(false);
		}
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

	function editWorkout(w){
		if(!w) return;
		// open edit modal with current planned sets/reps; name is not editable here
		setEditModalWorkout(w);
		setEditModalSets(w.plannedSets || '');
		setEditModalReps(w.plannedReps || '');
		setEditModalError('');
		setShowEditModal(true);
	}

	async function handleConfirmEditWorkout(){
		if (!editModalWorkout) return;
		if (editModalLoading) return;
		setEditModalError(''); setEditModalLoading(true);
		try {
			const plannedSets = editModalSets === '' ? 0 : Number(editModalSets);
			const plannedReps = editModalReps === '' ? 0 : Number(editModalReps);
			const body = { plannedSets, plannedReps };
			const resPatch = await fetch(`/api/workouts/${editModalWorkout.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!resPatch.ok) throw new Error('Falha ao atualizar exercício');
			const r = await fetch(`/api/days/${selected.id}/workouts`);
			setWorkouts(await r.json());
			setShowEditModal(false);
		} catch (e) {
			console.error(e);
			setEditModalError(e.message || 'Erro inesperado');
		} finally { setEditModalLoading(false); }
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

// focus first modal control when modal opens
useEffect(()=>{
	if (showAddExerciseModal && modalFirstRef && modalFirstRef.current) {
		try { modalFirstRef.current.focus(); } catch(e) { /* ignore */ }
	}
	},[showAddExerciseModal]);

// lock body scroll and add ESC handler for image modal
useEffect(()=>{
	if (!showImageModal) return;
	const prevOverflow = document.body.style.overflow;
	document.body.style.overflow = 'hidden';
	function onKey(e){ if (e.key === 'Escape') setShowImageModal(false); }
	document.addEventListener('keydown', onKey);
	// focus close button if available
	try { if (imageModalCloseRef && imageModalCloseRef.current) imageModalCloseRef.current.focus(); } catch(e) {}
	return ()=>{ document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey); };
},[showImageModal]);

// focus edit modal first control when opens
useEffect(()=>{
    if (showEditModal && editModalFirstRef && editModalFirstRef.current) {
        try { editModalFirstRef.current.focus(); } catch(e) { /* ignore */ }
    }
},[showEditModal]);

// (main menu removed)

// (days menu removed)

	return (
		<div className="app-shell mx-auto">
			<style jsx global>{`
				/* Buttons inside workout cards: apply requested color */
				.workout-card .btn{ background: #d4f523 !important; border-color: rgba(0,0,0,0.06) !important; color: #072000 !important; }
				.workout-card .btn[aria-label="Excluir exercício"]{ background: #d4f523 !important; color: #072000 !important; }
				/* Specific aria-label selectors to cover buttons regardless of utility classes */
				button[aria-label="Editar exercício"],
				button[aria-label="Definir peso"],
				button[aria-label="Excluir exercício"] {
					background: #d4f523 !important;
					border-color: rgba(0,0,0,0.06) !important;
					color: #072000 !important;
				}

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
				.fixed.inset-0.bg-black\\/40 {
					transition: opacity 520ms ease;
				}

				/* Day selector tiles */
				.day-list { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
				.day-item { cursor: pointer; display:inline-flex; align-items:center; justify-content:center; transition: transform 180ms ease, box-shadow 180ms ease; }
				.day-item svg { display:block; }
				.day-item:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(2,6,23,0.08); }
				.day-item:focus { outline: 3px solid rgba(212,245,35,0.18); outline-offset: 2px; }
				.day-item.active svg rect { fill: #d4f523 !important; stroke: #b7e124 !important; }
				.day-item.active svg text { fill: #072000 !important; font-weight: 600; }
				/* Add-day specific: keep neutral background (white) while keeping icon dark */
				.day-item.add-day svg rect { fill: #FFF !important; stroke: #E6EEF8 !important; }
				.day-item.add-day svg path, .day-item.add-day svg line { stroke: #072000 !important; }
				.day-item.add-day:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 30px rgba(16,24,40,0.12); }

				/* Base SVG sizing (mobile-first). Desktop overrides below. */
				.day-item svg { width: 36px; height: 36px; }

				@media (min-width: 1024px) {
					/* Desktop: larger day tiles and more spacing */
					.day-list { gap: 14px; }
					.day-item { padding: 6px; }
					.day-item svg { width: 52px; height: 52px; }
					.day-item svg rect { rx: 10; }
					.day-item:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(2,6,23,0.12); }
					.day-item.active svg rect { fill: #d4f523 !important; stroke: #b7e124 !important; }
					.day-item.active svg text { font-size: 14px !important; }
					.day-item.add-day svg rect { fill: #FFF !important; stroke: #E6EEF8 !important; }
					/* Make header and layout occupy full screen on desktop; fix header so menu always accessible */
					.app-shell { max-width: 100% !important; padding-left: 40px; padding-right: 40px; padding-top: 64px; }
					header.header { position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 80; background: #fff; box-shadow: 0 2px 8px rgba(2,6,23,0.04); }
					/* ensure off-canvas sits above header when open */
					.offcanvas-panel { z-index: 90; }
					main { min-height: calc(100vh - 64px); }
				}
			`}</style>

			{/* Compact SweetAlert2 styles for mobile-friendly modals */}
			<style jsx global>{`
				.compact-swal.swal2-popup {
					max-width: 420px !important;
					width: 92% !important;
					padding: 0.85rem !important;
					font-size: 14px !important;
				}
				.compact-swal .swal2-title { font-size: 16px !important; margin-bottom: 0.4rem; }
				.compact-swal .swal2-html-container { padding: 0 !important; }
				.compact-swal .swal2-input { font-size: 14px !important; padding: 8px 10px !important; height: auto !important; }
				.compact-swal .swal2-input { font-size: 14px !important; padding: 8px 10px !important; height: auto !important; }
				.compact-swal .swal2-actions { gap: 8px; padding-top: 8px; }
				.compact-swal .swal2-checkbox, .compact-swal .swal2-validation-message { font-size: 13px !important; }
				@media (min-width: 640px) {
					.compact-swal.swal2-popup { max-width: 520px !important; }
				}
			`}</style>
			<header className="header">
				<div className="flex items-center gap-2">
					<img src="/images/TRAINHUB.png" alt="TrainHub" className="h-8" />
				</div>
				<div className="flex gap-2 items-center">
					{/* menu button replaces avatar — opens off-canvas */}
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
			<main className="p-4">
				<section>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium">Dias</h3>
						{/* Off-canvas overlay and panel */}
						<>
							<div className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${offCanvasOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={()=>setOffCanvasOpen(false)} aria-hidden />
							<aside ref={offCanvasRef} className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 offcanvas-panel ${offCanvasOpen ? 'offcanvas-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!offCanvasOpen}>
								<div className="p-4 border-b border-slate-100 flex items-center gap-3">
									<div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium" style={{ background: '#d4f523', color: '#072000' }} aria-hidden>
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

									<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" onClick={()=>{ setOffCanvasOpen(false); router.push('/imc'); }}>
										<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-600" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
											<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
											<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 2a1 1 0 0 1 .993.883L13 6v6a1 1 0 0 1-.883.993L12 13a1 1 0 0 1-.993-.883L11 12V6a1 1 0 0 1 1-1zm0 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
										</svg>
										<span>IMC</span>
									</button>


								</nav>
							</aside>
						</>
					</div>
					<div className="day-list">
						{days.length===0 && (
							<div className="card w-full text-center">
								<p className="mb-3">Você ainda não adicionou dias.</p>
								<button className="btn" onClick={addDay}>Adicionar primeiro dia</button>
							</div>
						)}
						{days.map(d => <DayItem key={d.id} d={d} active={selected && selected.id===d.id} onClick={()=>selectDay(d)} />)}
						<AddDayTile key="add-day-tile" onClick={addDay} />
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
													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" onClick={()=>{ setDayMenuOpen(false); addWorkout(); }}>
														<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
															<path d="M12 5v14" />
															<path d="M5 12h14" />
														</svg>
														<span>Adicionar exercício</span>
													</button>

													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center gap-2" onClick={async ()=>{
														setDayMenuOpen(false);
														if (!selected) return;
														try{
															const res = await fetch(`/api/days/${selected.id}/share`, { method: 'POST' });
															if (!res.ok) return Swal.fire({ icon: 'error', text: 'Falha ao gerar código de compartilhamento' });
															const body = await res.json();
															await navigator.clipboard.writeText(body.shareCode);
															Swal.fire({ icon: 'success', text: 'Código copiado para área de transferência', title: body.shareCode });
														}catch(e){ console.error(e); Swal.fire({ icon: 'error', text: 'Erro ao compartilhar' }); }
													}}>
														<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-600" aria-hidden>
															<path stroke="none" d="M0 0h24v24H0z" fill="none" />
															<path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
															<path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
															<path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
															<path d="M8.7 10.7l6.6 -3.4" />
															<path d="M8.7 13.3l6.6 3.4" />
														</svg>
														<span>Compartilhar dia</span>
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

													{selected && selected.shareCode && (
														<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700" onClick={async ()=>{
															setDayMenuOpen(false);
															try{
																const res = await fetch(`/api/days/${selected.id}/share`, { method: 'DELETE' });
																if (!res.ok) return Swal.fire({ icon: 'error', text: 'Falha ao revogar código' });
																await loadDays();
																Swal.fire({ icon: 'success', text: 'Compartilhamento revogado' });
															}catch(e){ console.error(e); Swal.fire({ icon: 'error', text: 'Erro ao revogar' }); }
														}}>
															<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
																<path d="M3 12h18" />
																<path d="M12 5v14" />
															</svg>
															<span>Revogar compartilhamento</span>
														</button>
													)}
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
											className={`card relative ${w.completed ? 'completed' : ''} ${draggingId===w.id ? 'opacity-60' : ''} ${dragOverIndex===idx ? 'ring-2 ring-dashed ring-slate-300' : ''}`}>
											{(() => { const ex = exercisesList.find(e => e.id === w.exerciseId); return ex && ex.imagePath ? (
												<button className="absolute bottom-2 right-2 p-2 bg-white rounded shadow-sm hover:scale-105 transition-transform" onClick={() => { setImageModalSrc(ex.imagePath); setImageModalTitle(ex.name); setShowImageModal(true); }} aria-label="Ver imagem do exercício" title="Ver imagem do exercício">
													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
														<path stroke="none" d="M0 0h24v24H0z" fill="none" />
														<path d="M15 8h.01" />
														<path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
														<path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
														<path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
													</svg>
												</button>
											) : null })()}
											<div className="flex items-start justify-between gap-4">
												<div className="flex-1 min-w-0">
													<div className="font-semibold text-sm break-words">{w.name}</div>
													<div className="text-sm text-slate-500 truncate">Séries: {w.plannedSets} • Reps: {w.plannedReps}</div>
													{w.youtube && <div className="mt-1"><a className="text-indigo-600 text-sm" href={w.youtube} target="_blank" rel="noreferrer">Vídeo</a></div>}
												</div>

												<div className="flex flex-col items-end gap-2">
													<div className="text-sm text-slate-500">Peso atual: <span className="font-semibold">{w.currentWeight ? w.currentWeight + ' kg' : '—'}</span></div>
													<div className="flex items-center gap-2">
														<button className="btn p-2 text-indigo-600" onClick={() => editWorkout(w)} aria-label="Editar exercício" title="Editar exercício">
															<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 icon icon-tabler icons-tabler-outline icon-tabler-pencil-cog" aria-hidden>
																<path stroke="none" d="M0 0h24v24H0z" fill="none" />
																<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
																<path d="M13.5 6.5l4 4" />
																<path d="M19.001 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
																<path d="M19.001 15.5v1.5" />
																<path d="M19.001 21v1.5" />
																<path d="M22.032 17.25l-1.299 .75" />
																<path d="M17.27 20l-1.3 .75" />
																<path d="M15.97 17.25l1.3 .75" />
																<path d="M20.733 20l1.3 .75" />
															</svg>
														</button>
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
														<button className="btn bg-red-600 text-white p-2 hover:bg-red-700" onClick={() => deleteWorkout(w.id)} aria-label="Excluir exercício" title="Excluir exercício">
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

				{/* Modal animations (pop in/out similar to SweetAlert2) */}
				<style jsx global>{`
					@keyframes popIn {
						from { opacity: 0; transform: translateY(-12px) scale(0.96); filter: blur(4px); }
						to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
					}
					@keyframes popOut {
						from { opacity: 1; transform: translateY(0) scale(1); }
						to { opacity: 0; transform: translateY(-6px) scale(0.98); }
					}
					.modal-pop { animation: popIn 320ms cubic-bezier(.16,1,.3,1); transform-origin: center top; }
					.modal-pop-exit { animation: popOut 220ms ease forwards; }
				`}</style>

				{/* Custom Add Exercise Modal (replaces SweetAlert2 for creation) */}
				{showAddExerciseModal && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowAddExerciseModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop" style={{ zIndex: 10000 }}>
							<h3 className="text-lg font-semibold mb-3">Novo exercício</h3>
							<div className="space-y-3">
								<label className="block text-sm">Exercício</label>
								<select ref={modalFirstRef} className="w-full border rounded px-2 py-2" value={modalExerciseId} onChange={(e)=>{ setModalExerciseId(e.target.value); }}>
									{exercisesList && exercisesList.length ? exercisesList.map(ex => (
										<option key={ex.id} value={ex.id}>{ex.name}{ex.targetMuscle ? ' — '+ex.targetMuscle : ''}</option>
									)) : null}
								</select>
								{(!exercisesList || exercisesList.length === 0) && (
									<div className="text-sm text-slate-600 mt-2">Nenhum exercício disponível. Cadastre exercícios no catálogo primeiro.</div>
								)}
								<label className="block text-sm">Séries</label>
								<input className="w-full border rounded px-2 py-2" value={modalSets} onChange={(e)=>setModalSets(e.target.value)} placeholder="Ex: 3" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddWorkout(); }} />
								<label className="block text-sm">Reps por série</label>
								<input className="w-full border rounded px-2 py-2" value={modalReps} onChange={(e)=>setModalReps(e.target.value)} placeholder="Ex: 8" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddWorkout(); }} />
								{modalError ? <div className="text-sm text-red-600 mb-2" role="alert">{modalError}</div> : null}
								</div>
								<div className="mt-4 flex justify-end gap-2">
								<button className="px-3 py-2 rounded border" onClick={()=>setShowAddExerciseModal(false)}>Cancelar</button>
								<button aria-label="Adicionar" title="Adicionar" className="px-3 py-2 rounded" onClick={handleConfirmAddWorkout} disabled={!modalExerciseId || modalLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>
									{modalLoading ? '...' : (
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
											<path stroke="none" d="M0 0h24v24H0z" fill="none" />
											<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
											<path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
											<path d="M14 4l0 4l-6 0l0 -4" />
										</svg>
									)}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Edit Exercise Modal (same style as create) */}
				{showEditModal && editModalWorkout && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowEditModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop" style={{ zIndex: 10000 }}>
							<h3 className="text-lg font-semibold mb-3">Editar exercício</h3>
							<div className="space-y-3">
								<label className="block text-sm">Exercício</label>
								<div className="w-full border rounded px-2 py-2 bg-slate-50 text-sm">{editModalWorkout.name}</div>
								<label className="block text-sm">Séries</label>
								<input ref={editModalFirstRef} className="w-full border rounded px-2 py-2" value={editModalSets} onChange={(e)=>setEditModalSets(e.target.value)} placeholder="Ex: 3" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmEditWorkout(); }} />
								<label className="block text-sm">Reps por série</label>
								<input className="w-full border rounded px-2 py-2" value={editModalReps} onChange={(e)=>setEditModalReps(e.target.value)} placeholder="Ex: 8" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmEditWorkout(); }} />
								{editModalError ? <div className="text-sm text-red-600 mt-2" role="alert">{editModalError}</div> : null}
							</div>
							<div className="mt-4 flex justify-end gap-2">
								<button className="px-3 py-2 rounded border" onClick={()=>setShowEditModal(false)}>Cancelar</button>
								<button aria-label="Salvar" title="Salvar" className="px-3 py-2 rounded" onClick={handleConfirmEditWorkout} disabled={editModalLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>{editModalLoading ? '...' : (
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
										<path stroke="none" d="M0 0h24v24H0z" fill="none" />
										<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
										<path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
										<path d="M14 4l0 4l-6 0l0 -4" />
									</svg>
								)}</button>
							</div>
						</div>
					</div>
				)}

				{/* Image Preview Modal */}
				{showImageModal && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label={imageModalTitle || 'Visualizador de imagem'}>
						<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={(e)=>{ if (e.target === e.currentTarget) setShowImageModal(false); }} aria-hidden />
						<div className="relative bg-white rounded-lg shadow-2xl max-w-3xl w-full mx-4 p-4" style={{ zIndex: 10000 }}>
							<button ref={imageModalCloseRef} className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowImageModal(false)} aria-label="Fechar visualizador">
								<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6L6 18" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
							<div className="flex flex-col md:flex-row gap-4 items-center">
								<div className="flex-1 flex items-center justify-center max-h-[70vh] overflow-hidden">
									<img src={imageModalSrc} alt={imageModalTitle} className="max-h-[70vh] w-auto max-w-full object-contain rounded" />
								</div>
								<div className="md:w-72">
									<h4 className="text-lg font-semibold">{imageModalTitle}</h4>
									<div className="text-sm text-slate-600 mt-2">Visualização do exercício. Use os botões para abrir em nova aba ou baixar a imagem.</div>
									<div className="mt-4 flex gap-2">
										<a className="px-3 py-2 rounded border text-sm" href={imageModalSrc} target="_blank" rel="noreferrer">Abrir em nova aba</a>
										<a className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" href={imageModalSrc} download>Baixar</a>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
		</div>
	)
}


