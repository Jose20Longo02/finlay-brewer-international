// routes/adminRoutes.js

const express = require('express');
const router  = express.Router();
const { ensureSuperAdmin } = require('../middleware/authorize');
const adminController      = require('../controllers/adminController');
const { showProfile, updateProfile } = require('../controllers/adminController');


//SUPERADMIN

// Super-Admin Dashboard
router.get(
  '/',
  ensureSuperAdmin,
  adminController.dashboard
);



// EDIT PROFILE
// GET /superadmin/dashboard/profile
router.get(
  '/profile',
  ensureSuperAdmin,
  adminController.showProfile
);

// POST /superadmin/dashboard/profile
router.post(
  '/profile',
  ensureSuperAdmin,
  uploadProfilePic,      // your multer middleware for profile pictures
  adminController.updateProfile
);



// Team Management (formerly Agents)
router.get(
  '/team',
  ensureSuperAdmin,
  adminController.listAgents
);
router.post(
  '/team/:id/approve',
  ensureSuperAdmin,
  adminController.approveAgent
);
router.post(
  '/team/:id/reject',
  ensureSuperAdmin,
  adminController.rejectAgent
);














//ADMIN


router.get('/', ensureAdmin, adminController.adminDashboard);

module.exports = router;