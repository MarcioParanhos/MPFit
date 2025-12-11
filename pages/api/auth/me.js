const { requireAuth } = require('../../../lib/auth');
const db = require('../../../lib/db');

export default async function handler(req, res) {
  const user = await requireAuth(req, res, db);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  return res.status(200).json({ id: user.id, email: user.email, name: user.name || null, admin: !!user.admin });
}
