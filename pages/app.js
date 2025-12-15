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
		<div onClick={onClick} className={`day-item ${active ? 'active' : ''} ${completedClass} p-1 rounded`} aria-label={title} title={title} style={{ position: 'relative' }}>
			<DayIcon label={d.name} completed={!!d.completed} />
			{d && d.shareCode ? (
					<span className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shadow-sm" aria-hidden title="Este dia está sendo compartilhado">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" style={{ transform: 'scale(0.78)' }} aria-hidden>
							<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
							<path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
							<path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
							<path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
							<path d="M8.7 10.7l6.6 -3.4" />
							<path d="M8.7 13.3l6.6 3.4" />
						</svg>
					</span>
			) : null}
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
	const [loadingDays, setLoadingDays] = useState(true);
	const [user, setUser] = useState(null);
	const [selected, setSelected] = useState(null);
	const [workouts, setWorkouts] = useState([]);
	const [exercisesList, setExercisesList] = useState([]);
	const [imcRecords, setImcRecords] = useState([]);
	const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
	const [exerciseSearch, setExerciseSearch] = useState('');
	const exerciseDropdownRef = useRef(null);
	const [searchResults, setSearchResults] = useState(null);
	const [isSearching, setIsSearching] = useState(false);

	const ASYNC_SEARCH_MIN = 2; // only trigger async fetch for queries length >= 2

	const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
	const [modalExerciseId, setModalExerciseId] = useState('');
	const [modalSets, setModalSets] = useState('');
	const [modalReps, setModalReps] = useState('');
	const [modalError, setModalError] = useState('');
	const [modalLoading, setModalLoading] = useState(false);
	const modalFirstRef = useRef(null);
	// Add Day modal state (use same layout as exercise modals)
	const [showAddDayModal, setShowAddDayModal] = useState(false);
	const [dayName, setDayName] = useState('');
	const [daySubtitle, setDaySubtitle] = useState('');
	const [dayTemplate, setDayTemplate] = useState('');
	const [dayError, setDayError] = useState('');
	const [dayLoading, setDayLoading] = useState(false);
	const dayFirstRef = useRef(null);
	// removed custom day name (only standard weekdays allowed)

	// Image preview modal state
	const [showImageModal, setShowImageModal] = useState(false);
	const [imageModalSrc, setImageModalSrc] = useState('');
	const [imageModalTitle, setImageModalTitle] = useState('');
	const imageModalCloseRef = useRef(null);

	// Smart Assistant modal state
	const [showAssistantModal, setShowAssistantModal] = useState(false);
	const [assistantWeight, setAssistantWeight] = useState('');
	const [assistantHeight, setAssistantHeight] = useState('');
	const [assistantMuscle, setAssistantMuscle] = useState('');
	const [assistantLoading, setAssistantLoading] = useState(false);
	const [assistantError, setAssistantError] = useState('');

	// Edit modal state (new modal, same pattern as creation)
	const [showEditModal, setShowEditModal] = useState(false);
	const [editModalWorkout, setEditModalWorkout] = useState(null);
	const [editModalSets, setEditModalSets] = useState('');
	const [editModalReps, setEditModalReps] = useState('');
	const [editModalLoading, setEditModalLoading] = useState(false);
	const [editModalError, setEditModalError] = useState('');
	const editModalFirstRef = useRef(null);
	// Current weight modal state (same style as other modals)
	const [showWeightModal, setShowWeightModal] = useState(false);
	const [weightModalWorkoutId, setWeightModalWorkoutId] = useState(null);
	const [weightModalValue, setWeightModalValue] = useState('');
	const [weightModalLoading, setWeightModalLoading] = useState(false);
	const [weightModalError, setWeightModalError] = useState('');
	const weightModalFirstRef = useRef(null);
	// Logout confirmation modal state
	const [showLogoutModal, setShowLogoutModal] = useState(false);
	const [logoutModalLoading, setLogoutModalLoading] = useState(false);
	const [logoutModalError, setLogoutModalError] = useState('');
	const logoutModalFirstRef = useRef(null);
	// Delete workout modal state
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showDeleteDayModal, setShowDeleteDayModal] = useState(false);
	const [deleteDayLoading, setDeleteDayLoading] = useState(false);
	const [deleteDayError, setDeleteDayError] = useState('');
	const deleteDayFirstRef = useRef(null);
	const [deleteModalWorkoutId, setDeleteModalWorkoutId] = useState(null);
	const [deleteModalLoading, setDeleteModalLoading] = useState(false);
	const [deleteModalError, setDeleteModalError] = useState('');
	const deleteModalFirstRef = useRef(null);
	// Share day modal state
	const [showShareModal, setShowShareModal] = useState(false);
	const [shareModalLoading, setShareModalLoading] = useState(false);
	const [shareModalError, setShareModalError] = useState('');
	const [shareCode, setShareCode] = useState('');
	const shareModalFirstRef = useRef(null);
	const [timerSeconds, setTimerSeconds] = useState(null);
	const [showStartModal, setShowStartModal] = useState(false);
	const [startModalMode, setStartModalMode] = useState('start'); // 'start' or 'cancel'
	const [startModalLoading, setStartModalLoading] = useState(false);
	const [startModalError, setStartModalError] = useState('');
	const timerRef = useRef(null);

	// Complete-day confirmation modal state
	const [showCompleteDayModal, setShowCompleteDayModal] = useState(false);
	const [completeDayLoading, setCompleteDayLoading] = useState(false);
	const [completeDayError, setCompleteDayError] = useState('');
	const completeDayFirstRef = useRef(null);
	const [draggingId, setDraggingId] = useState(null);
	const [dragOverIndex, setDragOverIndex] = useState(null);
	const [dayMenuOpen, setDayMenuOpen] = useState(false);
	const dayMenuRef = useRef(null);

	// off-canvas state
	const [offCanvasOpen, setOffCanvasOpen] = useState(false);
	const offCanvasRef = useRef(null);

	// offcanvas user dropdown (username -> settings / logout)
	const [offcanvasUserDropdownOpen, setOffcanvasUserDropdownOpen] = useState(false);
	const offcanvasUserDropdownRef = useRef(null);

