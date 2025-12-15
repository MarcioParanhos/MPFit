import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data && data.error ? data.error : 'Erro ao autenticar');
        setLoading(false);
        return;
      }
      if (data.admin) {
        router.push('/admin');
      } else {
        router.push('/app');
      }
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/images/TRANINGHUB.svg" alt="TrainHub" className="h-36 mb-4" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <input
                className="mt-1 block w-full border border-slate-200 rounded-lg p-3 pl-10 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="seu@email.com"
                required
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-3 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h16v16H4z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <div className="relative">
              <input
                className="mt-1 block w-full border border-slate-200 rounded-lg p-3 pl-10 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-3 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-60" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <a href="/register" className="text-indigo-600 font-medium">Criar conta</a>
          <a href="#" className="text-slate-500">Esqueceu a senha?</a>
        </div>
      </div>
    </div>
  );
}
