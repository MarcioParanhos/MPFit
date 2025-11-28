const db = require('../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'DELETE') {
    const ok = db.deleteWorkout(id);
    if (!ok) return res.status(404).json({ error: 'workout not found' });
    return res.status(200).json({ success: true });
  }
  res.status(405).end();
}
