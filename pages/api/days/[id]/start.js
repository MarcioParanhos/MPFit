const db = require('../../../../lib/db');

export default function handler(req, res){
  const { id } = req.query;
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  try {
    const day = db.startDay(id);
    if (!day) return res.status(404).json({ error: 'day not found' });
    return res.status(200).json(day);
  } catch (err) {
    // ensure we always return JSON and a helpful message
    console.error('Error in /api/days/[id]/start:', err && err.stack ? err.stack : err);
    // try to return partial day if available
    try { return res.status(500).json({ error: String(err && err.message ? err.message : err) }); } catch (e) { return res.status(500).end(); }
  }
}
