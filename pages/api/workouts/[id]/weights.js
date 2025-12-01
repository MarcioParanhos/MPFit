const db = require('../../../../lib/db');

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    try { const logs = await db.getLogsByWorkout(id); return res.status(200).json(logs); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { series, reps, weight, date } = req.body;
    if (weight === undefined) return res.status(400).json({ error: 'weight required' });
    try { const l = await db.addLog(id, { series, reps, weight, date }); return res.status(201).json(l); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
