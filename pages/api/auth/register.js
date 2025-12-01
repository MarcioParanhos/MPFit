const db = require('../../../lib/db');
const bcrypt = require('bcryptjs');
const { setTokenCookie } = require('../../../lib/auth');

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).end();
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  try{
    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(name, email, hash);
    setTokenCookie(res, { id: user.id, email: user.email, name: user.name });
    return res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (e){ console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
}
