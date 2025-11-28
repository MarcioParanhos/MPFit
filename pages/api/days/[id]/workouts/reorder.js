const db = require('../../../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'POST') {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
    const ok = db.updateWorkoutPositions(id, orderedIds);
    if (!ok) return res.status(404).json({ error: 'day not found or no changes' });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
