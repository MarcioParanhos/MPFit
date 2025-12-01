const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'mpfit_token';
const SECRET = process.env.JWT_SECRET || 'mpfit_dev_secret_change_me';
const TOKEN_EXPIRES_IN = '7d';

function signToken(payload){
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

function verifyToken(token){
  try{ return jwt.verify(token, SECRET); } catch (e) { return null; }
}

function setTokenCookie(res, payload){
  const token = signToken(payload);
  // set httpOnly cookie
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${7*24*3600}; SameSite=Strict`);
}

function clearTokenCookie(res){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`);
}

function getTokenFromReq(req){
  const cookie = req.headers.cookie || '';
  const match = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='));
  if (!match) return null;
  const token = match.split('=')[1];
  return token;
}

async function requireAuth(req, res, db){
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  // optionally load user from db
  if (db && db.getUserById) {
    try{ const u = await db.getUserById(payload.id); return u; } catch(e){ return null; }
  }
  return payload;
}

module.exports = { COOKIE_NAME, signToken, verifyToken, setTokenCookie, clearTokenCookie, getTokenFromReq, requireAuth };
