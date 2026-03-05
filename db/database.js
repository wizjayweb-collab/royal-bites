const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let db;
const DB_PATH = path.join(__dirname, 'restaurant.db');

async function initDB() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price TEXT NOT NULL,
    category TEXT DEFAULT 'mains',
    emoji TEXT DEFAULT '🍽️',
    tag TEXT DEFAULT '',
    visible INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT,
    date TEXT, time TEXT, guests TEXT,
    message TEXT, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, subject TEXT,
    message TEXT, read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const bcrypt = require('bcryptjs');
  const adminExists = db.exec("SELECT id FROM users WHERE username='admin'");
  if (!adminExists[0]) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO users (username,password) VALUES (?,?)", ['admin', hash]);
  }

  const defaults = [
    ['restaurant_name', 'Royal Bites Restaurant'],
    ['tagline', 'A Royal Dining Experience'],
    ['address', '123 Royal Street, Lagos'],
    ['phone', '+234 800 000 0000'],
    ['email', 'info@royalbites.com'],
    ['hours_weekday', '10:00 AM - 11:00 PM'],
    ['hours_weekend', '8:00 AM - 12:00 AM'],
    ['hero_title', 'A Royal Dining Experience'],
    ['hero_desc', 'Indulge in world-class cuisine crafted by master chefs.'],
    ['about_text', 'Founded in 2009, Royal Bites has been the cornerstone of fine dining.'],
    ['facebook', '#'], ['instagram', '#'], ['twitter', '#'],
  ];
  defaults.forEach(([key, value]) => {
    const exists = db.exec(`SELECT key FROM settings WHERE key='${key}'`);
    if (!exists[0]) db.run("INSERT INTO settings (key,value) VALUES (?,?)", [key, value]);
  });

  const menuExists = db.exec("SELECT id FROM menu_items LIMIT 1");
  if (!menuExists[0]) {
    const items = [
      ['Royal Grilled Ribeye','Prime cut ribeye with truffle butter','$45','mains','🥩','Signature'],
      ['Lobster Thermidor','Atlantic lobster in creamy cognac sauce','$65','seafood','🦞','Premium'],
      ['Black Truffle Pasta','Handmade tagliatelle with shaved truffle','$38','mains','🍝','Vegetarian'],
      ['Royal Chocolate Fondant','Dark chocolate lava cake, vanilla ice cream','$18','desserts','🍰','Best Seller'],
      ['Caesar Royal Salad','Crisp romaine, parmesan, croutons','$12','starters','🥗','Vegetarian'],
      ['Pan Seared Salmon','Norwegian salmon, lemon beurre blanc','$35','seafood','🐟','Healthy'],
    ];
    items.forEach(([name,desc,price,cat,emoji,tag]) => {
      db.run("INSERT INTO menu_items (name,description,price,category,emoji,tag) VALUES (?,?,?,?,?,?)",
        [name,desc,price,cat,emoji,tag]);
    });
  }

  saveDB();
  console.log('✅ Database ready');
}

function saveDB() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function getDB() { return db; }

module.exports = { initDB, getDB, saveDB };
