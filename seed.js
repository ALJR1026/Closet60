// Creates (or resets, with --force) the Closet60 admin account.
// Run: npm run seed        (creates if missing)
//      npm run seed -- --force   (resets password even if admin exists)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('./lib/auth');
const { load, save } = require('./lib/db');

const FORCE = process.argv.includes('--force');
const ADMIN_EMAIL = 'admin@closet60.in';

function generatePassword() {
  const raw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
  return `Cl60-${raw.slice(0, 10)}!`;
}

(async () => {
  const db = await load();
  const existing = db.users.find(u => u.role === 'admin');

  if (existing && !FORCE) {
    console.log('An admin account already exists:', existing.email);
    console.log('Run "npm run seed -- --force" to reset its password.');
    process.exit(0);
  }

  const password = generatePassword();
  const passwordHash = hashPassword(password);

  db.users = db.users.filter(u => u.role !== 'admin');
  db.users.push({
    id: 'admin-' + Date.now(),
    name: 'Closet60 Admin',
    email: ADMIN_EMAIL,
    phone: '',
    passwordHash,
    role: 'admin'
  });
  await save(db);

  const credsPath = path.join(__dirname, 'admin-credentials.txt');
  fs.writeFileSync(
    credsPath,
    `Closet60 Admin Login\n---------------------\nURL:      http://localhost:3000/login.html\nEmail:    ${ADMIN_EMAIL}\nPassword: ${password}\n\nChange this password after your first login. This file is generated locally and is not sent anywhere.\n`
  );

  console.log('=== Closet60 admin account ready ===');
  console.log('Email:   ', ADMIN_EMAIL);
  console.log('Password:', password);
  console.log('Saved to:', credsPath);
})().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
