const db = require('../../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    try { const wk = await db.getWorkout(id); if (!wk) return res.status(404).json({ error: 'workout not found' }); return res.status(200).json({ currentWeight: wk.currentWeight || null }); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { weight } = req.body;
    try { const updated = await db.setCurrentWeight(id, weight === undefined ? null : weight); if (!updated) return res.status(404).json({ error: 'workout not found' }); return res.status(200).json(updated); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