// close offcanvas user dropdown when clicking outside or pressing Escape
useEffect(()=>{
	if (!offcanvasUserDropdownOpen) return;
	function onDoc(e){
		if (!offcanvasUserDropdownRef.current) return;
		if (!offcanvasUserDropdownRef.current.contains(e.target)) setOffcanvasUserDropdownOpen(false);
	}
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
				// load recent IMC records for dashboard cards
				try { const r2 = await fetch('/api/imc'); if (r2.ok) setImcRecords(await r2.json()); } catch(e) { /* ignore */ }
			}catch(e){
				console.error('Auth check failed', e);
				router.replace('/login');
			}
		}
		initAuthAndLoad();
	},[]);

	async function loadDays(){
		setLoadingDays(true);
		try{
			const res = await fetch('/api/days');
			const data = await res.json();
			if (!Array.isArray(data)) {
				console.warn('loadDays: unexpected response', data);
				setDays([]);
				return [];
			}
			setDays(data);
			return data;
		}catch(e){
			console.error('loadDays error', e);
			setDays([]);
			return [];
		}finally{ setLoadingDays(false); }
	}

	async function selectDay(d){
		// Toggle selected day: if clicking the already-selected day, deselect and show initial dashboard cards
		if (selected && d && selected.id === d.id) {
			setSelected(null);
			setWorkouts([]);
			setTimerSeconds(null);
			if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
			return;
		}
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

	// logout helper used by offcanvas and dropdown
	async function logoutAndRedirect(){
		setOffCanvasOpen(false);
		try { await fetch('/api/auth/logout', { method: 'POST' }); } catch(e){ /* ignore */ }
		router.replace('/login');
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


		function addDay(){
			// open custom modal (same layout as exercise modals)
			const weekDays = ['Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado','Domingo'];
			const used = (days || []).map(d => d && d.name).filter(Boolean);
			const available = weekDays.filter(w => !used.includes(w));
			setDayName(available.length ? available[0] : '');
			// customDayName removed
			setDaySubtitle('');
			setDayTemplate('');
			setDayError('');
			setDayLoading(false);
			setShowAddDayModal(true);
		}

		async function handleConfirmAddDay(){
			if (dayLoading) return;
			setDayError(''); setDayLoading(true);
			try {
				if (dayTemplate && String(dayTemplate).trim()) {
					await fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateCode: String(dayTemplate).trim() }) });
				} else {
					if (!dayName || !String(dayName).trim()) { setDayError('Nome do dia é obrigatório'); setDayLoading(false); return; }
					const nameToSend = String(dayName).trim();
					if (usedDayNames.includes(nameToSend)) { setDayError('Este dia já existe'); setDayLoading(false); return; }
					if (!daySubtitle || !String(daySubtitle).trim()) { setDayError('Legenda é obrigatória'); setDayLoading(false); return; }
					await fetch('/api/days', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameToSend, subtitle: String(daySubtitle).trim() }) });
				}
				await loadDays();
				setShowAddDayModal(false);
			} catch (e) {
				console.error(e);
				setDayError(e.message || 'Erro inesperado');
			} finally { setDayLoading(false); }
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

	function deleteWorkout(workoutId){
		// open custom confirm modal
		setDeleteModalWorkoutId(workoutId);
		setDeleteModalError('');
		setDeleteModalLoading(false);
		setShowDeleteModal(true);
	}

	async function handleConfirmDeleteWorkout(){
		if (deleteModalLoading) return;
		setDeleteModalError(''); setDeleteModalLoading(true);
		try {
			if (!deleteModalWorkoutId) throw new Error('Exercício inválido');
			const resDel = await fetch(`/api/workouts/${deleteModalWorkoutId}`, { method: 'DELETE' });
			if (!resDel.ok) throw new Error('Falha ao excluir exercício');
			const res = await fetch(`/api/days/${selected.id}/workouts`);
			setWorkouts(await res.json());
			setShowDeleteModal(false);
			Swal.fire({ icon: 'success', text: 'Exercício excluído' });
		} catch (e) {
			console.error(e);
			setDeleteModalError(e.message || 'Erro inesperado');
		} finally {
			setDeleteModalLoading(false);
		}
	}

async function handleConfirmLogout(){
	if (logoutModalLoading) return;
	setLogoutModalError(''); setLogoutModalLoading(true);
	try{
		const res = await fetch('/api/auth/logout', { method: 'POST' });
		// ignore response errors; we'll redirect anyway
		setShowLogoutModal(false);
		router.replace('/login');
	}catch(e){
		console.error(e);
		setLogoutModalError(e.message || 'Erro ao sair');
	}finally{
		setLogoutModalLoading(false);
	}
}

async function handleConfirmDeleteDay(){
	if (deleteDayLoading) return;
	setDeleteDayError(''); setDeleteDayLoading(true);
	try {
		if (!selected || !selected.id) throw new Error('Dia inválido');
		const res = await fetch(`/api/days/${selected.id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Falha ao excluir dia');
		await loadDays();
		setSelected(null);
		setWorkouts([]);
		setShowDeleteDayModal(false);
		try { Swal.fire({ icon: 'success', text: 'Dia e registros excluídos' }); } catch(e) { /* ignore */ }
	} catch (e) {
		console.error(e);
		setDeleteDayError(e.message || 'Erro inesperado');
	} finally {
		setDeleteDayLoading(false);
	}
}

	async function setCurrentWeight(workoutId){
		// open the custom modal and prefill with current weight if available
		const w = workouts.find(x => x.id === workoutId);
		setWeightModalWorkoutId(workoutId);
		setWeightModalValue(w && w.currentWeight ? String(w.currentWeight) : '');
		setWeightModalError('');
		setWeightModalLoading(false);
		setShowWeightModal(true);
	}

	async function handleConfirmSetWeight(){
		if (weightModalLoading) return;
		setWeightModalError(''); setWeightModalLoading(true);
		try {
			const wt = weightModalValue;
			const body = wt === '' ? { weight: null } : { weight: Number(wt) };
			const res = await fetch(`/api/workouts/${weightModalWorkoutId}/current`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
			if (!res.ok) throw new Error('Falha ao definir peso');
			const r = await fetch(`/api/days/${selected.id}/workouts`);
			setWorkouts(await r.json());
			setShowWeightModal(false);
		} catch (e) {
			console.error(e);
			setWeightModalError(e.message || 'Erro inesperado');
		} finally {
			setWeightModalLoading(false);
		}
	}

	function computeImc(weight, height){
 		const w = Number(weight);
 		const h = Number(height);
 		if (!w || !h) return null;
 		return w / ((h/100)*(h/100));
 	}

	async function handleGenerateAssistant(){
 		if (assistantLoading) return;
 		setAssistantError(''); setAssistantLoading(true);
 		try {
 			const body = { weight: assistantWeight === '' ? null : Number(assistantWeight), height: assistantHeight === '' ? null : Number(assistantHeight), muscle: assistantMuscle };
 			const res = await fetch('/api/assistant/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 			const data = await res.json().catch(()=>null);
 			if (!res.ok) {
 				const msg = (data && data.error) ? data.error : 'Falha ao gerar treino';
 				setAssistantError(msg);
 				return;
 			}
 			// refresh days and open the created day
 			if (data && data.day) {
 				await loadDays();
 				setShowAssistantModal(false);
 				setSelected(data.day);
 				const r = await fetch(`/api/days/${data.day.id}/workouts`);
 				setWorkouts(await r.json());
 				Swal.fire({ icon: 'success', text: 'Dia gerado com sucesso' });
 			} else {
 				Swal.fire({ icon: 'success', text: 'Dia gerado' });
 			}
 		} catch (e) {
 			console.error('assistant generate failed', e);
 			setAssistantError(e.message || 'Erro inesperado');
 		} finally {
 			setAssistantLoading(false);
 		}
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
		const r = await fetch(`/api/days/${day.id}/workouts`); setWorkouts(await r.json());
		// initialize timer
		if (day && day.startedAt) {
			const s = Math.max(0, Math.round((Date.now() - new Date(day.startedAt).getTime())/1000));
			setTimerSeconds(s);
		}
		Swal.fire({ icon: 'success', text: 'Treino iniciado: marcadores resetados' });
	}

	async function cancelStartAction(){
		if (!selected) return Swal.fire({ icon: 'info', text: 'Selecione um dia' });
		try {
			const res = await fetch(`/api/days/${selected.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancel: true }) });
			let body = null;
			try { body = await res.json(); } catch (e) { /* ignore */ }
			if (!res.ok) {
				return Swal.fire({ icon: 'error', text: 'Falha ao cancelar contagem' });
			}
			const day = body;
			await loadDays();
			setSelected(day);
			const r = await fetch(`/api/days/${day.id}/workouts`); setWorkouts(await r.json());
			setTimerSeconds(null);
			if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
			Swal.fire({ icon: 'success', text: 'Contador cancelado' });
		} catch (e) {
			console.error('cancelStartAction failed', e);
			Swal.fire({ icon: 'error', text: 'Erro ao cancelar contagem' });
		}
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
		const r = await fetch(`/api/days/${day.id}/workouts`); setWorkouts(await r.json());
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

