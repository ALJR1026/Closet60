// Zero-dependency password hashing (scrypt) and signed-token (HMAC) helpers.
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const testBuf = crypto.scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, testBuf);
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function signToken(payload, secret, expiresInSec = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const headerB64 = b64url(Buffer.from(JSON.stringify(header)));
  const bodyB64 = b64url(Buffer.from(JSON.stringify(body)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest());
  return `${headerB64}.${bodyB64}.${sig}`;
}

function verifyToken(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerB64, bodyB64, sig] = parts;
  const expectedSig = b64url(crypto.createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(b64urlDecode(bodyB64).toString('utf8'));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
