// Ensures an admin account always exists — used on every server boot.
// Locally this is a no-op (the admin from `npm run seed` is already there).
// On a fresh host (Render, Railway, etc.) with an empty database, this
// creates one automatically and prints the credentials to the process logs
// exactly once, so there's no need for shell/SSH access on the host.

const crypto = require('crypto');
const { hashPassword } = require('./auth');

function generatePassword() {
  const raw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
  return `Cl60-${raw.slice(0, 10)}!`;
}

function ensureAdmin(db, save) {
  const hasAdmin = db.users.some(u => u.role === 'admin');
  if (hasAdmin) return null;

  const email = 'admin@closet60.in';
  const password = generatePassword();
  db.users.push({
    id: 'admin-' + Date.now(),
    name: 'Closet60 Admin',
    email,
    phone: '',
    passwordHash: hashPassword(password),
    role: 'admin'
  });
  save(db);
  return { email, password };
}

module.exports = { ensureAdmin, generatePassword };
