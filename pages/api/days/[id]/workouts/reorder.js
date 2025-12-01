const db = require('../../../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'POST') {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
    try { const ok = await db.updateWorkoutPositions(id, orderedIds); if (!ok) return res.status(404).json({ error: 'day not found or no changes' }); return res.status(200).json({ success: true }); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
