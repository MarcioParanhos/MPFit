const db = require('../../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'POST') {
    const { completed } = req.body;
    if (typeof completed === 'undefined') return res.status(400).json({ error: 'completed required' });
    try { const w = await db.setCompleted(id, completed); if (!w) return res.status(404).json({ error: 'workout not found' }); return res.status(200).json(w); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
