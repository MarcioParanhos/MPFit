const db = require('../../../lib/db');

export default function handler(req, res) {
  if (req.method === 'GET') {
    const days = db.getDays();
    return res.status(200).json(days);
  }
  if (req.method === 'POST') {
    const { name, subtitle } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const day = db.addDay(name, subtitle);
    return res.status(201).json(day);
  }
  res.status(405).end();
}
