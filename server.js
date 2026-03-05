const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const { initDB } = require('./db/database');

const app = express();

app.engine('hbs', engine({ 
  extname: '.hbs', 
  defaultLayout: 'main',
  helpers: {
    eq: (a, b) => a === b,
    includes: (str, val) => str && str.includes(val),
    firstChar: (str) => str ? str.charAt(0).toUpperCase() : '?',
  }
}));
app.set('view engine', 'hbs');
app.set('views', './views');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'royalbites-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash('success')[0];
  res.locals.error = req.flash('error')[0];
  res.locals.isAdmin = req.session.isAdmin;
  next();
});

const publicRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);


// ── 404 HANDLER ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found - Royal Bites', layout: 'main' });
});

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`Royal Bites running on port ${PORT}`));
});
