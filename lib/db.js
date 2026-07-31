const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SECRET_PATH = path.join(DATA_DIR, 'jwt-secret.txt');

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

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    save({ users: [], products: buildInitialProducts() });
  }
}

function load() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getSecret() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SECRET_PATH)) {
    fs.writeFileSync(SECRET_PATH, crypto.randomBytes(32).toString('hex'));
  }
  return fs.readFileSync(SECRET_PATH, 'utf8').trim();
}

module.exports = { load, save, ensureDB, getSecret, CATEGORY_LABELS, DATA_DIR };
