const db = require('../../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    const logs = db.getLogsByWorkout(id);
    return res.status(200).json(logs);
  }
  if (req.method === 'POST') {
    const { series, reps, weight, date } = req.body;
    if (weight === undefined) return res.status(400).json({ error: 'weight required' });
    const l = db.addLog(id, { series, reps, weight, date });
    return res.status(201).json(l);
  }
  res.status(405).end();
}
