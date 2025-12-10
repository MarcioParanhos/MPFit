const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (req.method === 'GET') {
    try {
      const search = req.query && req.query.search ? String(req.query.search) : null;
      const ex = await db.getExercises(search);
      return res.status(200).json(ex);
    } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { name, targetMuscle, equipment, imagePath, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const e = await db.addExercise({ name, targetMuscle, equipment, imagePath, description });
      return res.status(201).json(e);
    } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
