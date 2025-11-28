const db = require('../../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'POST') {
    const { completed } = req.body;
    if (typeof completed === 'undefined') return res.status(400).json({ error: 'completed required' });
    const w = db.setCompleted(id, completed);
    if (!w) return res.status(404).json({ error: 'workout not found' });
    return res.status(200).json(w);
  }
  res.status(405).end();
}
