# Closet60 — local site + admin backend

A working local version of the Closet60 site with real login/signup and an admin
dashboard for managing product listings and images. No external npm packages
required — the server uses only Node's built-in modules.

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

## Admin login

```
Email:    admin@closet60.in
Password: Cl60-f3VqQK82YB!
```

Also saved in `admin-credentials.txt`. Log in at `/login.html` — you'll be
redirected straight to the admin dashboard. **Change this password** once you
have a real place to store it (there's no "change password" UI yet — see
Limitations below).

To generate a fresh admin password at any time:

```
npm run seed -- --force
```

## What the admin dashboard does

- Add new products (name, category, price, MRP, tag, image upload)
- Edit any existing product inline (name, category, price, MRP, tag)
- Replace a product's image
- Delete products
- Search and filter the catalogue by category

Changes save immediately to `data/db.json` and show up on the live site right away.

## How it's built

- `server.js` — a single Node `http` server: serves the site, handles auth
  (signup/login/logout via HTTP-only signed cookies), and exposes the product API.
- `lib/auth.js` — password hashing (scrypt) and signed session tokens (HMAC,
  JWT-shaped) using only Node's `crypto` module.
- `lib/multipart.js` — a small multipart/form-data parser, used for image uploads.
- `lib/db.js` — a flat-file JSON "database" (`data/db.json`) holding users and products.
- `uploads/` — uploaded product images are saved here and served at `/uploads/...`.
- `public/` — the site itself: `index.html`, `login.html`, `signup.html`, `admin.html`.

## Limitations (this is a local demo, not production infrastructure)

- **Storage**: `data/db.json` is a flat file, fine for a prototype, not for real traffic
  or concurrent writes at scale. Move to a real database (Postgres, etc.) before launch.
- **No HTTPS**: cookies are sent over plain HTTP locally. Put this behind HTTPS
  (a real host, or a reverse proxy) before it touches real user data.
- **No password reset / change-password flow** yet.
- **No payments, cart, or checkout** — this covers browsing, auth, and admin catalogue
  management only.
- Uploaded images live on local disk; move to S3/Cloud Storage for a real deployment.

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
  survives redeploys. Product edits and uploaded images made through the live
  admin dashboard can be lost the next time you push a change or Render
  rebuilds the service. Fine for a demo; not fine for real inventory data.
- **Cold starts**: free services sleep after inactivity and take ~30-60s to
  wake on the next request.
- For anything real, move `data/db.json` to an actual database (Postgres is
  free on Render too) and product images to object storage (S3, Cloudflare R2,
  etc.) instead of local disk.

Railway and Fly.io work the same way — connect the repo, set the start
command to `npm start`, and they read `process.env.PORT` automatically since
the app already does.
