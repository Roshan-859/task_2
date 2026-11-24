import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { rateLimit } from 'express-rate-limit';

const app = express();
const port = Number(process.env.PORT || 3000);
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.includes('replace-with')) {
  console.error('Set SESSION_SECRET to a random value of at least 32 characters in .env.');
  process.exit(1);
}

const dbFile = path.resolve(process.env.DATABASE_PATH || './data/shop.sqlite');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT NOT NULL,
    price_paise INTEGER NOT NULL CHECK(price_paise >= 0),
    image_url TEXT NOT NULL,
    badge TEXT,
    stock INTEGER NOT NULL DEFAULT 20 CHECK(stock >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    subtotal_paise INTEGER NOT NULL,
    shipping_paise INTEGER NOT NULL,
    total_paise INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed',
    shipping_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    unit_price_paise INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    line_total_paise INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
`);

const seed = [
  ['arc-table-lamp','Arc Table Lamp','Lighting','A soft pool of light, shaped in brushed brass and opal glass.','Brushed brass · Opal glass · 32 cm high',429000,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1100&q=85','BESTSELLER',18],
  ['hand-formed-vase','Hand-Formed Vase','Objects','An imperfectly perfect vessel made for a single stem or an empty shelf.','Hand-finished stoneware · 22 cm high',189000,'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1100&q=85','NEW',24],
  ['everyday-tote','Everyday Canvas Tote','Carry','A generously sized, sturdy cotton carryall for everything the day holds.','Organic cotton canvas · Internal pocket',149000,'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1100&q=85',null,32],
  ['linen-cushion','Washed Linen Cushion','Textiles','Relaxed European linen with a feather-soft insert. Made for slow afternoons.','100% linen cover · Feather blend insert · 45 × 45 cm',219000,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=1100&q=85','LOW STOCK',9],
  ['studio-carafe','Studio Glass Carafe','Table','A clear, quiet shape that makes even a glass of water feel considered.','Mouth-blown borosilicate glass · 900 ml',179000,'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1100&q=85',null,27],
  ['weekend-throw','Weekend Woven Throw','Textiles','A lightweight layer woven from cotton and linen, finished with a soft fringe.','Cotton and linen blend · 130 × 180 cm',389000,'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85','Bestseller',14],
  ['daily-journal','Daily Notes Journal','Desk','A tactile, lay-flat notebook for lists, thoughts, and plans worth keeping.','Recycled paper · 160 dotted pages · A5',89000,'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1100&q=85',null,40],
  ['oak-catchall','Oak Catchall Tray','Objects','A small landing place for keys, jewellery, and the little things.','Solid white oak · 20 × 12 cm',249000,'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1100&q=85',null,16]
];
const insertProduct = db.prepare(`INSERT OR IGNORE INTO products
  (slug,name,category,description,details,price_paise,image_url,badge,stock) VALUES (?,?,?,?,?,?,?,?,?)`);
const seedProducts = db.transaction(() => seed.forEach(p => insertProduct.run(...p)));
seedProducts();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  styleSrcAttr: ["'unsafe-inline'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'], scriptSrc: ["'self'"], connectSrc: ["'self'"]
} } }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api/') && ['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers.origin && req.headers.origin !== appOrigin) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  next();
});
app.use(express.static(path.join(process.cwd(), 'public'), { extensions: ['html'] }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again shortly.' } });
app.use('/api/auth', authLimiter);
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
const publicProduct = row => ({ ...row, price: row.price_paise / 100 });
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });
function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, sessionSecret, { expiresIn: '7d', issuer: 'sunday-objects' });
  res.cookie('sunday_session', token, cookieOptions);
}
function requireUser(req, res, next) {
  try {
    const token = req.cookies.sunday_session;
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
    const claims = jwt.verify(token, sessionSecret, { issuer: 'sunday-objects' });
    const user = db.prepare('SELECT id,name,email FROM users WHERE id = ?').get(claims.sub);
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.user = user;
    next();
  } catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/products', (req, res) => {
  const category = String(req.query.category || '').trim();
  const query = String(req.query.q || '').trim().slice(0, 80);
  let sql = 'SELECT * FROM products WHERE stock > 0';
  const params = [];
  if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
  if (query) { sql += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)'; params.push(`%${query}%`,`%${query}%`,`%${query}%`); }
  sql += ' ORDER BY id';
  res.json({ products: db.prepare(sql).all(...params).map(publicProduct), categories: ['All', ...db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map(x => x.category)] });
});
app.get('/api/products/:slug', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'We could not find that piece.' });
  res.json({ product: publicProduct(product) });
});
app.post('/api/newsletter', rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false }), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Please add a valid email address.' });
  db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').run(email);
  res.status(201).json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 70);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Add your name, a valid email, and a password of at least 10 characters.' });
  try {
    const user = { id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12) };
    db.prepare('INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)').run(user.id,user.name,user.email,user.passwordHash);
    setSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error('Registration failed:', error.message);
    return res.status(500).json({ error: 'Could not create your account.' });
  }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'That email and password do not match.' });
  setSession(res, user);
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (_req, res) => { res.clearCookie('sunday_session', { ...cookieOptions, maxAge: undefined }); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => {
  try {
    const claims = jwt.verify(req.cookies.sunday_session || '', sessionSecret, { issuer: 'sunday-objects' });
    const user = db.prepare('SELECT id,name,email FROM users WHERE id = ?').get(claims.sub);
    if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
    res.json({ user });
  } catch { res.status(401).json({ error: 'Sign in to continue.' }); }
});
app.get('/api/orders', requireUser, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  res.json({ orders: orders.map(order => ({ ...order, items: db.prepare('SELECT product_name,unit_price_paise,quantity,line_total_paise FROM order_items WHERE order_id = ?').all(order.id) })) });
});

const placeOrder = db.transaction((user, body) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > 30) throw new Error('Add at least one item to your bag.');
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.productId), qty = Number(item.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 8) throw new Error('One of the item quantities is invalid.');
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }
  if ([...quantities.values()].some(quantity => quantity > 8)) throw new Error('You can add up to 8 of each piece to one order.');
  const selected = [];
  let subtotal = 0;
  for (const [id, quantity] of quantities) {
    const product = db.prepare('SELECT id,name,price_paise,stock FROM products WHERE id = ?').get(id);
    if (!product || product.stock < quantity) throw new Error(`${product?.name || 'A selected item'} is no longer available in that quantity.`);
    selected.push({ ...product, quantity, line: product.price_paise * quantity });
    subtotal += product.price_paise * quantity;
  }
  const shipping = subtotal >= 500000 ? 0 : 9900;
  const total = subtotal + shipping;
  const shippingName = String(body.shipping?.name || '').trim().slice(0,80);
  const address = String(body.shipping?.address || '').trim().slice(0,180);
  const city = String(body.shipping?.city || '').trim().slice(0,80);
  const region = String(body.shipping?.region || '').trim().slice(0,80);
  const postalCode = String(body.shipping?.postalCode || '').trim().slice(0,12);
  if (shippingName.length < 2 || address.length < 6 || city.length < 2 || region.length < 2 || !/^[A-Za-z0-9 -]{4,12}$/.test(postalCode)) throw new Error('Please complete each delivery address field.');
  const orderId = crypto.randomUUID();
  db.prepare('INSERT INTO orders (id,user_id,subtotal_paise,shipping_paise,total_paise,shipping_name,address,city,region,postal_code) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(orderId,user.id,subtotal,shipping,total,shippingName,address,city,region,postalCode);
  const addItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,unit_price_paise,quantity,line_total_paise) VALUES (?,?,?,?,?,?)');
  const decrement = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  for (const item of selected) { addItem.run(orderId,item.id,item.name,item.price_paise,item.quantity,item.line); decrement.run(item.quantity,item.id,item.quantity); }
  return { id: orderId, subtotal, shipping, total, itemCount: selected.reduce((sum,item)=>sum+item.quantity,0) };
});

app.post('/api/orders', requireUser, (req, res) => {
  try { return res.status(201).json({ order: placeOrder(req.user, req.body || {}) }); }
  catch (error) { return res.status(400).json({ error: error.message || 'Could not place this order.' }); }
});

app.get('/product/:slug', (_req, res) => res.sendFile(path.join(process.cwd(),'public','index.html')));
app.get('*path', (_req, res) => res.sendFile(path.join(process.cwd(),'public','index.html')));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });

app.listen(port, () => console.log(`Sunday Objects is ready at http://localhost:${port}`));
