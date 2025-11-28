const db = require('../../../lib/db');

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'DELETE') {
    const ok = db.deleteDay(id);
    if (!ok) return res.status(404).json({ error: 'day not found' });
    return res.status(204).end();
  }
  res.status(405).end();
}