// close exercise dropdown when clicking outside
useEffect(()=>{
	function onDoc(e){
		if (!exerciseDropdownRef.current) return;
		if (!exerciseDropdownRef.current.contains(e.target) && showExerciseDropdown) setShowExerciseDropdown(false);
	}
	function onKey(e){ if (e.key === 'Escape' && showExerciseDropdown) setShowExerciseDropdown(false); }
	if (showExerciseDropdown) {
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
	}
	return ()=>{
		document.removeEventListener('mousedown', onDoc);
		document.removeEventListener('keydown', onKey);
	};
},[showExerciseDropdown]);

// async search for exercises (debounced)
useEffect(()=>{
	let t = null;
	if (!exerciseSearch || exerciseSearch.length < ASYNC_SEARCH_MIN) {
		setSearchResults(null);
		setIsSearching(false);
		return;
	}
	setIsSearching(true);
	t = setTimeout(async ()=>{
		try {
			const q = encodeURIComponent(exerciseSearch.trim());
			const res = await fetch(`/api/exercises?search=${q}`);
			if (res.ok) {
				const data = await res.json();
				setSearchResults(data || []);
			} else {
				setSearchResults(null);
			}
		} catch(e) {
			console.error('exercise async search failed', e);
			setSearchResults(null);
		} finally {
			setIsSearching(false);
		}
	}, 300);
	return ()=>{ if (t) clearTimeout(t); };
},[exerciseSearch]);

	// focus first control when Add Day modal opens
useEffect(()=>{
    if (showAddDayModal && dayFirstRef && dayFirstRef.current) {
        try { dayFirstRef.current.focus(); } catch(e) { /* ignore */ }
    }
},[showAddDayModal]);

	// Week days and available options (exclude already created days)
	const WEEK_DAYS = ['Segunda-Feira','Terça-Feira','Quarta-Feira','Quinta-Feira','Sexta-Feira','Sábado','Domingo'];
	const usedDayNames = (days || []).map(d => d && d.name).filter(Boolean);
	const availableWeekDays = WEEK_DAYS.filter(w => !usedDayNames.includes(w));

	// derive available muscle targets from exercisesList
	const muscleOptions = Array.from(new Set((exercisesList || []).map(e => e.targetMuscle || '').filter(Boolean))).sort((a,b)=>a.localeCompare(b, 'pt-BR'));

	useEffect(()=>{
		if (showAssistantModal) {
			if (muscleOptions.length && (!assistantMuscle || assistantMuscle === '')) setAssistantMuscle(muscleOptions[0]);
		}
	},[showAssistantModal, exercisesList]);

	// selected personalized muscle (derived from workouts -> exercisesList)
	let selectedPersonalMuscle = null;
	if (selected && selected.name === 'Exercicio Personalizado') {
		const w = (workouts || []).find(x => x && x.exerciseId);
		if (w && exercisesList && exercisesList.length) {
			const ex = exercisesList.find(e => Number(e.id) === Number(w.exerciseId));
			selectedPersonalMuscle = ex ? ex.targetMuscle : null;
		}
	}

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

// focus weight modal first control when opens
useEffect(()=>{
	if (showWeightModal && weightModalFirstRef && weightModalFirstRef.current) {
		try { weightModalFirstRef.current.focus(); } catch(e) { /* ignore */ }
	}
},[showWeightModal]);

// focus delete modal when opens
useEffect(()=>{
	if (showDeleteModal && deleteModalFirstRef && deleteModalFirstRef.current) {
		try { deleteModalFirstRef.current.focus(); } catch(e) { /* ignore */ }
	}
},[showDeleteModal]);

// focus delete day modal when opens
useEffect(()=>{
    if (showDeleteDayModal && deleteDayFirstRef && deleteDayFirstRef.current) {
        try { deleteDayFirstRef.current.focus(); } catch(e) { /* ignore */ }
    }
},[showDeleteDayModal]);

// focus complete day modal when opens
useEffect(()=>{
	if (showCompleteDayModal && completeDayFirstRef && completeDayFirstRef.current) {
		try { completeDayFirstRef.current.focus(); } catch(e) { /* ignore */ }
	}
},[showCompleteDayModal]);

