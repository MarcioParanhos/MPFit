const db = require('../../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    const wk = db.getWorkout(id);
    if (!wk) return res.status(404).json({ error: 'workout not found' });
    return res.status(200).json({ currentWeight: wk.currentWeight || null });
  }
  if (req.method === 'POST') {
    const { weight } = req.body;
    // Accept null to clear
    const updated = db.setCurrentWeight(id, weight === undefined ? null : weight);
    if (!updated) return res.status(404).json({ error: 'workout not found' });
    return res.status(200).json(updated);
  }
  res.status(405).end();
}
