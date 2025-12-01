const db = require('../../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    try { const w = await db.getWorkoutsByDay(id); return res.status(200).json(w); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { name, plannedSets, plannedReps, youtube } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try { const wk = await db.addWorkout(id, { name, plannedSets, plannedReps, youtube }); return res.status(201).json(wk); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
