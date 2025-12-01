const db = require('../../../lib/db');
const bcrypt = require('bcryptjs');
const { setTokenCookie } = require('../../../lib/auth');

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try{
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash || user.password_hash || user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    setTokenCookie(res, { id: user.id, email: user.email, name: user.name || null });
    return res.status(200).json({ id: user.id, email: user.email, name: user.name || null });
  } catch (e){ console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
}
