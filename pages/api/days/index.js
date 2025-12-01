const db = require('../../../lib/db');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try { const days = await db.getDays(); return res.status(200).json(days); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { name, subtitle } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!subtitle || String(subtitle).trim() === '') return res.status(400).json({ error: 'subtitle required' });
    try { const day = await db.addDay(name.trim(), String(subtitle).trim()); return res.status(201).json(day); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