// focus logout modal when opens
useEffect(()=>{
	if (showLogoutModal && logoutModalFirstRef && logoutModalFirstRef.current) {
		try { logoutModalFirstRef.current.focus(); } catch(e) { /* ignore */ }
	}
},[showLogoutModal]);

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
				<div className="flex items-center gap-1 px-3">
					<img src="/images/TRANINGHUB.svg" alt="TrainHub" className="h-20" />
				</div>
				<div className="flex gap-1 items-center">
					{/* Smart Assistant button (bot icon) */}
					<button type="button" onClick={(e)=>{ e.preventDefault(); setShowAssistantModal(true); }} className="flex items-center justify-center p-1 mr-1" aria-label="Assistente" title="Assistente inteligente">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
							<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
							<path d="M11.217 19.384a3.501 3.501 0 0 0 6.783 -1.217v-5.167l-6 -3.35" />
							<path d="M5.214 15.014a3.501 3.501 0 0 0 4.446 5.266l4.34 -2.534v-6.946" />
							<path d="M6 7.63c-1.391 -.236 -2.787 .395 -3.534 1.689a3.474 3.474 0 0 0 1.271 4.745l4.263 2.514l6 -3.348" />
							<path d="M12.783 4.616a3.501 3.501 0 0 0 -6.783 1.217v5.067l6 3.45" />
							<path d="M18.786 8.986a3.501 3.501 0 0 0 -4.446 -5.266l-4.34 2.534v6.946" />
							<path d="M18 16.302c1.391 .236 2.787 -.395 3.534 -1.689a3.474 3.474 0 0 0 -1.271 -4.745l-4.308 -2.514l-5.955 3.42" />
						</svg>
					</button>

					{/* menu button replaces avatar — opens off-canvas */}
					<button type="button" onClick={(e)=>{ e.preventDefault(); setOffCanvasOpen(v=>!v); }} className="flex items-center justify-center p-1" aria-haspopup="true" aria-expanded={offCanvasOpen} aria-label="Abrir menu" title="Abrir menu">
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
										<div className="relative">
											<button type="button" onClick={()=>setOffcanvasUserDropdownOpen(v=>!v)} className="text-left" aria-haspopup="true" aria-expanded={offcanvasUserDropdownOpen}>
												<div className="font-semibold">{user ? (user.name ? user.name : user.email) : 'Usuário'}</div>
												<div className="text-xs text-slate-500">{user ? (user.email ? user.email : '') : ''}</div>
											</button>
											{offcanvasUserDropdownOpen && (
												<div ref={offcanvasUserDropdownRef} className="absolute left-0 mt-2 w-44 bg-white border border-slate-200 rounded shadow-sm z-50">
													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100">Configurações</button>
													<button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 text-red-600" onClick={()=>{ setOffcanvasUserDropdownOpen(false); setShowLogoutModal(true); }}>Sair</button>
												</div>
											)}
										</div>
										<div>
											<button aria-label="Fechar" title="Fechar" className="p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setOffCanvasOpen(false)}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
													<path stroke="none" d="M0 0h24v24H0z" fill="none" />
													<path d="M18 6l-12 12" />
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
						{loadingDays ? (
							<div className="card w-full text-center p-6 flex flex-col items-center gap-3">
								<svg className="animate-spin h-8 w-8 text-amber-500" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
								</svg>
								<div className="text-sm font-medium">Carregando seus dias...</div>
								<div className="text-xs text-slate-500">Aguarde enquanto buscamos seus treinos e configurações.</div>
							</div>
						) : null}

						{/* Current Weight Modal (same style as other modals) */}
						{showWeightModal && (
							<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Definir peso atual">
								<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowWeightModal(false); }} aria-hidden />
								<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
									<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowWeightModal(false)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
											<path stroke="none" d="M0 0h24v24H0z" fill="none" />
											<path d="M18 6l-12 12" />
											<path d="M6 6l12 12" />
										</svg>
									</button>
									<div className="mb-3">
										<h3 className="text-lg font-semibold">Peso atual (kg)</h3>
										<div className="text-sm text-slate-500">Insira o peso atual em kg (deixe vazio para limpar).</div>
									</div>
									<div className="space-y-3">
										<label className="block text-sm font-medium">Peso</label>
										<input ref={weightModalFirstRef} className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={weightModalValue} onChange={(e)=>setWeightModalValue(e.target.value)} placeholder="Ex: 35 (deixe vazio para limpar)" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmSetWeight(); }} />
										{weightModalError ? <div className="text-sm text-red-600 mt-2" role="alert">{weightModalError}</div> : null}
									</div>
									<div className="mt-4 flex justify-end">
										<button aria-label="Salvar" title="Salvar" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" onClick={handleConfirmSetWeight} disabled={weightModalLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>{weightModalLoading ? '...' : (
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

							{/* Complete Day Confirmation Modal */}
							{showCompleteDayModal && (
								<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Confirmar conclusão do dia">
									<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowCompleteDayModal(false); }} aria-hidden />
									<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
										<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowCompleteDayModal(false)}>
											<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
												<path stroke="none" d="M0 0h24v24H0z" fill="none" />
												<path d="M18 6l-12 12" />
												<path d="M6 6l12 12" />
											</svg>
										</button>
										<div className="mb-3">
											<h3 className="text-lg font-semibold">Concluir dia?</h3>
											<div className="text-sm text-slate-500">Marcar este dia como concluído. Isso irá parar o temporizador e registrar a duração final.</div>
										</div>
										<div className="space-y-3">
											{completeDayError ? <div className="text-sm text-red-600" role="alert">{completeDayError}</div> : null}
										</div>
										<div className="mt-4 flex justify-end gap-2">
											<button className="px-3 py-2 rounded" onClick={()=>setShowCompleteDayModal(false)}>Fechar</button>
											<button ref={completeDayFirstRef} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition bg-emerald-600 text-white" onClick={async ()=>{
												if (completeDayLoading) return;
												setCompleteDayError(''); setCompleteDayLoading(true);
												try {
													await completeDayAction();
													setShowCompleteDayModal(false);
												} catch (e) {
													console.error(e);
													setCompleteDayError(e.message || 'Erro ao concluir dia');
												} finally { setCompleteDayLoading(false); }
											}} disabled={completeDayLoading}>{completeDayLoading ? '...' : 'Sim, concluir'}</button>
										</div>
									</div>
								</div>
							)}

							{/* Delete Day Modal (standard modal pattern) */}
							{showDeleteDayModal && (
								<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Excluir dia">
									<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowDeleteDayModal(false); }} aria-hidden />
									<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
										<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowDeleteDayModal(false)}>
											<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
												<path stroke="none" d="M0 0h24v24H0z" fill="none" />
												<path d="M18 6l-12 12" />
												<path d="M6 6l12 12" />
											</svg>
										</button>
										<div className="mb-3">
											<h3 className="text-lg font-semibold">Excluir dia?</h3>
											<div className="text-sm text-slate-500">Isto removerá o dia e todos os exercícios e registros vinculados.</div>
										</div>
										<div className="space-y-3">
											<div className="text-sm text-slate-700">{selected ? <><strong>{selected.name}</strong><div className="text-xs text-slate-500">{selected.subtitle}</div></> : null}</div>
											{deleteDayError ? <div className="text-sm text-red-600 mt-2" role="alert">{deleteDayError}</div> : null}
										</div>
										<div className="mt-4 flex justify-end gap-2">
											<button className="px-3 py-2 rounded" onClick={()=>setShowDeleteDayModal(false)}>Fechar</button>
											<button ref={deleteDayFirstRef} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition bg-red-600 text-white" onClick={handleConfirmDeleteDay} disabled={deleteDayLoading}>{deleteDayLoading ? '...' : 'Sim, excluir'}</button>
										</div>
									</div>
								</div>
							)}

									{/* Smart Assistant Modal */}
									{showAssistantModal && (
										<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Assistente inteligente">
											<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowAssistantModal(false); }} aria-hidden />
											<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
												<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowAssistantModal(false)}>
													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
														<path stroke="none" d="M0 0h24v24H0z" fill="none" />
														<path d="M18 6l-12 12" />
														<path d="M6 6l12 12" />
													</svg>
												</button>
												<div className="mb-3">
													<h3 className="text-lg font-semibold">Assistente inteligente</h3>
													<div className="text-sm text-slate-500">Preencha alguns dados rápidos para gerar um dia de treino personalizado.</div>
												</div>
												<div className="space-y-3">
													<div>
														<label className="block text-sm font-medium">Peso (kg)</label>
														<input className="w-full border border-slate-200 rounded-md px-3 py-2" value={assistantWeight} onChange={(e)=>setAssistantWeight(e.target.value)} placeholder="Ex: 75" />
													</div>
													<div>
														<label className="block text-sm font-medium">Altura (cm)</label>
														<input className="w-full border border-slate-200 rounded-md px-3 py-2" value={assistantHeight} onChange={(e)=>setAssistantHeight(e.target.value)} placeholder="Ex: 175" />
													</div>
													<div>
														<label className="block text-sm font-medium">Músculo alvo</label>
														{muscleOptions.length === 0 ? (
															<div className="text-sm text-slate-600 mt-2">Nenhum músculo disponível no banco de dados.</div>
														) : (
															<select className="w-full border border-slate-200 rounded-md px-3 py-2" value={assistantMuscle} onChange={(e)=>setAssistantMuscle(e.target.value)}>
																{muscleOptions.map(m => (<option key={m} value={m}>{m}</option>))}
															</select>
														)}
													</div>
													{assistantError ? <div className="text-sm text-red-600">{assistantError}</div> : null}
													<div className="text-sm text-slate-600">IMC: {computeImc(assistantWeight, assistantHeight) ? computeImc(assistantWeight, assistantHeight).toFixed(1) : '-'}</div>
												</div>
												<div className="mt-4 flex justify-end gap-2">
													<button className="px-3 py-2 rounded" onClick={()=>setShowAssistantModal(false)}>Fechar</button>
													<button className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" onClick={handleGenerateAssistant} disabled={assistantLoading || muscleOptions.length === 0 || !assistantMuscle} style={{ backgroundColor: '#d4f523', color: '#072000' }}>{assistantLoading ? 'Gerando...' : 'Gerar e salvar'}</button>
												</div>
											</div>
										</div>
									)}

						{/* Share Day Modal (same pattern as other modals) */}
						{showShareModal && (
							<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Compartilhar dia">
								<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowShareModal(false); }} aria-hidden />
								<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
									<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowShareModal(false)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
											<path stroke="none" d="M0 0h24v24H0z" fill="none" />
											<path d="M18 6l-12 12" />
											<path d="M6 6l12 12" />
										</svg>
									</button>
									<div className="mb-3">
										<h3 className="text-lg font-semibold">Compartilhar dia</h3>
										<div className="text-sm text-slate-500">Gere um código para compartilhar este dia com outras pessoas. O código será copiado automaticamente para a área de transferência.</div>
									</div>
									<div className="space-y-3">
										{shareModalError ? <div className="text-sm text-red-600" role="alert">{shareModalError}</div> : null}
										{shareCode ? (
											<div>
												<label className="block text-sm font-medium">Código de compartilhamento</label>
												<div className="mt-1 flex items-center gap-2">
													<input readOnly className="w-full border border-slate-200 bg-slate-50 rounded-md px-3 py-2" value={shareCode} />
													<button className="px-3 py-2 rounded" onClick={async ()=>{ try{ await navigator.clipboard.writeText(shareCode); }catch(e){ console.error(e); } }} style={{ background: '#d4f522', color: '#072000' }} aria-label="Copiar código">
														<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
															<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
															<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
															<path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
														</svg>
													</button>
												</div>
												<div className="text-xs text-slate-500 mt-2">Cole este código na opção de importação/compartilhamento.</div>
											</div>
										) : (
											<div className="text-sm text-slate-600">Clique em &quot;Gerar e copiar&quot; para criar um código de compartilhamento.</div>
										)}
									</div>
										<div className="mt-4 flex justify-end gap-2">
											{!shareCode ? (
												<button className="px-3 py-2 rounded" style={{ background: '#d4f522', color: '#072000' }} onClick={async ()=>{
													if (!selected) { setShareModalError('Nenhum dia selecionado'); return; }
													setShareModalLoading(true); setShareModalError('');
													try{
														const res = await fetch(`/api/days/${selected.id}/share`, { method: 'POST' });
														if (!res.ok) { throw new Error('Falha ao gerar código'); }
														const body = await res.json();
														setShareCode(body.shareCode || '');
														try{ await navigator.clipboard.writeText(body.shareCode); }catch(e){ /* ignore */ }
														const updatedDays = await loadDays();
														const updatedSelected = updatedDays && updatedDays.find(dd => dd.id === selected.id);
														if (updatedSelected) setSelected(updatedSelected);
													}catch(e){ console.error(e); setShareModalError(e.message || 'Erro ao gerar código'); }
													finally{ setShareModalLoading(false); }
												}}>Gerar e copiar</button>
											) : (
												<>
													<button className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition bg-red-600 text-white" disabled={shareModalLoading} onClick={async ()=>{
														if (!selected) { setShareModalError('Nenhum dia selecionado'); return; }
														setShareModalLoading(true); setShareModalError('');
														try{
															const res = await fetch(`/api/days/${selected.id}/share`, { method: 'DELETE' });
															if (!res.ok) { setShareModalError('Falha ao cancelar compartilhamento'); return; }
															const updatedDays = await loadDays();
															const updatedSelected = updatedDays && updatedDays.find(dd => dd.id === selected.id);
															setSelected(updatedSelected || null);
															setShareCode('');
															setShowShareModal(false);
															try { Swal.fire({ icon: 'success', text: 'Compartilhamento cancelado' }); } catch(e) { /* ignore */ }
														}catch(e){ console.error(e); setShareModalError('Erro ao cancelar'); }
														finally{ setShareModalLoading(false); }
													}}>Cancelar compartilhamento</button>
													<button className="px-3 py-2 rounded" style={{ background: '#d4f522', color: '#072000' }} onClick={()=>setShowShareModal(false)}>Fechar</button>
												</>
											)}
										</div>
								</div>
							</div>
						)}

						{/* Delete confirmation modal (replaces Swal confirm) */}
						{showDeleteModal && (
							<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Excluir exercício">
								<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowDeleteModal(false); }} aria-hidden />
								<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
									<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowDeleteModal(false)}>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
											<path stroke="none" d="M0 0h24v24H0z" fill="none" />
											<path d="M18 6l-12 12" />
											<path d="M6 6l12 12" />
										</svg>
									</button>
									<div className="mb-3">
										<h3 className="text-lg font-semibold">Excluir exercício?</h3>
										<div className="text-sm text-slate-500">Isto removerá o exercício e todos os registros relacionados.</div>
									</div>
									<div className="space-y-3">
										<div className="text-sm text-slate-700">{(() => { const w = workouts.find(x => x.id === deleteModalWorkoutId); return w ? <strong>{w.name}</strong> : null })()}</div>
										{deleteModalError ? <div className="text-sm text-red-600 mt-2" role="alert">{deleteModalError}</div> : null}
									</div>
									<div className="mt-4 flex justify-end">
										<button ref={deleteModalFirstRef} aria-label="Excluir" title="Excluir" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition bg-red-600 text-white" onClick={handleConfirmDeleteWorkout} disabled={deleteModalLoading}>{deleteModalLoading ? '...' : 'Sim, excluir'}</button>
									</div>
								</div>
							</div>
						)}

								{/* Start / Cancel modal (same style as Add/Edit exercise modal) */}
								{showStartModal && (
									<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
										<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowStartModal(false); }} aria-hidden />
										<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
											<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowStartModal(false)}>
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
													<path stroke="none" d="M0 0h24v24H0z" fill="none" />
													<path d="M18 6l-12 12" />
													<path d="M6 6l12 12" />
												</svg>
											</button>
											<div className="mb-3">
												<h3 className="text-lg font-semibold">{startModalMode === 'start' ? 'Iniciar treino' : 'Cancelar contagem'}</h3>
												<div className="text-sm text-slate-500">{startModalMode === 'start' ? 'Ao iniciar, os exercícios serão resetados como não concluídos e o temporizador começará.' : 'Isto irá cancelar a contagem atual do treino. Os marcadores de concluído não serão alterados.'}</div>
											</div>
											<div className="space-y-3">
												{startModalError ? <div className="text-sm text-red-600" role="alert">{startModalError}</div> : null}
											</div>
											<div className="mt-4 flex justify-end gap-2">
												<button className="px-3 py-2 rounded" onClick={()=>setShowStartModal(false)}>Fechar</button>
												<button className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition ${startModalMode==='cancel' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`} onClick={async ()=>{
													setStartModalLoading(true); setStartModalError('');
													try {
														if (startModalMode === 'start') {
															await startDayAction();
														} else {
															await cancelStartAction();
														}
														setShowStartModal(false);
													} catch (e) {
														console.error(e); setStartModalError(e.message || 'Erro inesperado');
													} finally { setStartModalLoading(false); }
												}} disabled={startModalLoading}>{startModalLoading ? '...' : (startModalMode==='cancel' ? 'Cancelar' : 'Iniciar')}</button>
											</div>
										</div>
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
									<div className="flex items-center gap-3 min-w-0">
										<h2 className="text-xl font-semibold truncate min-w-0">{selected.name}</h2>
										{/* shared pill moved to footer to avoid header wrapping */}
									</div>
									{selected.subtitle && <div className="text-sm text-slate-500">{(selected.name === 'Exercicio Personalizado' && selectedPersonalMuscle) ? `${selected.subtitle} - ${selectedPersonalMuscle}` : selected.subtitle}</div>}
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


											{selected && selected.startedAt ? (
												<button className="btn p-2 text-white rounded-full w-8 h-8 flex items-center justify-center" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={() => { setStartModalMode('cancel'); setShowStartModal(true); }} aria-label="Cancelar treino" title="Cancelar treino">
													<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="white" aria-hidden>
														<rect x="6" y="6" width="12" height="12" rx="2" />
													</svg>
												</button>
											) : (
												<button className="btn p-2 bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center" onClick={() => { setStartModalMode('start'); setShowStartModal(true); }} aria-label="Iniciar treino" title="Iniciar treino">
													<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
														<path d="M5 3l15 9L5 21V3z" />
													</svg>
												</button>
											)}
											{!selected || (selected && !selected.completed) ? (
												<button className="btn p-2 text-white rounded-full w-8 h-8 flex items-center justify-center" style={{ backgroundColor: '#16a34a', color: '#fff' }} onClick={()=>{ setShowCompleteDayModal(true); }} aria-label="Concluir dia" title="Concluir dia">
													<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
														<path d="M20 6L9 17l-5-5" />
													</svg>
												</button>
											) : null}

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
															setShareModalError(''); setShareModalLoading(false);
															setShareCode(selected && selected.shareCode ? selected.shareCode : '');
															setShowShareModal(true);
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
														setDeleteDayError(''); setDeleteDayLoading(false);
														setShowDeleteDayModal(true);
													}}>
														<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
															<path d="M0 0h24v24H0z" fill="none"/>
															<path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16z" />
															<path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z" />
														</svg>
														<span>Excluir dia</span>
													</button>

													{/* Revogar compartilhamento movido para o modal; botão removido daqui */}
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
													<div className="font-semibold text-sm truncate" title={w.name}>{w.name}</div>
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
													{(selected && selected.startedAt) ? (
														<label className="flex items-center gap-2 text-sm">
															<input type="checkbox" checked={!!w.completed} onChange={async (e) => {
																const next = e.target.checked;
																await fetch(`/api/workouts/${w.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: next }) });
																const res = await fetch(`/api/days/${selected.id}/workouts`);
																setWorkouts(await res.json());
															}} />
															<span className="whitespace-nowrap">{w.completed ? 'Concluído' : 'Marcar concluído'}</span>
														</label>
													) : (
														<div className="px-3 py-1 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
															<span className="font-semibold">Inicie o treino</span>
															<span className="text-slate-500"> para habilitar marcar exercícios como concluídos.</span>
														</div>
													)}
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
						<div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{/* IMC card (clickable, vibrant) */}
								<div role="button" tabIndex={0} aria-label="Ir para IMC" onClick={() => router.push('/imc')} onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') router.push('/imc'); }} className="dashboard-card bg-white rounded-lg p-4 transition transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4 min-w-0">
											<div className="w-14 h-14 rounded-full flex items-center justify-center icon-glow" style={{ background: 'linear-gradient(135deg,#fff7cc,#d4f523)', color: '#072000' }} aria-hidden>
												<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20l9-5-9-5-9 5 9 5z" /><path d="M12 12l9-5-9-5-9 5 9 5z" /></svg>
											</div>
											<div className="min-w-0">
												<div className="text-sm text-slate-600 truncate">IMC (último)</div>
												<div className="text-2xl font-semibold text-slate-800 truncate">{imcRecords && imcRecords.length ? String(imcRecords[0].bmi) : '—'}</div>
												<div className="text-xs text-slate-400">{imcRecords && imcRecords.length ? new Date(imcRecords[0].date).toLocaleDateString() : ''}</div>
											</div>
										</div>
										<div className="text-xs font-medium text-emerald-600">Ver histórico →</div>
									</div>
									<div className="text-sm text-slate-600 mt-3">IMC é calculado a partir do peso e altura informados. Atualize em IMC para registrar novos valores.</div>
								</div>

								{/* Last weight card (clickable, lively) */}
								<div role="button" tabIndex={0} aria-label="Ir para IMC" onClick={() => router.push('/imc')} onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') router.push('/imc'); }} className="dashboard-card bg-white rounded-lg p-4 transition transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4 min-w-0">
											<div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#e0e7ff,#6366f1)', color: '#fff' }} aria-hidden>
												<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
											</div>
											<div className="min-w-0">
												<div className="text-sm text-slate-600 truncate">Último peso</div>
												<div className="text-2xl font-semibold text-slate-800 truncate">{imcRecords && imcRecords.length ? String(imcRecords[0].weight) + ' kg' : '—'}</div>
												<div className="text-xs text-slate-400">{imcRecords && imcRecords.length ? new Date(imcRecords[0].date).toLocaleDateString() : ''}</div>
											</div>
										</div>
										<div className="text-xs font-medium text-indigo-600">Ver histórico →</div>
									</div>
									<div className="text-sm text-slate-600 mt-3">Registre seu peso nos exercícios ou via IMC para manter histórico.</div>
								</div>

								{/* Summary card (clickable, colorful) */}
								<div role="button" tabIndex={0} aria-label="Ir para IMC" onClick={() => router.push('/imc')} onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') router.push('/imc'); }} className="dashboard-card bg-white rounded-lg p-4 transition transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4 min-w-0">
											<div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ffe4e6,#fb7185)', color: '#fff' }} aria-hidden>
												<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v4H3z" /><path d="M5 7v13" /><path d="M19 7v13" /></svg>
											</div>
											<div className="min-w-0">
												<div className="text-sm text-slate-600 truncate">Resumo</div>
												<div className="text-2xl font-semibold text-slate-800 truncate">{totalExercises} exercícios</div>
												<div className="text-xs text-slate-400">{completedExercises} concluídos</div>
											</div>
										</div>
										<div className="text-xs font-medium text-rose-600">Ver histórico →</div>
									</div>
									<div className="text-sm text-slate-600 mt-3">Selecione um dia para ver os exercícios e começar.</div>
								</div>
							</div>
							<div className="mt-4">
								<p className="text-sm text-slate-500">Dica: adicione seu peso e altura em IMC para receber uma visão mais precisa do seu progresso.</p>
							</div>
						</div>
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

				{/* Dashboard card enhancements */}
				<style jsx global>{`
					.dashboard-card { border: 1px solid rgba(2,6,23,0.04); box-shadow: 0 6px 18px rgba(2,6,23,0.04); }
					.dashboard-card:hover { transform: translateY(-8px); box-shadow: 0 20px 50px rgba(2,6,23,0.10); }
					.dashboard-card:focus { outline: none; box-shadow: 0 12px 36px rgba(2,6,23,0.08); }
					.icon-glow { box-shadow: 0 10px 30px rgba(212,245,35,0.12); }
					@media (prefers-reduced-motion: no-preference) {
						.dashboard-card { transition: transform 260ms cubic-bezier(.16,1,.3,1), box-shadow 260ms ease; }
					}
				`}</style>

				{/* Custom Add Exercise Modal (replaces SweetAlert2 for creation) */}
				{showAddExerciseModal && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowAddExerciseModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
							<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowAddExerciseModal(false)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6l-12 12" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
							<div className="mb-3">
								<h3 className="text-lg font-semibold">Novo exercício</h3>
								<div className="text-sm text-slate-500">Selecione um exercício do catálogo e defina séries e repetições.</div>
							</div>
							<div className="space-y-3">
								<label className="block text-sm font-medium">Exercício</label>
								<div className="relative">
									<button type="button" className="w-full text-left border border-slate-200 bg-white rounded-md px-3 py-2 flex items-center justify-between" onClick={() => { setShowExerciseDropdown(v => !v); }} aria-haspopup="listbox" aria-expanded={showExerciseDropdown}>
										<span className="truncate text-sm">{(exercisesList.find(ex => String(ex.id) === String(modalExerciseId)) || {}).name || 'Selecione um exercício'}</span>
										<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
											<path d="M6 9l6 6 6-6" />
										</svg>
									</button>
									{showExerciseDropdown && (
										<div ref={exerciseDropdownRef} className="absolute left-0 mt-2 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-[48vh] overflow-auto z-50">
											<div className="p-2">
												<input ref={modalFirstRef} className="w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Buscar exercícios..." value={exerciseSearch} onChange={(e)=>setExerciseSearch(e.target.value)} onKeyDown={(e)=>{
													if (e.key === 'Enter') {
														// select first matching
														e.preventDefault();
														const first = Array.from(document.querySelectorAll('[data-exercise-item]')).find(el => el.dataset && el.dataset.id);
														if (first) { setModalExerciseId(first.dataset.id); setShowExerciseDropdown(false); }
													}
													}} />
												{isSearching ? <div className="text-sm text-slate-500 mt-2">Buscando...</div> : null}
											</div>
											{/* grouped list by target muscle (source: searchResults when available, otherwise exercisesList) */}
											{(() => {
												const q = String(exerciseSearch || '').toLowerCase().trim();
												const source = (q && searchResults) ? searchResults : exercisesList || [];
												const items = source.filter(ex => {
													if (!q) return true;
													return (String(ex.name||'')+ ' ' + String(ex.targetMuscle||'')).toLowerCase().includes(q);
												});
												const groups = items.reduce((acc, ex) => {
													const key = ex.targetMuscle || 'Outros';
													if (!acc[key]) acc[key] = [];
													acc[key].push(ex);
													return acc;
												}, {});
												return Object.keys(groups).length ? Object.keys(groups).map((g) => (
													<div key={g} className="p-2 border-t border-slate-100 last:border-b-0">
														<div className="text-xs text-slate-500 font-semibold mb-1">{g}</div>
														<ul className="space-y-1">
															{groups[g].map(ex => (
																<li key={ex.id} data-exercise-item data-id={ex.id} className="px-2 py-1 rounded hover:bg-slate-50 cursor-pointer flex items-center justify-between" onClick={() => { setModalExerciseId(String(ex.id)); setShowExerciseDropdown(false); setExerciseSearch(''); }}>
																	<div className="flex items-center gap-2 min-w-0">
																		{ex.imagePath ? <img src={ex.imagePath} alt={ex.name} className="w-8 h-8 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded bg-slate-100 flex-shrink-0" />}
																		<span className="text-sm truncate" title={ex.name}>{ex.name}</span>
																	</div>
																	{ex.targetMuscle ? <span className="text-xs text-slate-400 ml-2 whitespace-nowrap" title={ex.targetMuscle}>{ex.targetMuscle}</span> : null}
																</li>
																))}
															</ul>
														</div>
													)) : <div className="p-3 text-sm text-slate-500">Nenhum exercício encontrado.</div>;
												})()}
											</div>
										)}
								</div>
						
								{(!exercisesList || exercisesList.length === 0) && (
									<div className="text-sm text-slate-600 mt-2">Nenhum exercício disponível. Cadastre exercícios no catálogo primeiro.</div>
								)}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-sm font-medium">Séries</label>
										<input className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={modalSets} onChange={(e)=>setModalSets(e.target.value)} placeholder="Ex: 3" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddWorkout(); }} />
									</div>
									<div>
										<label className="block text-sm font-medium">Reps por série</label>
										<input className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={modalReps} onChange={(e)=>setModalReps(e.target.value)} placeholder="Ex: 8" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddWorkout(); }} />
									</div>
								</div>
								{modalError ? <div className="text-sm text-red-600 mb-2" role="alert">{modalError}</div> : null}
							</div>
							<div className="mt-4 flex justify-end">
								<button aria-label="Adicionar" title="Adicionar" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" onClick={handleConfirmAddWorkout} disabled={!modalExerciseId || modalLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>
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
				{showLogoutModal && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Sair">
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowLogoutModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
							<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowLogoutModal(false)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6l-12 12" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
							<div className="mb-3">
								<h3 className="text-lg font-semibold">Sair</h3>
								<div className="text-sm text-slate-500">Tem certeza que deseja sair da sua conta?</div>
							</div>
							{logoutModalError ? <div className="text-sm text-red-600 mt-2" role="alert">{logoutModalError}</div> : null}
							<div className="mt-4 flex justify-end">
								<button ref={logoutModalFirstRef} aria-label="Sair" title="Sair" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition bg-red-600 text-white" onClick={handleConfirmLogout} disabled={logoutModalLoading}>{logoutModalLoading ? '...' : 'Sim, sair'}</button>
							</div>
						</div>
					</div>
				)}

					{/* Add Day Modal (same layout as exercise modals) */}
					{showAddDayModal && (
						<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
							<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowAddDayModal(false); }} aria-hidden />
							<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
								<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowAddDayModal(false)}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
										<path stroke="none" d="M0 0h24v24H0z" fill="none" />
										<path d="M18 6l-12 12" />
										<path d="M6 6l12 12" />
									</svg>
								</button>
								<div className="mb-3">
									<h3 className="text-lg font-semibold">Novo dia</h3>
									<div className="text-sm text-slate-500">Crie um dia — informe nome e legenda ou informe um Template ID para usar um template.</div>
								</div>
								<div className="space-y-3">
									<label className="block text-sm font-medium">Nome</label>
									<select ref={dayFirstRef} className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={dayName} onChange={(e)=>setDayName(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddDay(); }}>
										{availableWeekDays && availableWeekDays.length ? availableWeekDays.map(d => (
											<option key={d} value={d}>{d}</option>
										)) : null}
									</select>
									{(!availableWeekDays || availableWeekDays.length === 0) && (
										<div className="text-sm text-slate-600 mt-2">Todos os dias da semana já foram adicionados.</div>
									)}
									<label className="block text-sm font-medium">Legenda</label>
									<input className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={daySubtitle} onChange={(e)=>setDaySubtitle(e.target.value)} placeholder="Ex: Biceps / Costas" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddDay(); }} />
						
									<label className="block text-sm font-medium">Template ID (opcional)</label>
									<input className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={dayTemplate} onChange={(e)=>setDayTemplate(e.target.value)} placeholder="Ex: ABC123 (deixe vazio para informar nome/legenda)" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmAddDay(); }} />
									{dayError ? <div className="text-sm text-red-600 mt-2" role="alert">{dayError}</div> : null}
								</div>
								<div className="mt-4 flex justify-end">
									<button aria-label="Adicionar" title="Adicionar" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" onClick={handleConfirmAddDay} disabled={dayLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>{dayLoading ? '...' : (
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

				{/* Edit Exercise Modal (same style as create) */}
				{showEditModal && editModalWorkout && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowEditModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
							<button aria-label="Fechar" title="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowEditModal(false)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6l-12 12" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
							<div className="mb-3">
								<h3 className="text-lg font-semibold">Editar exercício</h3>
								<div className="text-sm text-slate-500">Ajuste séries e repetições para este exercício.</div>
							</div>
							<div className="space-y-3">
								<label className="block text-sm font-medium">Exercício</label>
								<div className="w-full border border-slate-200 rounded-md px-3 py-2 bg-slate-50 text-sm">{editModalWorkout.name}</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-sm font-medium">Séries</label>
										<input ref={editModalFirstRef} className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={editModalSets} onChange={(e)=>setEditModalSets(e.target.value)} placeholder="Ex: 3" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmEditWorkout(); }} />
									</div>
									<div>
										<label className="block text-sm font-medium">Reps por série</label>
										<input className="w-full border border-slate-200 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" value={editModalReps} onChange={(e)=>setEditModalReps(e.target.value)} placeholder="Ex: 8" onKeyDown={(e)=>{ if (e.key === 'Enter') handleConfirmEditWorkout(); }} />
									</div>
								</div>
								{editModalError ? <div className="text-sm text-red-600 mt-2" role="alert">{editModalError}</div> : null}
							</div>
							<div className="mt-4 flex justify-end">
								<button aria-label="Salvar" title="Salvar" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" onClick={handleConfirmEditWorkout} disabled={editModalLoading} style={{ backgroundColor: '#d4f523', color: '#072000' }}>{editModalLoading ? '...' : (
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

				{/* Image Preview Modal (styled like other modals) */}
				{showImageModal && (
					<div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label={imageModalTitle || 'Visualizador de imagem'}>
						<div className="absolute inset-0 bg-black/40" onClick={(e)=>{ if (e.target === e.currentTarget) setShowImageModal(false); }} aria-hidden />
						<div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-4 modal-pop mx-4" style={{ zIndex: 10000, position: 'relative' }}>
							<button ref={imageModalCloseRef} className="absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-slate-50" onClick={()=>setShowImageModal(false)} aria-label="Fechar visualizador">
								<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<path stroke="none" d="M0 0h24v24H0z" fill="none" />
									<path d="M18 6l-12 12" />
									<path d="M6 6l12 12" />
								</svg>
							</button>
							<div className="mb-3">
								<h3 className="text-lg font-semibold">{imageModalTitle || 'Imagem'}</h3>
								<div className="text-sm text-slate-500">Visualização do exercício</div>
							</div>
							<div className="flex flex-col md:flex-row gap-4 items-start">
								<div className="flex-1 flex items-center justify-center max-h-[70vh] overflow-hidden bg-slate-50 rounded">
									<img src={imageModalSrc} alt={imageModalTitle} className="max-h-[70vh] w-auto max-w-full object-contain" />
								</div>
								<div className="md:w-72">
									<div className="text-sm text-slate-600">Use os botões abaixo para abrir em nova aba ou baixar a imagem.</div>
									<div className="mt-4 flex flex-col gap-2">
										<a aria-label="Abrir em nova aba" title="Abrir em nova aba" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 bg-white text-sm" href={imageModalSrc} target="_blank" rel="noreferrer">
											Abrir em nova aba
										</a>
										<a aria-label="Baixar imagem" title="Baixar" className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold shadow-sm hover:shadow-md transition" href={imageModalSrc} download style={{ backgroundColor: '#d4f523', color: '#072000' }}>
											Baixar imagem
										</a>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
		</div>
	)
}



