import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  function doLogin(e) {
    e && e.preventDefault();
    // fake login: always succeed and redirect to /app
    router.push('/app');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow px-6 py-8">
        <h1 className="text-2xl font-bold mb-4">MPFit</h1>
        <p className="text-sm text-slate-500 mb-4">Faça login para acessar seus dias e exercícios (fake).</p>
        <form onSubmit={doLogin} className="space-y-3">
          <input className="input w-full" placeholder="Usuário" value={user} onChange={e=>setUser(e.target.value)} />
          <input className="input w-full" placeholder="Senha" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          <div className="flex items-center justify-between">
            <button className="btn w-full" onClick={doLogin} type="submit">Acessar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
