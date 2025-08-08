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
  reassignProperty        // ← make sure this is exported from your controller
} = propertyController;

// ———————————————————————————————————————————————
// Public & Agent Router (mount at `/properties`)
// ———————————————————————————————————————————————
const publicRouter = express.Router();

publicRouter.get('/',             listPropertiesPublic);
publicRouter.get('/:slug',        showProperty);

// Agent-only
publicRouter.get('/new',          ensureAdmin, newPropertyForm);
publicRouter.post('/',            ensureAdmin, uploadPropertyMedia, createProperty);
publicRouter.get('/:id/edit',     ensureAdmin, editPropertyForm);
publicRouter.post('/:id',         ensureAdmin, uploadPropertyMedia, updateProperty);
publicRouter.post('/:id/delete',  ensureAdmin, deleteProperty);

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