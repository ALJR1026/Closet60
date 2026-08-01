# Closet60 — local site + admin backend

A working local version of the Closet60 site with real login/signup and an admin
dashboard for managing product listings, site content, and images. No external npm
packages required — the server uses only Node's built-in modules (plus global
fetch/FormData, built into Node 18+, for the optional persistent-storage integrations
described below).

## Run it

```
cd closet60-app
npm start
```

Then open **http://localhost:3000** in your browser.

- Public site: `http://localhost:3000/`
- Login: `http://localhost:3000/login.html`
- Sign up: `http://localhost:3000/signup.html`
- Admin dashboard: `http://localhost:3000/admin.html`

```
npm run seed -- --force
```

## What the admin dashboard does

**Site content** (top of the dashboard):
- **Theme**: switch the public site's colour palette between Closet60 (default, black +
  lime), Savana (warm sand + terracotta), and NewMe (black + hot pink) — layout and every
  feature stay identical, only colours change
- **Promotional banner slideshow**: upload 3-4 images to run as a rotating banner at the
  top of the site (auto-advances every ~5.5s, with dot navigation). Each slide has its own
  optional headline, subtitle, link, and on/off toggle
- Edit the homepage hero (badges, headline, subtitle, both button labels)
- Edit the 4 small stats under the headline and the 4 big numbers in the lime stats band
- Edit the footer tagline, contact email, and copyright line

**Products**:
- Add new products one at a time (name, category, price, MRP, tag, image upload)
- **Batch add**: pick multiple images at once — a row is created per image with a name
  guessed from the filename, then set category/price/MRP/tag per row or bulk-apply common
  values to every row before submitting them all in one go
- Edit any existing product inline (name, category, price, MRP, tag)
- Replace a product's image
- Delete products
- Search and filter the catalogue by category

Changes save immediately to `data/db.json` and show up on the live site right away.

## Shopping on the public site

- Click any product card to open a quick-view popup with the image, price, a size
  selector (apparel sizes, shoe sizes for footwear, or "One Size" for accessories) and a
  quantity stepper. The **+** button on a card quick-adds the item in its first size.
- The bag icon in the nav shows your item count and opens a cart popup where you can
  review items, remove them, and see the subtotal. The cart persists in the browser
  (`localStorage`) across page reloads.
- **Place Order** clears the cart and opens a live tracking popup — a rider and dark
  store are assigned at random, and an ETA counts down with a progress bar. The 60-minute
  delivery window is sped up for the demo (finishes in about a minute) and ends in a
  "Delivered" state.

This is all front-end simulation for demo purposes — there's no real payment, backend
order record, or live rider dispatch behind it.

## How it's built

- `server.js` — a single Node `http` server: serves the site, handles auth
  (signup/login/logout via HTTP-only signed cookies), and exposes the product API.
- `lib/auth.js` — password hashing (scrypt) and signed session tokens (HMAC,
  JWT-shaped) using only Node's `crypto` module.
- `lib/multipart.js` — a small multipart/form-data parser, used for image uploads.
- `lib/db.js` — the data layer. Defaults to a flat-file JSON "database"
  (`data/db.json`) holding users, products, and site content — zero setup for local
  dev. If `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` env vars are set, it
  automatically switches to Upstash Redis instead, so data survives host restarts.
- `uploads/` — local fallback location for product images. If `CLOUDINARY_*` env vars
  are set, images upload to Cloudinary instead and this folder isn't used.
- `public/` — the site itself: `index.html`, `login.html`, `signup.html`, `admin.html`.

## Making data persist on Render's free tier

