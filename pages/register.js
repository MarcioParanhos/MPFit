import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data && data.error ? data.error : 'Erro ao registrar');
        setLoading(false);
        return;
      }
      router.push('/app');
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h1 className="text-2xl font-semibold mb-4">Cadastrar</h1>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">
            <span className="text-sm">Nome</span>
            <input className="mt-1 block w-full border rounded p-2" value={name} onChange={(e) => setName(e.target.value)} type="text" required />
          </label>
          <label className="block mb-2">
            <span className="text-sm">Email</span>
            <input className="mt-1 block w-full border rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="block mb-4">
            <span className="text-sm">Senha</span>
            <input className="mt-1 block w-full border rounded p-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <button className="w-full py-2 px-4 bg-green-600 text-white rounded" type="submit" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar'}</button>
        </form>
        <div className="mt-4 text-sm">
          Já tem conta? <a className="text-blue-600" href="/login">Entrar</a>
        </div>
      </div>
    </div>
  );
}
