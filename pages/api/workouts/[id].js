const db = require('../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'DELETE') {
    try { const ok = await db.deleteWorkout(id); if (!ok) return res.status(404).json({ error: 'workout not found' }); return res.status(200).json({ success: true }); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { name, plannedSets, plannedReps, youtube } = req.body || {};
    try {
      const updated = await db.updateWorkout(id, { name, plannedSets, plannedReps, youtube });
      if (!updated) return res.status(404).json({ error: 'workout not found' });
      return res.status(200).json(updated);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e && e.message ? e.message : e) });
    }
  }
  res.status(405).end();
}
