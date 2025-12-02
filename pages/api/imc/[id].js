const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'DELETE') {
    try{
      const ok = await db.deleteImcRecord(id, user.id);
      if (!ok) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ ok: true });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'failed' }); }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
