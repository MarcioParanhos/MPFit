const db = require('../../../lib/db');

export default function handler(req, res) {
  if (req.method === 'GET') {
    const days = db.getDays();
    return res.status(200).json(days);
  }
  if (req.method === 'POST') {
    const { name, subtitle } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!subtitle || String(subtitle).trim() === '') return res.status(400).json({ error: 'subtitle required' });
    const day = db.addDay(name.trim(), String(subtitle).trim());
    return res.status(201).json(day);
  }
  res.status(405).end();
}
