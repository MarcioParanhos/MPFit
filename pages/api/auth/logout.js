const { clearTokenCookie } = require('../../../lib/auth');

export default function handler(req, res){
  clearTokenCookie(res);
  return res.status(200).json({ ok: true });
}
