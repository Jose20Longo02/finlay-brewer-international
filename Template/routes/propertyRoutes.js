// routes/propertyRoutes.js
const express                 = require('express');
const { ensureAdmin, ensureSuperAdmin } = require('../middleware/authorize');
const uploadPropertyMedia     = require('../middleware/uploadPropertyMedia');
const propertyController      = require('../controllers/propertyController');

const {
  listPropertiesPublic,
  showProperty,
  newPropertyForm,
  createProperty,
  editPropertyForm,
  updateProperty,
  deleteProperty,
  listPropertiesAdmin,
  deletePropertyAdmin,
  reassignProperty,        // ← make sure this is exported from your controller
  getFeaturedProperties
} = propertyController;

// ———————————————————————————————————————————————
// Public & Agent Router (mount at `/properties`)
// ———————————————————————————————————————————————
const publicRouter = express.Router();

// Allow both Admin and SuperAdmin for creation endpoints
const allowStaff = (req, res, next) => {
  const role = req.session.user?.role;
  return (role === 'Admin' || role === 'SuperAdmin')
    ? next()
    : res.status(403).send('Forbidden – staff only');
};

publicRouter.get('/',             listPropertiesPublic);

// Agent-only (placed before slug route to avoid being captured as a slug)
publicRouter.get('/new',          allowStaff, newPropertyForm);
publicRouter.post('/',            allowStaff, uploadPropertyMedia, createProperty);
publicRouter.get('/:id/edit',     allowStaff, editPropertyForm);
publicRouter.post('/:id',         allowStaff, uploadPropertyMedia, updateProperty);
publicRouter.post('/:id/delete',  ensureAdmin, deleteProperty);

// API (must be before /:slug or "api" is captured as slug)
publicRouter.get('/api/featured', getFeaturedProperties);

// Keep slug route last
publicRouter.get('/:slug',        showProperty);

// ———————————————————————————————————————————————
// Super-Admin Router (mount at `/admin/properties`)
// ———————————————————————————————————————————————
const adminRouter = express.Router();

// List & delete
adminRouter.get('/',              ensureSuperAdmin, listPropertiesAdmin);
adminRouter.post('/:id/delete',   ensureSuperAdmin, deletePropertyAdmin);

// Reassign handler
adminRouter.post(
  '/:id/reassign',
  ensureSuperAdmin,
  reassignProperty
);

module.exports = {
  publicRouter,
  adminRouter
};