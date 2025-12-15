import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

function getInitials(nameOrEmail){
	if (!nameOrEmail) return '';
	const s = String(nameOrEmail).trim();
	const parts = s.split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
}

export default function AdminPanel(){
	const router = useRouter();
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [openMenu, setOpenMenu] = useState(false);
	const menuRef = useRef(null);

	// off-canvas / mobile menu (reuse app patterns)
	const [offCanvasOpen, setOffCanvasOpen] = useState(false);
	const offCanvasRef = useRef(null);
	const [offcanvasUserDropdownOpen, setOffcanvasUserDropdownOpen] = useState(false);
	const offcanvasUserDropdownRef = useRef(null);

	const [form, setForm] = useState({ name: '', targetMuscle: '', equipment: '', description: '', image: null });
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [exercises, setExercises] = useState([]);
	const [loadingExercises, setLoadingExercises] = useState(true);
	const [editExercise, setEditExercise] = useState(null);
	const [editForm, setEditForm] = useState(null);
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 10;
	const [createLoading, setCreateLoading] = useState(false);
	const [editLoading, setEditLoading] = useState(false);

	useEffect(()=>{
		async function check(){
			try{
				const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
				if (!res.ok) return router.replace('/login');
				const me = await res.json();
				if (!me.admin) return router.replace('/app');
				setUser(me);
			}catch(e){
				router.replace('/login');
			}finally{ setLoading(false); }
		}
		check();
		fetchExercises();
	},[]);

	// close offcanvas when clicking outside or pressing Escape (mobile menu)
	useEffect(()=>{
		function onDoc(e){ if (!offCanvasRef.current) return; if (!offCanvasRef.current.contains(e.target)) setOffCanvasOpen(false); }
		function onKey(e){ if (e.key === 'Escape') setOffCanvasOpen(false); }
		if (offCanvasOpen) {
			document.addEventListener('mousedown', onDoc);
			document.addEventListener('touchstart', onDoc);
			document.addEventListener('keydown', onKey);
		}
		return ()=>{
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('touchstart', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	},[offCanvasOpen]);

	async function fetchExercises(){
		setLoadingExercises(true);
		try{
			const res = await fetch('/api/exercises', { credentials: 'same-origin' });
			if (!res.ok) { setExercises([]); return; }
			const data = await res.json(); setExercises(Array.isArray(data)?data:[]);
		}catch(e){ setExercises([]); }finally{ setLoadingExercises(false); }
	}

	useEffect(()=>{
		function onDoc(e){ if (!menuRef.current) return; if (!menuRef.current.contains(e.target)) setOpenMenu(false); }
		if (openMenu) document.addEventListener('mousedown', onDoc);
		return ()=> document.removeEventListener('mousedown', onDoc);
	},[openMenu]);

	async function handleLogout(){
		try{ await fetch('/api/auth/logout', { method: 'POST' }); } catch(e){}
		router.replace('/login');
	}

	async function handleSubmit(e){
		e.preventDefault(); setError(''); setSuccess('');
		console.log('[admin] handleSubmit called', { name: form.name, hasImage: !!form.image });
		setCreateLoading(true);
		if (!form.name) { setCreateLoading(false); return setError('Nome obrigatório'); }
		if (!form.image) { setCreateLoading(false); return setError('GIF obrigatório'); }
		try{
			const reader = new FileReader();
			reader.onloadend = async ()=>{
				console.log('[admin] file reader loaded, size:', reader.result ? reader.result.length : 0);
				const imageBase64 = reader.result;
				try{
					console.log('[admin] sending create request to /api/admin/exercises');
					const res = await fetch('/api/admin/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, targetMuscle: form.targetMuscle, equipment: form.equipment, description: form.description, imageBase64 }), credentials: 'same-origin' });
					let data = null;
					try{ data = await res.json(); } catch(err){ console.warn('[admin] response json parse failed', err); }
					console.log('[admin] create response', res.status, data);
					if (!res.ok) {
						setCreateLoading(false);
						console.error('[admin] create API error', data);
						return setError(data && data.error ? data.error : `Erro ao criar exercício (status ${res.status})`);
					}
					setSuccess('Exercício criado com sucesso');
					setForm({ name: '', targetMuscle: '', equipment: '', description: '', image: null });
					await fetchExercises();
					setCreateLoading(false);
				} catch(err){
					console.error('[admin] exception sending create request', err);
					setCreateLoading(false);
					setError('Erro ao criar exercício (request falhou)');
				}
			};
			reader.onerror = ()=>{
				console.error('[admin] FileReader error', reader.error);
				setCreateLoading(false);
				setError('Erro ao ler arquivo');
			};
			reader.readAsDataURL(form.image);
		}catch(e){ setError('Erro ao criar exercício'); }
	}

	async function openEdit(ex){
		setEditExercise(ex);
		setEditForm({ id: ex.id, name: ex.name||'', targetMuscle: ex.targetMuscle||'', equipment: ex.equipment||'', description: ex.description||'', image: null });
	}

	async function handleSaveEdit(e){
		e.preventDefault();
		if (!editForm || !editForm.id) return;
		setError('');
		setEditLoading(true);
		try{
			let body = { name: editForm.name, targetMuscle: editForm.targetMuscle, equipment: editForm.equipment, description: editForm.description };
			if (editForm.image) {
				const reader = new FileReader();
				reader.onloadend = async ()=>{
					body.imageBase64 = reader.result;
					const res = await fetch(`/api/exercises/${editForm.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
					const data = await res.json();
					if (!res.ok) return setError(data.error || 'Erro ao atualizar');
					setEditExercise(null); setEditForm(null); await fetchExercises();
					setEditLoading(false);
				};
				reader.readAsDataURL(editForm.image);
			} else {
				const res = await fetch(`/api/exercises/${editForm.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
				const data = await res.json();
				if (!res.ok) return setError(data.error || 'Erro ao atualizar');
				setEditExercise(null); setEditForm(null); await fetchExercises();
				setEditLoading(false);
			}
		}catch(e){ setError('Erro ao atualizar'); }
	}

	async function handleDelete(id){
		if (!confirm('Confirmar exclusão do exercício?')) return;
		try{
			const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE', credentials: 'same-origin' });
			if (!res.ok) { const d = await res.json().catch(()=>({})); return alert(d.error||'Erro ao excluir'); }
			await fetchExercises();
		}catch(e){ alert('Erro ao excluir'); }
	}

	if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

	const filteredExercises = exercises.filter(ex => {
		const q = String(search||'').trim().toLowerCase();
		if (!q) return true;
		return (ex.name||'').toLowerCase().includes(q) || (ex.targetMuscle||'').toLowerCase().includes(q) || (ex.equipment||'').toLowerCase().includes(q);
	});
	const totalPages = Math.max(1, Math.ceil(filteredExercises.length / PAGE_SIZE));
	const pageExercises = filteredExercises.slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE);

	return (
		<div className="min-h-screen bg-slate-50">
            

			<main className="p-6 lg:pt-16 max-w-5xl mx-auto">
				<div className="bg-white rounded-lg shadow p-6">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h1 className="text-2xl font-semibold">Painel Administrativo</h1>
							<div className="text-sm text-slate-500">Crie e gerencie exercícios que outros usuários poderão usar</div>
						</div>
					</div>

					<section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded border">
							<div>
								<label className="block mb-1 font-medium">Nome</label>
								<input className="w-full border rounded px-3 py-2" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
							</div>
							<div>
								<label className="block mb-1 font-medium">Grupo muscular</label>
								<input className="w-full border rounded px-3 py-2" value={form.targetMuscle} onChange={e=>setForm(f=>({...f,targetMuscle:e.target.value}))} />
							</div>
							<div>
								<label className="block mb-1 font-medium">Equipamento</label>
								<input className="w-full border rounded px-3 py-2" value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))} />
							</div>
							<div>
								<label className="block mb-1 font-medium">Descrição</label>
								<textarea className="w-full border rounded px-3 py-2" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
							</div>
							<div>
								<label className="block mb-1 font-medium">GIF</label>
								<input type="file" accept="image/gif" onChange={e=>setForm(f=>({...f,image:e.target.files[0]}))} disabled={createLoading} />
								<div className="text-xs text-slate-500 mt-1">Use um GIF curto (dev only: será salvo em <code>/public/images/exercises/</code>).</div>
							</div>
							{error && <div className="text-rose-600">{error}</div>}
							{success && <div className="text-emerald-600">{success}</div>}
							<div className="flex items-center gap-2 justify-end">
								<button type="button" className="px-3 py-2 rounded border" onClick={()=>setForm({ name: '', targetMuscle: '', equipment: '', description: '', image: null })} disabled={createLoading}>Limpar</button>
								<button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white flex items-center gap-2" disabled={createLoading} aria-busy={createLoading}>
									{createLoading ? (
										<>
											<svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24">
												<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
												<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
											</svg>
										<span>Criando...</span>
									</>
									) : 'Criar exercício'}
								</button>
							</div>
						</form>

						<div>
							<h3 className="font-semibold mb-2">Pré-visualização</h3>
							<div className="border rounded p-4 bg-slate-50">
								<div className="text-sm text-slate-600 mb-2">Campos atuais</div>
								<div className="text-sm"><strong>Nome:</strong> {form.name || '-'}</div>
								<div className="text-sm"><strong>Grupo:</strong> {form.targetMuscle || '-'}</div>
								<div className="text-sm"><strong>Equipamento:</strong> {form.equipment || '-'}</div>
								<div className="text-sm mt-2"><strong>Descrição:</strong>
									<div className="text-sm text-slate-700 mt-1">{form.description || '-'}</div>
								</div>
								<div className="mt-4">
									{form.image ? (
										<div className="text-sm">Arquivo: <span className="inline-block max-w-[160px] sm:max-w-xs truncate align-middle" title={form.image.name}>{form.image.name}</span></div>
									) : (
										<div className="text-sm text-slate-500">Nenhum GIF selecionado</div>
									)}
								</div>
							</div>
						</div>
					</section>
				</div>

				{/* Exercises list */}
				<div className="mt-6 bg-white rounded-lg shadow p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold">Exercícios</h2>
						<div className="text-sm text-slate-500">Total: {exercises.length}</div>
					</div>
					{loadingExercises ? (
						<div className="space-y-3">
							{[...Array(6)].map((_,i)=> (
								<div key={i} className="flex items-center justify-between border rounded p-3 animate-pulse">
									<div className="flex items-center gap-4">
										<div className="w-16 h-16 bg-slate-200 rounded" />
										<div>
											<div className="h-4 bg-slate-200 rounded w-40 mb-2" />
											<div className="h-3 bg-slate-200 rounded w-28" />
										</div>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-8 w-20 bg-slate-200 rounded" />
										<div className="h-8 w-20 bg-slate-200 rounded" />
									</div>
								</div>
							))}
						</div>
					) : (
						<>
							<div className="mb-3 flex items-center gap-3">
								<input className="flex-1 border rounded px-3 py-2" placeholder="Buscar por nome, músculo ou equipamento" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
								<div className="text-sm text-slate-500">{filteredExercises.length} resultados</div>
							</div>
							<div className="space-y-3 max-h-[480px] overflow-auto">
								{pageExercises.map(ex => (
									<div key={ex.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded p-3">
										<div className="flex items-center gap-4 w-full sm:w-auto">
											{ex.imagePath ? <img src={ex.imagePath} alt={ex.name} className="w-16 h-16 object-cover rounded" /> : <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center text-sm">No GIF</div>}
											<div>
												<div className="font-semibold">{ex.name}</div>
												<div className="text-sm text-slate-500">{ex.targetMuscle || '-'} · {ex.equipment || '-'}</div>
											</div>
										</div>
										<div className="mt-3 sm:mt-0 flex items-center gap-2 w-full sm:w-auto">
											<button className="px-3 py-1 text-sm rounded border w-full sm:w-auto" onClick={()=>openEdit(ex)} disabled={editLoading}> {editLoading && editExercise && editExercise.id===ex.id ? '...':'Editar'}</button>
											<button className="px-3 py-1 text-sm rounded border text-rose-600 w-full sm:w-auto" onClick={()=>handleDelete(ex.id)} disabled={editLoading}>Excluir</button>
										</div>
									</div>
								))}
							</div>
							{/* pagination */}
							<div className="mt-4 flex items-center justify-between">
								<div className="text-sm text-slate-500">Página {page} / {totalPages}</div>
								<div className="flex items-center gap-2">
									<button className="px-3 py-1 rounded border" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
									<button className="px-3 py-1 rounded border" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Próxima</button>
								</div>
							</div>
						</>
					)}
				</div>

				{/* Edit modal */}
					{editExercise && editForm && (
						<div className="fixed inset-0 z-[9998] flex items-center justify-center" role="dialog" aria-modal="true">
							<div className="absolute inset-0 bg-black/40 z-[9997]" onClick={()=>{ setEditExercise(null); setEditForm(null); }} aria-hidden />
							<div className="bg-white rounded-lg shadow p-6 z-[9999] max-w-xl w-full mx-4 relative">
							<h3 className="text-lg font-semibold mb-3">Editar exercício</h3>
							<form onSubmit={handleSaveEdit} className="space-y-3">
								<div>
									<label className="block mb-1 font-medium">Nome</label>
									<input className="w-full border rounded px-3 py-2" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} />
								</div>
								<div>
									<label className="block mb-1 font-medium">Grupo muscular</label>
									<input className="w-full border rounded px-3 py-2" value={editForm.targetMuscle} onChange={e=>setEditForm(f=>({...f,targetMuscle:e.target.value}))} />
								</div>
								<div>
									<label className="block mb-1 font-medium">Equipamento</label>
									<input className="w-full border rounded px-3 py-2" value={editForm.equipment} onChange={e=>setEditForm(f=>({...f,equipment:e.target.value}))} />
								</div>
								<div>
									<label className="block mb-1 font-medium">Descrição</label>
									<textarea className="w-full border rounded px-3 py-2" value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} />
								</div>
								<div>
									<label className="block mb-1 font-medium">GIF (opcional)</label>
									<input type="file" accept="image/gif" onChange={e=>setEditForm(f=>({...f,image:e.target.files[0]}))} />
								</div>
								<div className="flex items-center gap-2 justify-end">
									<button type="button" className="px-3 py-2 rounded border" onClick={()=>{ setEditExercise(null); setEditForm(null); }}>Cancelar</button>
									<button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">Salvar</button>
								</div>
							</form>
						</div>
					</div>
				)}

			</main>
		</div>
	);
}
