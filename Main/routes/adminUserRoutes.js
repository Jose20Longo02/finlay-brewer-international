// routes/adminUserRoutes.js
const express       = require('express');
const router        = express.Router();
const { ensureAdmin } = require('../middleware/authorize');
const adminController = require('../controllers/adminController');
const uploadProfilePic   = require('../middleware/uploadProfilePic');
const propertyController   = require('../controllers/propertyController');

//ADMIN


router.get('/', ensureAdmin, adminController.adminDashboard);

// EDIT PROFILE
router.get('/profile',
  ensureAdmin,
  adminController.showAdminProfile
);

router.post('/profile',
  ensureAdmin,
  uploadProfilePic,
  adminController.updateAdminProfile
);

router.get('/my-properties', ensureAdmin, propertyController.listMyProperties);

module.exports = router;