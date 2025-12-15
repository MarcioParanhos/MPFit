const db = require('../../../../lib/db');

export default async function handler(req, res){
  const { id } = req.query;
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  try {
    const body = req.body || {};
    if (body && body.cancel) {
      const day = await db.cancelStart(id);
      if (!day) return res.status(404).json({ error: 'day not found' });
      return res.status(200).json(day);
    }
    const day = await db.startDay(id);
    if (!day) return res.status(404).json({ error: 'day not found' });
    return res.status(200).json(day);
  } catch (err) {
    console.error('Error in /api/days/[id]/start:', err && err.stack ? err.stack : err);
    try { return res.status(500).json({ error: String(err && err.message ? err.message : err) }); } catch (e) { return res.status(500).end(); }
  }
}
