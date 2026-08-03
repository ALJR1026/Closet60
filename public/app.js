// Closet60 — shared JS used by every page: theme application, cart state,
// auth-aware nav, and small helpers. Page-specific logic (product grids,
// checkout form, tracking countdown, etc.) lives in each page's own inline
// <script>, which can rely on everything defined here already being loaded
// (this file is included before the page's own script tag).

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function offPct(price, mrp) {
  if (!mrp) return 0;
  return Math.round((1 - price / mrp) * 100);
}

function imgFor(p) {
  return p.imageUrl || `https://picsum.photos/seed/${p.id}/500/650?grayscale`;
}

function sizesFor(p) {
  if (p.cat === 'footwear') return ['6', '7', '8', '9', '10', '11'];
  if (p.cat === 'accessories') return ['One Size'];
  return ['S', 'M', 'L', 'XL', 'XXL'];
}

// ---- Cart (persisted in localStorage, shared across every page) ----
function loadCart() {
  try { return JSON.parse(localStorage.getItem('c60_cart') || '[]'); }
  catch (e) { return []; }
}
let CART = loadCart();

function saveCart() {
  localStorage.setItem('c60_cart', JSON.stringify(CART));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = CART.reduce((n, i) => n + i.qty, 0);
}

function addToCart(p, size, qty) {
  const existing = CART.find(i => i.id === p.id && i.size === size);
  if (existing) { existing.qty += qty; }
  else { CART.push({ id: p.id, name: p.name, price: p.price, mrp: p.mrp, imageUrl: imgFor(p), size, qty }); }
  saveCart();
}

// Mutates CART only — pages that render a cart list should re-render after
// calling this (different pages want different UI treatment on removal).
function removeFromCart(idx) {
  CART.splice(idx, 1);
  saveCart();
}

updateCartBadge();

// ---- PWA: register the service worker (enables "Add to Home Screen") ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline on first load, or dev environment without HTTPS/localhost — safe to ignore */
    });
  });
}

// ---- Auth-aware nav ----
async function checkAuth() {
  const box = document.getElementById('authLinks');
  if (!box) return;
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;
    const user = await res.json();
    box.innerHTML = `<span>Hi, ${escapeHtml(user.name.split(' ')[0])}</span>${user.role === 'admin' ? '<a href="/admin.html">Admin</a>' : ''}<a href="#" id="logoutLink">Logout</a>`;
    document.getElementById('logoutLink').addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST' });
      location.reload();
    });
  } catch (e) { /* backend not running */ }
}
checkAuth();

// ---- Theme + footer content (every page shares these) ----
// Homepage-only content (hero, banner slideshow, stats) is applied via the
// optional window.onSiteContent(sc) hook, defined by index.html itself.
async function applySharedSiteContent() {
  try {
    const res = await fetch('/api/site-content');
    if (!res.ok) return;
    const sc = await res.json();

    const theme = sc.theme || 'default';
    if (theme !== 'default') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('c60_theme', theme); } catch (e) {}

    // Keep the installed-app status bar / browser chrome colour in sync with theme
    const THEME_COLORS = { default: '#0a0a0a', savana: '#f6efe0', newme: '#0a0a0a' };
    const themeColorTag = document.querySelector('meta[name="theme-color"]');
    if (themeColorTag) themeColorTag.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.default);

    if (sc.footer) {
      const t = document.getElementById('footerTagline');
      if (t && sc.footer.tagline) t.textContent = sc.footer.tagline;
      const e = document.getElementById('footerEmail');
      if (e && sc.footer.email) { e.textContent = sc.footer.email; e.href = 'mailto:' + sc.footer.email; }
      const c = document.getElementById('footerCopyright');
      if (c && sc.footer.copyright) c.textContent = sc.footer.copyright;
    }

    if (typeof window.onSiteContent === 'function') window.onSiteContent(sc);
  } catch (e) { /* backend not running — keep static defaults */ }
}
applySharedSiteContent();
