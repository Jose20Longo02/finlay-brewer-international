// app.js

const express        = require('express');
const session        = require('express-session');
const PgSession      = require('connect-pg-simple')(session);
const path           = require('path');
const expressLayouts = require('express-ejs-layouts');
const authRoutes     = require('./routes/authRoutes');
const adminUserRoutes    = require('./routes/adminUserRoutes');
const superAdminRoutes   = require('./routes/superAdminRoutes');
const { publicRouter: propertyRoutes, adminRouter: adminPropertyRoutes } = require('./routes/propertyRoutes');
const leadRoutes     = require('./routes/leadRoutes');
const blogRoutes     = require('./routes/blogRoutes');
const blogAdminRoutes = require('./routes/blogAdminRoutes');
const blogController = require('./controllers/blogController');
const { connectDB, query } = require('./config/db');
const locations      = require('./config/locations');

const app = express();
connectDB();

// Placeholder data when no properties exist (random images + fake info)
const PLACEHOLDER_IMAGES = ['/img/France.jpg', '/img/Monaco.jpg', '/img/Montenegro.jpg', '/img/Costa%20Del%20Sol.jpg', '/img/London.jpg'];
const PLACEHOLDER_TITLES = ['Coastal Villa with Sea Views', 'Modern Apartment in Prime Location', 'Charming House with Garden', 'Luxury Penthouse Suite', 'Family Home with Pool', 'Stylish Loft Downtown'];
const PLACEHOLDER_LOCATIONS = [
  { city: 'Nice', country: 'France' },
  { city: 'Monte Carlo', country: 'Monaco' },
  { city: 'Budva', country: 'Montenegro' },
  { city: 'Marbella', country: 'Spain' },
  { city: 'Chelsea', country: 'UK' }
];
const PLACEHOLDER_PRICES = [850000, 420000, 695000, 1200000, 575000, 920000];

function getPlaceholderProperties(count = 6) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const img = PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length];
    const loc = PLACEHOLDER_LOCATIONS[i % PLACEHOLDER_LOCATIONS.length];
    list.push({
      id: `placeholder-${i + 1}`,
      slug: '',
      title: PLACEHOLDER_TITLES[i % PLACEHOLDER_TITLES.length],
      city: loc.city,
      country: loc.country,
      neighborhood: null,
      price: PLACEHOLDER_PRICES[i % PLACEHOLDER_PRICES.length],
      photos: [img],
      type: ['Apartment', 'House', 'Villa'][i % 3]
    });
  }
  return list;
}

/** Placeholder articles when no blog posts exist. */
const PLACEHOLDER_ARTICLE_IMAGES = ['/img/France.jpg', '/img/Monaco.jpg', '/img/Montenegro.jpg', '/img/Costa%20Del%20Sol.jpg', '/img/London.jpg'];
const PLACEHOLDER_ARTICLE_TITLES = [
  'The Future of Construction: Building Smarter, Faster, Greener',
  '5 Ways Project Management Improves Real Estate Deals',
  'Sustainable Building Materials: What to Look For',
  'Right Time to Invest: Market Trends in 2025',
  'Urban Development and Community Design Best Practices'
];

function getPlaceholderArticles(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `placeholder-${i + 1}`,
    slug: '',
    title: PLACEHOLDER_ARTICLE_TITLES[i % PLACEHOLDER_ARTICLE_TITLES.length],
    cover_image: PLACEHOLDER_ARTICLE_IMAGES[i % PLACEHOLDER_ARTICLE_IMAGES.length]
  }));
}

/** Fetches latest 5 blog posts. Fallback: placeholder articles with random images. */
function getRecentArticles() {
  return query('SELECT id, title, slug, cover_image FROM blog_posts ORDER BY created_at DESC LIMIT 5')
    .then(result => {
      const rows = result && result.rows ? result.rows : [];
      if (rows.length === 0) return getPlaceholderArticles();
      return rows.map(a => ({
        ...a,
        cover_image: a.cover_image || PLACEHOLDER_ARTICLE_IMAGES[Math.floor(Math.random() * PLACEHOLDER_ARTICLE_IMAGES.length)]
      }));
    })
    .catch(() => getPlaceholderArticles());
}

/** Fetches similar properties with fallbacks: same city → same country → other countries. Excludes given property id. */
function getSimilarProperties(country, city, excludeId, limit = 6) {
  const sql = `
    SELECT id, title, slug, country, city, neighborhood, price, photos, type,
           CASE WHEN type = 'Apartment' THEN apartment_size
                WHEN type IN ('House','Villa') THEN living_space
                ELSE land_size END as size,
           bedrooms, bathrooms
    FROM properties
    WHERE id != $1
    ORDER BY
      CASE WHEN city = $3 AND country = $2 THEN 0 WHEN country = $2 THEN 1 ELSE 2 END,
      RANDOM()
    LIMIT $4
  `;
  return query(sql, [excludeId, country, city, limit]).then(result => {
    const rows = result?.rows || [];
    return rows.map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []),
      size: p.size != null ? p.size : null
    }));
  }).catch(() => []);
}

