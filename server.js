require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'images', 'uploads');

// Make sure the uploads folder exists.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

// ---------- image upload ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    cb(null, unique + (safeExt || '.jpg'));
  }
});
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  }
});

app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const imageUrl = 'images/uploads/' + req.file.filename;
    res.json({ imageUrl });
  });
});

// ---------- category routes ----------
app.get('/api/categories', (req, res) => {
  const db = readDB();
  res.json(db.categories || []);
});

app.post('/api/categories', requireAuth, (req, res) => {
  const { name, description, imageUrl } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
  const db = readDB();
  const newCategory = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    description: (description || '').trim(),
    imageUrl: (imageUrl || '').trim()
  };
  db.categories = db.categories || [];
  db.categories.push(newCategory);
  writeDB(db);
  res.status(201).json(newCategory);
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const db = readDB();
  const idx = (db.categories || []).findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  const { name, description, imageUrl } = req.body || {};
  if (name !== undefined) db.categories[idx].name = name.trim();
  if (description !== undefined) db.categories[idx].description = description.trim();
  if (imageUrl !== undefined) db.categories[idx].imageUrl = imageUrl.trim();
  writeDB(db);
  res.json(db.categories[idx]);
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const db = readDB();
  const before = (db.categories || []).length;
  db.categories = (db.categories || []).filter(c => c.id !== req.params.id);
  if (db.categories.length === before) {
    writeDB(db);
    return res.status(404).json({ error: 'Category not found' });
  }
  // Products that belonged to the deleted category become uncategorized
  // rather than disappearing.
  db.products = (db.products || []).map(p =>
    p.categoryId === req.params.id ? { ...p, categoryId: '' } : p
  );
  writeDB(db);
  res.json({ ok: true });
});

// ---------- product routes ----------
app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products || []);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { title, description, imageUrl, categoryId } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const db = readDB();
  const newProduct = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    description: (description || '').trim(),
    imageUrl: (imageUrl || '').trim(),
    categoryId: (categoryId || '').trim()
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
  const { title, description, imageUrl, categoryId } = req.body || {};
  if (title !== undefined) db.products[idx].title = title.trim();
  if (description !== undefined) db.products[idx].description = description.trim();
  if (imageUrl !== undefined) db.products[idx].imageUrl = imageUrl.trim();
  if (categoryId !== undefined) db.products[idx].categoryId = categoryId.trim();
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

// ---------- team routes ----------
app.get('/api/team', (req, res) => {
  const db = readDB();
  res.json(db.team || []);
});

app.post('/api/team', requireAuth, (req, res) => {
  const { name, designation, description, imageUrl } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const db = readDB();
  const newMember = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    designation: (designation || '').trim(),
    description: (description || '').trim(),
    imageUrl: (imageUrl || '').trim()
  };
  db.team = db.team || [];
  db.team.push(newMember);
  writeDB(db);
  res.status(201).json(newMember);
});

app.put('/api/team/:id', requireAuth, (req, res) => {
  const db = readDB();
  const idx = (db.team || []).findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Team member not found' });
  const { name, designation, description, imageUrl } = req.body || {};
  if (name !== undefined) db.team[idx].name = name.trim();
  if (designation !== undefined) db.team[idx].designation = designation.trim();
  if (description !== undefined) db.team[idx].description = description.trim();
  if (imageUrl !== undefined) db.team[idx].imageUrl = imageUrl.trim();
  writeDB(db);
  res.json(db.team[idx]);
});

app.delete('/api/team/:id', requireAuth, (req, res) => {
  const db = readDB();
  const before = (db.team || []).length;
  db.team = (db.team || []).filter(m => m.id !== req.params.id);
  writeDB(db);
  if (db.team.length === before) return res.status(404).json({ error: 'Team member not found' });
  res.json({ ok: true });
});

// Static files last so /api routes above take priority
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
