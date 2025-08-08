// app.js

const express        = require('express');
const session        = require('express-session');
const path           = require('path');
const expressLayouts = require('express-ejs-layouts');
const authRoutes     = require('./routes/authRoutes');
const projectRoutes  = require('./routes/projectRoutes');
const adminUserRoutes    = require('./routes/adminUserRoutes');
const superAdminRoutes   = require('./routes/superAdminRoutes');
const { publicRouter: propertyRoutes, adminRouter: adminPropertyRoutes } = require('./routes/propertyRoutes');
const { connectDB }  = require('./config/db');

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
app.use('/admin/dashboard', adminUserRoutes);
app.use('/superadmin/dashboard', superAdminRoutes); // SuperAdmin landing


// Public & agent routes
app.use('/properties', propertyRoutes);

// SuperAdmin-only routes
app.use('/superadmin/dashboard/properties', adminPropertyRoutes);
// Root & 404
//app.get('/', (req, res) => res.redirect('/properties'));
//app.use((req, res) => res.status(404).render('errors/404'));




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));