/** Fetches sold properties for "Our results speak from themselves" (for-sellers, about). */
function getSoldProperties(limit = 12) {
  const sql = `SELECT id, title, slug, country, city, neighborhood, price, photos, type
    FROM properties
    WHERE COALESCE(status, 'active') = 'sold'
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT $1`;
  return query(sql, [limit]).then(result => {
    const rows = result && result.rows ? result.rows : [];
    return rows.map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])
    }));
  }).catch(() => []);
}

/** Fetches Our Favorite Properties: featured first, then most viewed, then random. Fallback: placeholder data. */
function getFavoriteProperties() {
  const sql = `SELECT id, title, slug, country, city, neighborhood, price, photos, type
    FROM properties
    WHERE COALESCE(status, 'active') = 'active'
    ORDER BY (CASE WHEN COALESCE(featured, false) = true THEN 1 ELSE 2 END),
             COALESCE(views_count, 0) DESC,
             RANDOM()
    LIMIT 6`;
  return query(sql).then(result => {
    const rows = result && result.rows ? result.rows : [];
    if (rows.length === 0) return [];
    return rows.map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])
    }));
  });
}

// Featured API and favicon – handle first so nothing can intercept
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/favicon.ico') {
    return res.redirect(302, '/img/logo.png');
  }
  if (req.method === 'GET' && req.path === '/api/featured') {
    const send = (list) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(Array.isArray(list) ? list : []);
    };
    return getFavoriteProperties()
      .then(list => send(list.map(p => ({ ...p, agent: { name: 'Agent', profile_picture: null } }))))
      .catch(e => {
        console.error('GET /api/featured:', e.message);
        send([]);
      });
  }
  if (req.method === 'GET' && req.path === '/api/properties/similar') {
    const country = req.query.country || '';
    const city = req.query.city || '';
    const exclude = req.query.exclude || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 6, 12);
    const send = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(data);
    };
    if (!country || !city || !exclude) {
      return send({ success: false, properties: [] });
    }
    return getSimilarProperties(country, city, exclude, limit)
      .then(list => send({ success: true, properties: list }))
      .catch(e => {
        console.error('GET /api/properties/similar:', e.message);
        send({ success: false, properties: [] });
      });
  }
  next();
});

// Admin theme and black header for /admin and /superadmin routes
app.use((req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  if (path.startsWith('/admin') || path.startsWith('/superadmin')) {
    res.locals.loadAdminTheme = true;
    const existing = (res.locals.bodyClass || '').trim();
    res.locals.bodyClass = existing ? existing + ' header-dark' : 'header-dark';
  }
  next();
});

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }),
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// 1) Set up EJS **first**
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 2) Then register the layouts middleware
app.use(expressLayouts);
app.set('layout', 'layouts/main');   // this is your default layout

// Home page route – define EARLY so GET / is handled before other routers
app.get('/', (req, res) => {
  Promise.all([getFavoriteProperties(), getRecentArticles()])
    .then(([featuredProperties, recentArticles]) => {
      const articles = Array.isArray(recentArticles) ? recentArticles : getPlaceholderArticles();
      res.render('home', {
        title: 'Find Your Dream Home',
        bodyClass: 'page-home',
        user: req.session.user || null,
        locations,
        featuredProperties,
        recentArticles: articles
      });
    })
    .catch(e => {
      console.error('Home:', e.message);
      res.render('home', {
        title: 'Find Your Dream Home',
        bodyClass: 'page-home',
        user: req.session.user || null,
        locations,
        featuredProperties: [],
        recentArticles: getPlaceholderArticles()
      });
    });
});

// About page – define early so it’s not caught by other routers
app.get('/about', (req, res, next) => {
  getSoldProperties(12)
    .then(soldProperties => {
      res.render('about', {
        title: 'About Us',
        bodyClass: 'page-about header-dark',
        soldProperties: soldProperties || []
      });
    })
    .catch(next);
});

app.get('/blog', blogController.listPosts);

// Routes
app.use('/auth', authRoutes);
app.use('/admin/dashboard', adminUserRoutes);
app.use('/admin/dashboard/blogs', blogAdminRoutes);
app.use('/superadmin/dashboard', superAdminRoutes); // SuperAdmin landing
app.use('/superadmin/dashboard/blogs', blogAdminRoutes);
app.use('/', leadRoutes); // mount lead routes (public API + pages)

app.use('/', blogRoutes); // blog/:slug

// Public & agent routes
app.use('/properties', propertyRoutes);

// SuperAdmin-only routes
app.use('/superadmin/dashboard/properties', adminPropertyRoutes);

// Alias admin create route so buttons like "/admin/properties/new" work
app.use('/admin/properties', propertyRoutes);

// 404
app.use((req, res) => res.status(404).render('errors/404', { title: 'Page not found' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));