const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SECRET_PATH = path.join(DATA_DIR, 'jwt-secret.txt');
const REDIS_DB_KEY = 'closet60:db';

// Strips accidental wrapping quotes and stray whitespace from an env var —
// a very easy mistake to make when copy-pasting a value from a dashboard or
// code snippet into Render's Environment tab (e.g. pasting `"https://..."`
// including the quote marks). Without this, a stray quote turns into a
// crash-on-boot `Invalid URL` error instead of just working.
function cleanEnv(name) {
  const raw = process.env[name];
  if (!raw) return raw;
  return raw.trim().replace(/^['"]|['"]$/g, '').trim();
}

// Render's free web services have no persistent disk — anything written to
// local disk is lost on every redeploy/restart/spin-down. If Upstash Redis
// credentials are present (set as Render env vars), we persist there
// instead, which survives restarts for free. With no credentials set (e.g.
// plain local dev), everything falls back to the original local-file
// behaviour so `npm start` still works with zero setup.
const UPSTASH_URL = cleanEnv('UPSTASH_REDIS_REST_URL');
const UPSTASH_TOKEN = cleanEnv('UPSTASH_REDIS_REST_TOKEN');
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

const CATEGORY_LABELS = {
  essentials: 'Everyday Essentials',
  streetwear: 'Streetwear',
  ethnic: 'Ethnic & Fusion',
  workwear: 'Workwear',
  athleisure: 'Athleisure',
  occasion: 'Occasion Wear',
  footwear: 'Footwear',
  accessories: 'Accessories'
};

// [id, name, cat, price, mrp, tag]
const BASE_PRODUCTS = [
  ['ess1','Classic White Tee','essentials',499,899,'Bestseller'],
  ['ess2','Ribbed Tank Top','essentials',399,699,''],
  ['ess3','Basic Black Joggers','essentials',899,1499,'New'],
  ['ess4','Cotton Boxer Briefs (Pack of 3)','essentials',699,999,''],
  ['ess5','Everyday Crew Socks (Pack of 5)','essentials',349,599,''],
  ['ess6','Relaxed Fit Hoodie','essentials',1299,1999,'Bestseller'],
  ['ess7','Plain Round Neck Tee — Grey','essentials',549,899,''],
  ['ess8','Essential Cotton Shorts','essentials',649,999,''],

  ['str1','Oversized Graphic Tee','streetwear',799,1299,'Trending'],
  ['str2','Cargo Utility Pants','streetwear',1599,2499,'Bestseller'],
  ['str3','Puffer Bomber Jacket','streetwear',2499,3999,'New'],
  ['str4','Distressed Denim Jacket','streetwear',2199,3499,''],
  ['str5','Baggy Fit Jeans','streetwear',1799,2799,'Trending'],
  ['str6','Varsity Letterman Jacket','streetwear',2799,4299,''],
  ['str7','Tie-Dye Streetwear Hoodie','streetwear',1399,2199,''],
  ['str8','Chain Detail Cargo Shorts','streetwear',999,1599,''],

  ['eth1','Embroidered Kurta Set','ethnic',1899,2999,'Bestseller'],
  ['eth2','Printed Anarkali Dress','ethnic',2299,3499,'New'],
  ['eth3','Nehru Jacket — Navy','ethnic',1699,2599,''],
  ['eth4','Fusion Palazzo Set','ethnic',1599,2399,''],
  ['eth5','Bandhani Print Kurti','ethnic',1099,1699,'Trending'],
  ['eth6','Silk Blend Sherwani','ethnic',3499,5499,''],
  ['eth7','Indo-Western Jacket Kurta','ethnic',2599,3999,''],
  ['eth8','Chikankari Cotton Kurta','ethnic',1299,1999,''],

  ['wor1','Tailored Blazer — Charcoal','workwear',2999,4499,'Bestseller'],
  ['wor2','Formal Slim Fit Shirt','workwear',1199,1799,''],
  ['wor3','Pleated Trousers','workwear',1499,2199,''],
  ['wor4','Pencil Skirt — Black','workwear',1099,1699,''],
  ['wor5','Structured Waistcoat','workwear',1799,2699,'New'],
  ['wor6','Button-Down Oxford Shirt','workwear',1099,1599,''],
  ['wor7','Formal Wide-Leg Trousers','workwear',1599,2399,''],
  ['wor8','Office Chinos — Beige','workwear',1399,2099,''],

  ['ath1','Performance Track Jacket','athleisure',1699,2599,'Bestseller'],
  ['ath2','Seamless Training Leggings','athleisure',1299,1999,'Trending'],
  ['ath3','Moisture-Wick Gym Tee','athleisure',799,1199,''],
  ['ath4','Compression Shorts','athleisure',699,1099,''],
  ['ath5','Zip-Up Track Pants','athleisure',1199,1899,''],
  ['ath6','Sports Bra — High Impact','athleisure',899,1399,'New'],
  ['ath7','Running Shorts','athleisure',649,999,''],
  ['ath8','Athleisure Hoodie','athleisure',1499,2299,''],

  ['occ1','Sequin Party Dress','occasion',2799,4299,'Trending'],
  ['occ2','Velvet Blazer Set','occasion',3299,4999,'New'],
  ['occ3','Satin Slip Dress','occasion',2199,3399,''],
  ['occ4','Printed Co-ord Set','occasion',1899,2899,'Bestseller'],
  ['occ5','Wrap Maxi Dress','occasion',2399,3699,''],
  ['occ6','Embellished Evening Gown','occasion',3999,5999,''],
  ['occ7','Linen Wedding Guest Suit','occasion',3599,5499,''],
  ['occ8','Metallic Party Top','occasion',1599,2399,''],

  ['foo1','Classic Canvas Sneakers','footwear',1499,2299,'Bestseller'],
  ['foo2','Chunky Platform Sneakers','footwear',2199,3299,'Trending'],
  ['foo3','Leather Loafers','footwear',2499,3799,''],
  ['foo4','Running Shoes','footwear',2999,4499,'New'],
  ['foo5','Ankle Strap Heels','footwear',1899,2899,''],
  ['foo6','Slide Sandals','footwear',799,1299,''],
  ['foo7','Chelsea Boots','footwear',2799,4199,''],
  ['foo8','Espadrille Flats','footwear',1299,1999,''],

  ['acc1','Woven Leather Belt','accessories',699,1099,''],
  ['acc2','Structured Tote Bag','accessories',1799,2699,'Bestseller'],
  ['acc3','Aviator Sunglasses','accessories',899,1399,'Trending'],
  ['acc4','Minimalist Watch','accessories',2499,3799,'New'],
  ['acc5','Beaded Statement Necklace','accessories',599,949,''],
  ['acc6','Canvas Crossbody Bag','accessories',1199,1899,''],
  ['acc7','Wool Blend Beanie','accessories',549,899,''],
  ['acc8','Layered Chain Bracelet','accessories',449,749,'']
];

function buildInitialProducts() {
  return BASE_PRODUCTS.map(([id, name, cat, price, mrp, tag]) => ({
    id,
    name,
    cat,
    catLabel: CATEGORY_LABELS[cat],
    price,
    mrp,
    tag,
    imageUrl: `https://picsum.photos/seed/${id}/500/650?grayscale`
  }));
}

// Editable site content — populates the promo banner slideshow, hero
// section, stats band and footer on the public site. Managed from the
// admin panel.
// mediaType: 'image' (default) or 'video' — a short, muted, looping video
// can be used in place of a static banner image. The uploaded file's URL is
// still stored in `image` either way; mediaType just tells the front end
// (and the admin editor) which tag to render it with.
const DEFAULT_BANNER_SLIDE = { enabled: false, image: '', mediaType: 'image', title: '', subtitle: '', linkUrl: '#shop' };

// Available visual themes — same layout and features everywhere, only the
// CSS colour palette changes. Selected from the admin panel.
const THEMES = ['default', 'savana', 'newme'];

const DEFAULT_SITE_CONTENT = {
  theme: 'default',
  banners: [
    { ...DEFAULT_BANNER_SLIDE },
    { ...DEFAULT_BANNER_SLIDE },
    { ...DEFAULT_BANNER_SLIDE }
  ],
  hero: {
    badge1: 'Now Live in Hyderabad',
    badge2: '6,000+ styles in stock today',
    titleMain: 'Your outfit,',
    titleAccent: 'delivered',
    titleSuffix: 'in 60 minutes.',
    subtitle: "Closet60 is Hyderabad's fastest fashion delivery platform — live now across 12 neighbourhoods. Real clothes, real sizes, at your door before you've finished picking a playlist.",
    ctaPrimaryText: 'Shop Now →',
    ctaSecondaryText: 'Get the App'
  },
  stats: [
    { num: '60 min', label: 'Avg. delivery time' },
    { num: '12', label: 'Dark stores live in Hyderabad' },
    { num: '6,000+', label: 'Styles in live inventory' },
    { num: '4.8★', label: '18,000+ app ratings' }
  ],
  statsBand: [
    { target: 60, label: 'MINUTE DELIVERY PROMISE' },
    { target: 12, label: 'DARK STORES LIVE IN HYDERABAD' },
    { target: 6000, label: 'LIVE SKUs ON THE APP' },
    { target: 98, label: '% ORDERS DELIVERED ON TIME' }
  ],
  footer: {
    tagline: "Hyderabad's 60-minute quick-commerce fashion platform. Real stock, real speed. Live now.",
    email: 'hello@closet60.in',
    copyright: '© 2026 Closet60. All rights reserved.'
  }
};

function normalizeBanners(sc) {
  if (Array.isArray(sc.banners)) {
    return sc.banners.slice(0, 6).map(slide => ({ ...DEFAULT_BANNER_SLIDE, ...(slide || {}) }));
  }
  // Migrate a legacy single text-banner object (pre-slideshow) into a one-slide array.
  if (sc.banner && typeof sc.banner === 'object') {
    return [{
      ...DEFAULT_BANNER_SLIDE,
      enabled: !!sc.banner.enabled,
      title: sc.banner.text || '',
      linkUrl: sc.banner.linkUrl || '#shop'
    }];
  }
  return DEFAULT_SITE_CONTENT.banners.map(s => ({ ...s }));
}

function withSiteContentDefaults(siteContent) {
  const sc = siteContent || {};
  return {
    theme: THEMES.includes(sc.theme) ? sc.theme : DEFAULT_SITE_CONTENT.theme,
    banners: normalizeBanners(sc),
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...(sc.hero || {}) },
    stats: Array.isArray(sc.stats) && sc.stats.length === 4 ? sc.stats : DEFAULT_SITE_CONTENT.stats,
    statsBand: Array.isArray(sc.statsBand) && sc.statsBand.length === 4 ? sc.statsBand : DEFAULT_SITE_CONTENT.statsBand,
    footer: { ...DEFAULT_SITE_CONTENT.footer, ...(sc.footer || {}) }
  };
}

function defaultDB() {
  return { users: [], products: buildInitialProducts(), siteContent: { ...DEFAULT_SITE_CONTENT } };
}

// Minimal Upstash Redis REST client — no SDK, just fetch (built into Node 18+).
// Commands are sent as a JSON array, e.g. ['GET', key] or ['SET', key, value].
async function redisCommand(cmd) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Upstash Redis error: ${data.error || res.statusText}`);
  }
  return data.result;
}

async function load() {
  if (USE_REDIS) {
    const raw = await redisCommand(['GET', REDIS_DB_KEY]);
    let db;
    if (raw == null) {
      db = defaultDB();
      await save(db);
    } else {
      db = JSON.parse(raw);
    }
    db.siteContent = withSiteContentDefaults(db.siteContent);
    return db;
  }

  // Local-disk fallback (used automatically when Upstash isn't configured).
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB(), null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Migrate older db.json files that predate siteContent.
  db.siteContent = withSiteContentDefaults(db.siteContent);
  return db;
}

async function save(db) {
  if (USE_REDIS) {
    await redisCommand(['SET', REDIS_DB_KEY, JSON.stringify(db)]);
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Kept for backward compatibility with existing call sites — load() already
// self-initializes on first use, so this just warms that up.
async function ensureDB() {
  await load();
}

function getSecret() {
  // A fixed JWT_SECRET env var is the recommended path in any persistent
  // deployment — without it, every restart invalidates existing sessions
  // (annoying, but not data loss, since the app data itself lives in Redis).
  const fixedSecret = cleanEnv('JWT_SECRET');
  if (fixedSecret) return fixedSecret;

  if (USE_REDIS) {
    console.warn(
      'WARNING: JWT_SECRET is not set. Login sessions will be invalidated every time ' +
      'this service restarts. Set a permanent JWT_SECRET environment variable to fix this.'
    );
    if (!global.__c60TempSecret) global.__c60TempSecret = crypto.randomBytes(32).toString('hex');
    return global.__c60TempSecret;
  }

  // Local-disk fallback, same as before.
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SECRET_PATH)) {
    fs.writeFileSync(SECRET_PATH, crypto.randomBytes(32).toString('hex'));
  }
  return fs.readFileSync(SECRET_PATH, 'utf8').trim();
}

module.exports = { load, save, ensureDB, getSecret, CATEGORY_LABELS, DATA_DIR, DEFAULT_SITE_CONTENT, withSiteContentDefaults, THEMES, USE_REDIS, cleanEnv };
