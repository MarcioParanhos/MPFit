const db = require('../../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    const w = db.getWorkoutsByDay(id);
    return res.status(200).json(w);
  }
  if (req.method === 'POST') {
    const { name, plannedSets, plannedReps, youtube } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const wk = db.addWorkout(id, { name, plannedSets, plannedReps, youtube });
    return res.status(201).json(wk);
  }
  res.status(405).end();
}
