const db = require('../../../../lib/db');

export default function handler(req, res){
  const { id } = req.query;
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  const ok = db.completeDay(id);
  if (!ok) return res.status(404).json({ error: 'day not found' });
  return res.status(200).json({ ok: true });
}
