// Closet60 backend — zero external dependencies (Node's http, fs, crypto only).
const http = require('http');
const fs = require('fs');
const path = require('path');

const { load, save, ensureDB, getSecret, CATEGORY_LABELS } = require('./lib/db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/auth');
const { parseMultipart } = require('./lib/multipart');
const { ensureAdmin } = require('./lib/bootstrap');

ensureDB();
{
  const db = load();
  const created = ensureAdmin(db, save);
  if (created) {
    console.log('=== First boot: admin account created ===');
    console.log('Email:   ', created.email);
    console.log('Password:', created.password);
    console.log('This is only printed once — save it now.');
  }
}
const JWT_SECRET = getSecret();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = 'closet60_token';

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(body);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function setAuthCookie(res, user) {
  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, 86400);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function getUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  try {
    return verifyToken(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 1024 * 1024) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (!buf.length) return resolve({});
      try { resolve(JSON.parse(buf.toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('File too large (max 8MB)')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!boundaryMatch) throw new Error('Missing multipart boundary');
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const buf = await readRawBody(req);
  return parseMultipart(buf, boundary);
}

function saveUploadedFile(fileEntry) {
  const ext = path.extname(fileEntry.filename) || '.jpg';
  const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), fileEntry.buffer);
  return `/uploads/${filename}`;
}

function serveStatic(res, urlPath, rootDir) {
  const safePath = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(rootDir, safePath);
  if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end('Forbidden'); return true; }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // ---------- Auth ----------
    if (pathname === '/api/auth/signup' && method === 'POST') {
      const { name, email, phone, password } = await readJsonBody(req);
      if (!name || !email || !password) return sendJSON(res, 400, { error: 'Name, email and password are required' });
      if (String(password).length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters' });
      const db = load();
      const emailLower = String(email).toLowerCase().trim();
      if (db.users.some(u => u.email.toLowerCase() === emailLower)) {
        return sendJSON(res, 409, { error: 'An account with this email already exists' });
      }
      const user = { id: 'user-' + Date.now(), name, email: emailLower, phone: phone || '', passwordHash: hashPassword(password), role: 'customer' };
      db.users.push(user);
      save(db);
      setAuthCookie(res, user);
      return sendJSON(res, 201, { id: user.id, name: user.name, email: user.email, role: user.role });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = await readJsonBody(req);
      if (!email || !password) return sendJSON(res, 400, { error: 'Email and password are required' });
      const db = load();
      const emailLower = String(email).toLowerCase().trim();
      const user = db.users.find(u => u.email.toLowerCase() === emailLower);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJSON(res, 401, { error: 'Invalid email or password' });
      }
      setAuthCookie(res, user);
      return sendJSON(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role });
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      clearAuthCookie(res);
      return sendJSON(res, 200, { success: true });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = getUser(req);
      if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
      return sendJSON(res, 200, { id: user.id, name: user.name, email: user.email, role: user.role });
    }

    // ---------- Public products ----------
    if (pathname === '/api/products' && method === 'GET') {
      return sendJSON(res, 200, load().products);
    }

    const singleProductMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (singleProductMatch && method === 'GET') {
      const product = load().products.find(p => p.id === singleProductMatch[1]);
      if (!product) return sendJSON(res, 404, { error: 'Product not found' });
      return sendJSON(res, 200, product);
    }

    // ---------- Admin product management ----------
    if (pathname === '/api/admin/products' && method === 'POST') {
      const user = getUser(req);
      if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
      if (user.role !== 'admin') return sendJSON(res, 403, { error: 'Admin access only' });

      const { fields, files } = await readMultipart(req);
      const { name, cat, price, mrp, tag } = fields;
      if (!name || !cat || !price || !mrp) return sendJSON(res, 400, { error: 'name, cat, price and mrp are required' });

      const db = load();
      const id = 'prod-' + Date.now();
      const imageUrl = files.image ? saveUploadedFile(files.image) : `https://picsum.photos/seed/${id}/500/650?grayscale`;
      const product = {
        id, name, cat,
        catLabel: CATEGORY_LABELS[cat] || cat,
        price: Number(price), mrp: Number(mrp),
        tag: tag || '', imageUrl
      };
      db.products.unshift(product);
      save(db);
      return sendJSON(res, 201, product);
    }

    const adminProductMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (adminProductMatch && method === 'PUT') {
      const user = getUser(req);
      if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
      if (user.role !== 'admin') return sendJSON(res, 403, { error: 'Admin access only' });

      const db = load();
      const idx = db.products.findIndex(p => p.id === adminProductMatch[1]);
      if (idx === -1) return sendJSON(res, 404, { error: 'Product not found' });

      const { fields, files } = await readMultipart(req);
      const product = db.products[idx];
      if (fields.name !== undefined) product.name = fields.name;
      if (fields.cat !== undefined) { product.cat = fields.cat; product.catLabel = CATEGORY_LABELS[fields.cat] || fields.cat; }
      if (fields.price !== undefined) product.price = Number(fields.price);
      if (fields.mrp !== undefined) product.mrp = Number(fields.mrp);
      if (fields.tag !== undefined) product.tag = fields.tag;
      if (files.image) product.imageUrl = saveUploadedFile(files.image);

      db.products[idx] = product;
      save(db);
      return sendJSON(res, 200, product);
    }

    if (adminProductMatch && method === 'DELETE') {
      const user = getUser(req);
      if (!user) return sendJSON(res, 401, { error: 'Not logged in' });
      if (user.role !== 'admin') return sendJSON(res, 403, { error: 'Admin access only' });

      const db = load();
      const before = db.products.length;
      db.products = db.products.filter(p => p.id !== adminProductMatch[1]);
      if (db.products.length === before) return sendJSON(res, 404, { error: 'Product not found' });
      save(db);
      return sendJSON(res, 200, { success: true });
    }

    // ---------- Static files ----------
    if (pathname.startsWith('/uploads/')) {
      if (serveStatic(res, pathname.replace('/uploads', ''), UPLOAD_DIR)) return;
      return sendJSON(res, 404, { error: 'Not found' });
    }

    if (pathname === '/') {
      if (serveStatic(res, '/index.html', PUBLIC_DIR)) return;
    }
    if (serveStatic(res, pathname, PUBLIC_DIR)) return;

    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJSON(res, 400, { error: err.message || 'Something went wrong' });
  }
});

server.listen(PORT, () => {
  console.log(`Closet60 running at http://localhost:${PORT}`);
  console.log(`Admin dashboard:  http://localhost:${PORT}/admin.html`);
});
