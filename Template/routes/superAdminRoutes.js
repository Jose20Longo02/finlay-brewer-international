// routes/superAdminRoutes.js
const uploadProfilePic = require('../middleware/uploadProfilePic');
const express            = require('express');
const router             = express.Router();
const { ensureSuperAdmin } = require('../middleware/authorize');
const adminController    = require('../controllers/adminController');


// GET /superadmin/dashboard
router.get(
  '/',
  ensureSuperAdmin,
  adminController.dashboard
);



router.get('/profile',
  ensureSuperAdmin,
  adminController.showSuperAdminProfile
);

router.post('/profile',
  ensureSuperAdmin,
  uploadProfilePic,
  adminController.updateSuperAdminProfile
);










// Team Management (formerly Agents)
router.get(
  '/team',
  ensureSuperAdmin,
  adminController.listTeam
);
router.get(
  '/team',
  ensureSuperAdmin,
  adminController.listTeam
);

// DELETE team member
router.post(
  '/team/:id/delete',
  ensureSuperAdmin,
  adminController.deleteTeamMember
);










//ACCOUNT REQUESTS
// List all requests
router.get(
  '/requests',
  ensureSuperAdmin,
  adminController.listRequests
);

// Update requested user’s role
router.post(
  '/requests/:id/role',
  ensureSuperAdmin,
  adminController.changeRequestRole
);

// Approve one
router.post(
  '/requests/:id/approve',
  ensureSuperAdmin,
  adminController.approveRequest
);

// Reject one
router.post(
  '/requests/:id/reject',
  ensureSuperAdmin,
  adminController.rejectRequest
);




module.exports = router;