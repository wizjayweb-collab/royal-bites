const express = require('express');
const router = express.Router();
const { getDB, saveDB } = require('../db/database');

function getSettings() {
  const db = getDB();
  const rows = db.exec("SELECT key, value FROM settings");
  const cfg = {};
  if (rows[0]) rows[0].values.forEach(([k,v]) => cfg[k] = v);
  return cfg;
}

router.get('/', (req, res) => {
  const db = getDB();
  const cfg = getSettings();
  const menuRows = db.exec("SELECT * FROM menu_items WHERE visible=1 LIMIT 4");
  const items = menuRows[0] ? menuRows[0].values.map(r => ({
    id:r[0],name:r[1],description:r[2],price:r[3],
    category:r[4],emoji:r[5],tag:r[6]
  })) : [];
  res.render('home', { title: cfg.restaurant_name, cfg, items });
});

router.get('/menu', (req, res) => {
  const db = getDB();
  const cfg = getSettings();
  const rows = db.exec("SELECT * FROM menu_items WHERE visible=1 ORDER BY category");
  const items = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],description:r[2],price:r[3],
    category:r[4],emoji:r[5],tag:r[6]
  })) : [];
  res.render('menu', { title: 'Menu - '+cfg.restaurant_name, cfg, items });
});

router.get('/gallery', (req, res) => {
  const cfg = getSettings();
  res.render('gallery', { title: 'Gallery - '+cfg.restaurant_name, cfg });
});

router.get('/reservations', (req, res) => {
  const cfg = getSettings();
  res.render('reservations', { title: 'Reserve - '+cfg.restaurant_name, cfg });
});

router.get('/contact', (req, res) => {
  const cfg = getSettings();
  res.render('contact', { title: 'Contact - '+cfg.restaurant_name, cfg });
});

router.post('/reservations', (req, res) => {
  const { name, email, phone, date, time, guests, message } = req.body;
  const db = getDB();
  db.run("INSERT INTO reservations (name,email,phone,date,time,guests,message) VALUES (?,?,?,?,?,?,?)",
    [name,email,phone,date,time,guests,message||'']);
  saveDB();
  const cfg = getSettings();
  res.render('reservations', { 
    title: 'Reserve - '+cfg.restaurant_name, cfg,
    success: true,
    msg: `Thank you ${name}! Your table for ${guests} on ${date} at ${time} is confirmed.`
  });
});

router.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  const db = getDB();
  db.run("INSERT INTO messages (name,email,subject,message) VALUES (?,?,?,?)",
    [name,email,subject||'',message]);
  saveDB();
  const cfg = getSettings();
  res.render('contact', { 
    title: 'Contact - '+cfg.restaurant_name, cfg,
    success: true,
    msg: `Thank you ${name}! We will get back to you shortly.`
  });
});


// FEEDBACK PAGE
router.get('/feedback', (req, res) => {
  const db = getDB();
  const cfg = getSettings();
  const rows = db.exec("SELECT * FROM feedback WHERE approved=1 ORDER BY created_at DESC");
  const reviews = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],email:r[2],rating:r[3],
    review:r[4],approved:r[5],created_at:r[6]
  })) : [];
  const avgRows = db.exec("SELECT AVG(rating) FROM feedback WHERE approved=1");
  const avg = avgRows[0] ? parseFloat(avgRows[0].values[0][0] || 0).toFixed(1) : '0.0';
  const countRows = db.exec("SELECT COUNT(*) FROM feedback WHERE approved=1");
  const count = countRows[0] ? countRows[0].values[0][0] : 0;
  res.render('feedback', { title: 'Reviews - '+cfg.restaurant_name, cfg, reviews, avg, count });
});

router.post('/feedback', (req, res) => {
  const { name, email, rating, review } = req.body;
  const db = getDB();
  const cfg = getSettings();
  if (!name || !rating || !review) {
    const rows = db.exec("SELECT * FROM feedback WHERE approved=1 ORDER BY created_at DESC");
    const reviews = rows[0] ? rows[0].values.map(r => ({
      id:r[0],name:r[1],rating:r[3],review:r[4],created_at:r[6]
    })) : [];
    return res.render('feedback', { title: 'Reviews', cfg, reviews, avg:'0.0', count:0, error:'Please fill all required fields.' });
  }
  db.run("INSERT INTO feedback (name,email,rating,review) VALUES (?,?,?,?)",
    [name, email||'', parseInt(rating), review]);
  saveDB();
  const rows = db.exec("SELECT * FROM feedback WHERE approved=1 ORDER BY created_at DESC");
  const reviews = rows[0] ? rows[0].values.map(r => ({
    id:r[0],name:r[1],rating:r[3],review:r[4],created_at:r[6]
  })) : [];
  const avg = '0.0'; const count = 0;
  res.render('feedback', { title:'Reviews - '+cfg.restaurant_name, cfg, reviews, avg, count,
    success:'Thank you! Your review has been submitted for approval.' });
});

module.exports = router;
