# Amanah Global Sourcing — Website + Admin Panel

## What this is
- `public/index.html` — the public website (same design as before). The products
  section now loads from `/api/products` instead of being hardcoded, so whatever
  you add in the admin panel shows up here automatically.
- `public/admin/` — the admin panel (`login.html`, `dashboard.html`). Add, edit,
  and delete products here; change the admin password from the dashboard too.
- `server.js` — the Node/Express backend: login, sessions, and the product API.
- `data/db.json` — where products and the admin login are stored (a plain JSON
  file — no separate database server needed).

## Running it locally
```
npm install
cp .env.example .env      # then edit .env with your own values
npm start
```
Then open `http://localhost:3000` for the site and
`http://localhost:3000/admin/login.html` for the admin panel.

First run creates the admin account from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
in `.env` (defaults to `admin` / `changeme123` if you skip this — **change it
immediately** from the dashboard's "Change Password" panel).

## [Certain] One important limitation — read before deploying
This uses a JSON file on disk for storage, which only works if the server has
a **persistent** filesystem:
- **Railway or a VPS** — fine, disk persists between requests and restarts.
- **Vercel (serverless functions)** — will NOT work reliably. Vercel's
  filesystem is read-only/ephemeral per invocation, so products you add would
  disappear or fail to save. If you deploy there, swap `data/db.json` for a
  real hosted database (e.g. Postgres, MongoDB Atlas, or Vercel's own KV/Blob
  storage) — the API routes in `server.js` are already isolated in one file,
  so only the `readDB`/`writeDB` functions need to change.

## Deploying to Railway (recommended for this setup)
1. Push this folder to a GitHub repo.
2. Create a new Railway project from that repo.
3. Set environment variables in Railway's dashboard: `ADMIN_USERNAME`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`.
4. Railway auto-detects `npm start`. Attach a volume mounted at `/data` if you
   want products to survive a redeploy with certainty (otherwise the repo's
   `data/db.json` is used directly, which also persists on Railway's default
   disk between restarts, just not across a full redeploy that rebuilds the
   container from scratch).

## Security notes
- Passwords are hashed with bcrypt — never stored in plain text.
- Sessions are server-side cookies (8 hour expiry).
- Only the product write routes (`POST` / `PUT` / `DELETE /api/products`) and
  the password-change route require login. `GET /api/products` is public,
  same as the original static site's data.