**Render's free web services have no persistent disk.** Any file written while the
app is running — `data/db.json`, uploaded images in `uploads/` — is wiped every time
the service redeploys, restarts, or spins down from inactivity and wakes back up. That
means product edits and site content changes made through the live admin panel don't
survive; the site resets to whatever's in the last GitHub commit. This isn't a bug in
the app, it's a hard restriction of Render's free plan (confirmed in
[Render's docs](https://render.com/docs/disks) — persistent disks only attach to paid
instance types).

To fix it for free, this app can use two free external services instead of local disk.
Neither is required for local development — without them, everything falls back to the
old local-file behavior automatically.

### 1. Upstash Redis (for products, users, site content)

1. Sign up free at [upstash.com](https://upstash.com) → create a Redis database (any
   free region).
2. On the database's page, copy the **REST URL** and **REST Token**.
3. On your Render service → **Environment**, add:
   - `UPSTASH_REDIS_REST_URL` = the REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = the REST Token

### 2. Cloudinary (for uploaded product/banner images)

1. Sign up free at [cloudinary.com](https://cloudinary.com) → open the Dashboard.
2. Copy your **Cloud name**, **API Key**, and **API Secret**.
3. On Render → **Environment**, add:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 3. A fixed session secret (recommended)

Without this, the app still works, but every restart invalidates existing logins
(everyone gets signed out). Set one fixed secret so sessions survive restarts too:

- `JWT_SECRET` = any long random string (e.g. generate one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

After adding the environment variables, trigger a redeploy (**Manual Deploy → Deploy
latest commit**). Check the Render **Logs** tab on boot — it prints which persistence
mode is active for both data and images, so you can confirm it picked up the new
credentials.

None of these services require a credit card on their free tiers, and none of them
expire on a timer the way Render's own free Postgres does (30-day expiry) — that's why
Upstash and Cloudinary specifically were chosen over Render's built-in database.

## Limitations (still true even with persistent storage set up)

- **No HTTPS locally**: cookies are sent over plain HTTP in local dev. Render serves
  everything over HTTPS automatically, so this only matters if you self-host elsewhere.
- **No password reset / change-password flow** yet.
- **No real payments or order backend** — the cart, checkout, and delivery tracking are
  front-end simulations (cart lives in the browser's `localStorage`; orders aren't sent
  to or stored on the server). Wire up a payments provider and an orders table before
  this could take real money.
- Free-tier Redis/Cloudinary quotas are generous for a demo but not unlimited — check
  their pricing pages before pushing real production traffic through this.

## Deploying somewhere real

**GitHub Pages will not work for this app.** Pages only serves static files —
it can't run a Node process, so login, signup, and the admin dashboard would
all break (they need the server). Use Pages only if you strip this down to
just the static homepage.

For the full app — auth, product API, admin dashboard, image uploads — deploy
to a host that runs Node. Render's free tier is the easiest path:

### 1. Push this folder to GitHub

```
cd closet60-app
git init
git add .
git commit -m "Closet60"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/closet60-app.git
git push -u origin main
```

The included `.gitignore` already keeps `admin-credentials.txt` and
`data/jwt-secret.txt` out of the repo. `data/db.json` is fine to commit — it
only stores a salted password hash, never the plaintext password.

### 2. Deploy on Render

1. Go to render.com, sign up/log in, click **New +** → **Web Service**.
2. Connect the GitHub repo you just pushed.
3. Settings:
   - **Build Command**: `npm install` (there's nothing to install, but Render requires this field)
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Click **Create Web Service**. Render builds and starts it, then gives you a
   URL like `https://closet60-app.onrender.com`.

### 3. Log in

If you committed `data/db.json`, your existing admin login
(`admin@closet60.in` / the password from `admin-credentials.txt`) works
immediately on the live URL.

If the database started empty (fresh deploy with no `data/db.json`), the
server auto-creates an admin account on first boot and prints the email and
password **once** to Render's **Logs** tab — check there right after the
first deploy.

### Known limits of the free tier

- **Ephemeral disk**: Render's free plan does not guarantee the filesystem
  survives redeploys, restarts, or spin-downs — see "Making data persist on
  Render's free tier" above for the fix (Upstash Redis + Cloudinary, both free).
- **Cold starts**: free services sleep after inactivity and take ~30-60s to
  wake on the next request.

Railway and Fly.io work the same way — connect the repo, set the start
command to `npm start`, and they read `process.env.PORT` automatically since
the app already does.
