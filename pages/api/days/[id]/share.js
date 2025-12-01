const db = require('../../../../lib/db');
const { requireAuth } = require('../../../../lib/auth');

function cleanPart(s, maxLen=3) {
  if (!s) return 'XXX';
  const t = String(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
  return t.slice(0, maxLen).padEnd(maxLen, 'X');
}

function makeReadableCode(user, day) {
  // Format: OWNERPREFIX<dayId>-DAYPREFIX<rndDigit>
  const owner = user && (user.name || user.email) ? user.name || user.email.split('@')[0] : 'USR';
  const ownerPart = cleanPart(owner, 3);
  const dayPart = cleanPart(day && day.name ? day.name : String(day && day.id || ''), 3);
  const rnd = Math.floor(Math.random() * 9) + 1; // 1-9
  return `${ownerPart}${day.id}-${dayPart}${rnd}`;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (req.method === 'POST') {
    try {
      const day = await db.getDayById(id);
      if (!day) return res.status(404).json({ error: 'day not found' });
      if (Number(day.userId) !== Number(user.id)) return res.status(403).json({ error: 'forbidden' });
      // retry few times to avoid collisions
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeReadableCode(user, day);
        const updated = await db.setDayShareCode(id, code, user.id);
        if (updated) return res.status(200).json({ shareCode: code });
      }
      return res.status(500).json({ error: 'failed to create share code' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e && e.message ? e.message : e) });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const day = await db.getDayById(id);
      if (!day) return res.status(404).json({ error: 'day not found' });
      if (Number(day.userId) !== Number(user.id)) return res.status(403).json({ error: 'forbidden' });
      const updated = await db.setDayShareCode(id, null, user.id);
      if (!updated) return res.status(500).json({ error: 'failed to revoke' });
      return res.status(200).json({ revoked: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e && e.message ? e.message : e) });
    }
  }

  res.setHeader('Allow','POST,DELETE');
  return res.status(405).end();
}
