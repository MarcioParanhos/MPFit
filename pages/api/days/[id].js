const db = require('../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'DELETE') {
    try { const ok = await db.deleteDay(id); if (!ok) return res.status(404).json({ error: 'day not found' }); return res.status(204).end(); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
