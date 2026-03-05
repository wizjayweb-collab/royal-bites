const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { getDB, saveDB } = require('../db/database');

// Memory storage so images save as base64 in DB
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 2 * 1024 * 1024 } 
});

function requireAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

function getSettings() {
  const db = getDB();
  const rows = db.exec("SELECT key, value FROM settings");
  const cfg = {};
  if (rows[0]) rows[0].values.forEach(([k,v]) => cfg[k] = v);
  return cfg;
}

// LOGIN
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { layout: 'admin', title: 'Admin Login' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const rows = db.exec(`SELECT * FROM users WHERE username='${username}'`);
  if (!rows[0]) { req.flash('error', 'Invalid credentials'); return res.redirect('/admin/login'); }
  const user = rows[0].values[0];
  if (!bcrypt.compareSync(password, user[2])) { req.flash('error', 'Invalid credentials'); return res.redirect('/admin/login'); }
  req.session.isAdmin = true;
  req.session.adminUser = username;
  res.redirect('/admin/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// DASHBOARD
router.get('/dashboard', requireAuth, (req, res) => {
  const db = getDB();
  const cfg = getSettings();
  const reservations = db.exec("SELECT COUNT(*) FROM reservations")[0].values[0][0];
  const pending = db.exec("SELECT COUNT(*) FROM reservations WHERE status='pending'")[0].values[0][0];
  const messages = db.exec("SELECT COUNT(*) FROM messages")[0].values[0][0];
  const unread = db.exec("SELECT COUNT(*) FROM messages WHERE read=0")[0].values[0][0];
  const menuCount = db.exec("SELECT COUNT(*) FROM menu_items")[0].values[0][0];
  const resRows = db.exec("SELECT * FROM reservations ORDER BY created_at DESC LIMIT 5");
  const recentReservations = resRows[0] ? resRows[0].values.map(r => ({
    id:r[0],name:r[1],email:r[2],phone:r[3],date:r[4],
    time:r[5],guests:r[6],message:r[7],status:r[8],created_at:r[9]
  })) : [];
  res.render('admin/dashboard', {
    layout: 'admin', title: 'Dashboard', active: 'dashboard', cfg,
    stats: { reservations, pending, messages, unread, menuCount },
    recentReservations
  });
});

// MENU
router.get('/menu', requireAuth, (req, res) => {
  const db = getDB();
  const rows = db.exec("SELECT * FROM menu_items ORDER BY category");
  const items = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],description:r[2],price:r[3],
    category:r[4],emoji:r[5],tag:r[6],visible:r[7],
    image_data:r[8]
  })) : [];
  res.render('admin/menu', { layout:'admin', title:'Menu', active:'menu', items });
});

router.post('/menu', requireAuth, upload.single('image'), (req, res) => {
  const { name, description, price, category, emoji, tag, media_type } = req.body;
  let image_data = null;
  let final_emoji = emoji || '🍽️';

  if (media_type === 'image' && req.file) {
    image_data = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    final_emoji = null;
  }

  getDB().run(
    "INSERT INTO menu_items (name,description,price,category,emoji,tag,image_data) VALUES (?,?,?,?,?,?,?)",
    [name, description, price, category, final_emoji, tag||'', image_data]
  );
  saveDB();
  req.flash('success', 'Menu item added!');
  res.redirect('/admin/menu');
});

router.post('/menu/:id/edit', requireAuth, upload.single('image'), (req, res) => {
  const { name, description, price, category, emoji, tag, media_type } = req.body;
  const db = getDB();

  // Get existing item
  const existing = db.exec(`SELECT * FROM menu_items WHERE id=${req.params.id}`);
  const old = existing[0] ? existing[0].values[0] : null;

  let image_data = old ? old[8] : null;
  let final_emoji = emoji || old?.[5] || '🍽️';

  if (media_type === 'image' && req.file) {
    image_data = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    final_emoji = null;
  } else if (media_type === 'emoji') {
    image_data = null;
    final_emoji = emoji || '🍽️';
  }

  db.run(
    "UPDATE menu_items SET name=?,description=?,price=?,category=?,emoji=?,tag=?,image_data=? WHERE id=?",
    [name, description, price, category, final_emoji, tag, image_data, req.params.id]
  );
  saveDB();
  req.flash('success', 'Item updated!');
  res.redirect('/admin/menu');
});

