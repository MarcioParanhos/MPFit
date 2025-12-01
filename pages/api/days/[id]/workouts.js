const db = require('../../../../lib/db');
const { requireAuth } = require('../../../../lib/auth');

export default async function handler(req, res) {
  const { id } = req.query;
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (req.method === 'GET') {
    try { const w = await db.getWorkoutsByDay(id, user.id); return res.status(200).json(w); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { name, plannedSets, plannedReps, youtube } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try { const wk = await db.addWorkout(id, { name, plannedSets, plannedReps, youtube }, user.id); return res.status(201).json(wk); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
