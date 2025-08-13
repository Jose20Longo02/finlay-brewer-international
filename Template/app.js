// app.js

const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const expressLayouts = require('express-ejs-layouts');
const authRoutes     = require('./routes/authRoutes');
const projectRoutes  = require('./routes/projectRoutes');
const publicProjectRoutes = require('./routes/publicProjectRoutes');
const adminUserRoutes    = require('./routes/adminUserRoutes');
const superAdminRoutes   = require('./routes/superAdminRoutes');
const { publicRouter: propertyRoutes, adminRouter: adminPropertyRoutes } = require('./routes/propertyRoutes');
const leadRoutes     = require('./routes/leadRoutes');
const { connectDB }  = require('./config/db');
const locations      = require('./config/locations');

const app = express();
connectDB();

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false
}));

// 1) Set up EJS **first**
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2) Then register the layouts middleware
app.use(expressLayouts);
app.set('layout', 'layouts/main');   // this is your default layout

// Routes
app.use('/auth', authRoutes);
app.use('/superadmin/dashboard/projects', projectRoutes);
app.use('/projects', publicProjectRoutes);
app.use('/admin/dashboard', adminUserRoutes);
app.use('/superadmin/dashboard', superAdminRoutes); // SuperAdmin landing
app.use('/', leadRoutes); // mount lead routes (public API + pages)

// Public & agent routes
app.use('/properties', propertyRoutes);

// SuperAdmin-only routes
app.use('/superadmin/dashboard/properties', adminPropertyRoutes);

// Alias admin create route so buttons like "/admin/properties/new" work
app.use('/admin/properties', propertyRoutes);

// Home page route
app.get('/', (req, res) => {
  res.render('home', { 
    title: 'Find Your Dream Home',
    user: req.session.user || null,
    locations
  });
});

// Root & 404
//app.use((req, res) => res.status(404).render('errors/404'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));