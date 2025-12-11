const { requireAuth, getTokenFromReq, verifyToken } = require('../../../lib/auth');
const db = require('../../../lib/db');

export default async function handler(req, res) {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  const token = getTokenFromReq(req);
  const tokenPayload = token ? verifyToken(token) : null;
  const user = await requireAuth(req, res, db);
  return res.status(200).json({ tokenPresent: !!token, tokenPayload, dbUser: user });
}
