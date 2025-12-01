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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data && data.error ? data.error : 'Erro ao autenticar');
        setLoading(false);
        return;
      }
      // On success the server sets an HttpOnly cookie; redirect to app
      router.push('/app');
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <div className="flex items-center justify-center mb-4">
          <img src="/images/TRAINHUB.png" alt="TrainHub" className="h-12" />
        </div>
        <h1 className="text-2xl font-semibold mb-4 text-center">Entrar</h1>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">
            <span className="text-sm">Email</span>
            <input className="mt-1 block w-full border rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="block mb-4">
            <span className="text-sm">Senha</span>
            <input className="mt-1 block w-full border rounded p-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 px-4 bg-blue-600 text-white rounded" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="mt-4 text-sm">
          Não tem conta? <a className="text-blue-600" href="/register">Cadastre-se</a>
        </div>
      </div>
    </div>
  );
}
