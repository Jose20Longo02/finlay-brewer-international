// middleware/authorize.js

// Only allow approved Agents
// middleware/authorize.js
exports.ensureAdmin = (req, res, next) =>
  req.session.user?.role === 'Admin'
    ? next()
    : res.status(403).send('Forbidden – Admin only');

exports.ensureSuperAdmin = (req, res, next) =>
  req.session.user?.role === 'SuperAdmin'
    ? next()
    : res.status(403).send('Forbidden – SuperAdmin only');

exports.redirectIfAuthenticated = (req, res, next) => {
  const u = req.session.user;
  if (u) {
    // Already signed in, send to the proper dashboard
    if (u.role === 'SuperAdmin')   return res.redirect('/superadmin/dashboard');
    if (u.role === 'Admin')        return res.redirect('/admin/dashboard');
  }
  next();
};