router.post('/menu/:id/delete', requireAuth, (req, res) => {
  getDB().run("DELETE FROM menu_items WHERE id=?", [req.params.id]);
  saveDB();
  req.flash('success', 'Item deleted.');
  res.redirect('/admin/menu');
});

// RESERVATIONS
router.get('/reservations', requireAuth, (req, res) => {
  const rows = getDB().exec("SELECT * FROM reservations ORDER BY created_at DESC");
  const reservations = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],email:r[2],phone:r[3],date:r[4],
    time:r[5],guests:r[6],message:r[7],status:r[8],created_at:r[9]
  })) : [];
  res.render('admin/reservations', { layout:'admin', title:'Reservations', active:'reservations', reservations });
});

router.post('/reservations/:id/status', requireAuth, (req, res) => {
  getDB().run("UPDATE reservations SET status=? WHERE id=?", [req.body.status, req.params.id]);
  saveDB();
  req.flash('success', 'Status updated!');
  res.redirect('/admin/reservations');
});

router.post('/reservations/:id/delete', requireAuth, (req, res) => {
  getDB().run("DELETE FROM reservations WHERE id=?", [req.params.id]);
  saveDB();
  req.flash('success', 'Reservation deleted.');
  res.redirect('/admin/reservations');
});

// MESSAGES
router.get('/messages', requireAuth, (req, res) => {
  const db = getDB();
  db.run("UPDATE messages SET read=1");
  saveDB();
  const rows = db.exec("SELECT * FROM messages ORDER BY created_at DESC");
  const messages = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],email:r[2],subject:r[3],message:r[4],read:r[5],created_at:r[6]
  })) : [];
  res.render('admin/messages', { layout:'admin', title:'Messages', active:'messages', messages });
});

router.post('/messages/:id/delete', requireAuth, (req, res) => {
  getDB().run("DELETE FROM messages WHERE id=?", [req.params.id]);
  saveDB();
  req.flash('success', 'Message deleted.');
  res.redirect('/admin/messages');
});

// SETTINGS
router.get('/settings', requireAuth, (req, res) => {
  const cfg = getSettings();
  res.render('admin/settings', { layout:'admin', title:'Settings', active:'settings', cfg });
});

router.post('/settings', requireAuth, (req, res) => {
  const db = getDB();
  Object.entries(req.body).forEach(([key, value]) => {
    const exists = db.exec(`SELECT key FROM settings WHERE key='${key}'`);
    if (exists[0]) db.run("UPDATE settings SET value=? WHERE key=?", [value, key]);
    else db.run("INSERT INTO settings (key,value) VALUES (?,?)", [key, value]);
  });
  saveDB();
  req.flash('success', 'Settings saved!');
  res.redirect('/admin/settings');
});

router.post('/settings/password', requireAuth, (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const db = getDB();
  const rows = db.exec(`SELECT * FROM users WHERE username='${req.session.adminUser}'`);
  const user = rows[0].values[0];
  if (!bcrypt.compareSync(current_password, user[2])) {
    req.flash('error', 'Wrong current password.');
    return res.redirect('/admin/settings');
  }
  if (new_password !== confirm_password) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/admin/settings');
  }
  db.run("UPDATE users SET password=? WHERE username=?",
    [bcrypt.hashSync(new_password, 10), req.session.adminUser]);
  saveDB();
  req.flash('success', 'Password changed!');
  res.redirect('/admin/settings');
});


// FEEDBACK
router.get('/feedback', requireAuth, (req, res) => {
  const rows = getDB().exec("SELECT * FROM feedback ORDER BY created_at DESC");
  const feedback = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],email:r[2],rating:r[3],
    review:r[4],approved:r[5],created_at:r[6]
  })) : [];
  const pending = feedback.filter(f => !f.approved).length;
  res.render('admin/feedback', { layout:'admin', title:'Feedback', active:'feedback', feedback, pending });
});

router.post('/feedback/:id/approve', requireAuth, (req, res) => {
  getDB().run("UPDATE feedback SET approved=1 WHERE id=?", [req.params.id]);
  saveDB();
  req.flash('success', 'Review approved!');
  res.redirect('/admin/feedback');
});

router.post('/feedback/:id/delete', requireAuth, (req, res) => {
  getDB().run("DELETE FROM feedback WHERE id=?", [req.params.id]);
  saveDB();
  req.flash('success', 'Review deleted.');
  res.redirect('/admin/feedback');
});

module.exports = router;
