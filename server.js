require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ---------- tiny JSON "database" ----------
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Create the admin account the first time the server ever runs.
function ensureAdmin() {
  const db = readDB();
  if (!db.admin) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';
    db.admin = { username, passwordHash: bcrypt.hashSync(password, 10) };
    writeDB(db);
    console.log('Created admin account. Username:', username);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('WARNING: no ADMIN_PASSWORD set — using default "changeme123". Change it from the admin panel immediately.');
    }
  }
}
ensureAdmin();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'please-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8, sameSite: 'lax' } // 8 hour login
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ---------- auth routes ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = readDB();
  if (!db.admin || db.admin.username !== username) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const ok = bcrypt.compareSync(password || '', db.admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.isAdmin), username: req.session.username || null });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const db = readDB();
  const ok = bcrypt.compareSync(currentPassword || '', db.admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  db.admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- product routes ----------
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products || []);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { title, description, imageUrl } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const db = readDB();
  const newProduct = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    description: (description || '').trim(),
    imageUrl: (imageUrl || '').trim()
  };
  db.products = db.products || [];
  db.products.push(newProduct);
  writeDB(db);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const db = readDB();
  const idx = (db.products || []).findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  const { title, description, imageUrl } = req.body || {};
  if (title !== undefined) db.products[idx].title = title.trim();
  if (description !== undefined) db.products[idx].description = description.trim();
  if (imageUrl !== undefined) db.products[idx].imageUrl = imageUrl.trim();
  writeDB(db);
  res.json(db.products[idx]);
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const db = readDB();
  const before = (db.products || []).length;
  db.products = (db.products || []).filter(p => p.id !== req.params.id);
  writeDB(db);
  if (db.products.length === before) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});

// Static files last so /api routes above take priority
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
