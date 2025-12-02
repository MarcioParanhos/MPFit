const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'GET') {
    const records = await db.getImcRecords(user.id);
    return res.status(200).json(records);
  }

  if (req.method === 'POST') {
    const { weight, height, bmi, date } = req.body || {};
    if (!weight || !height || !bmi) return res.status(400).json({ error: 'weight,height,bmi required' });
    try{
      const rec = await db.addImcRecord(user.id, { weight, height, bmi, date });
      return res.status(201).json(rec);
    }catch(e){ console.error(e); return res.status(500).json({ error: 'failed' }); }
  }

  if (req.method === 'DELETE') {
    // clear all records for user
    try{
      await db.clearImcRecords(user.id);
      return res.status(200).json({ ok: true });
    }catch(e){ console.error(e); return res.status(500).json({ error: 'failed' }); }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
