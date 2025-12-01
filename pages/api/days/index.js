const db = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (req.method === 'GET') {
    try { const days = await db.getDays(user.id); return res.status(200).json(days); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  if (req.method === 'POST') {
    const { name, subtitle, templateCode } = req.body;
    // If templateCode provided, attempt to copy template
    if (templateCode && String(templateCode).trim() !== '') {
      try {
        const copied = await db.copyDayByShareCode(String(templateCode).trim(), user.id);
        if (!copied) return res.status(404).json({ error: 'template not found' });
        return res.status(201).json(copied);
      } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
    }
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!subtitle || String(subtitle).trim() === '') return res.status(400).json({ error: 'subtitle required' });
    try { const day = await db.addDay(name.trim(), String(subtitle).trim(), user.id); return res.status(201).json(day); } catch (e) { console.error(e); return res.status(500).json({ error: String(e && e.message ? e.message : e) }); }
  }
  res.status(405).end();
}
