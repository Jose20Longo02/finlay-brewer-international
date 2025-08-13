// routes/superAdminRoutes.js
const uploadProfilePic = require('../middleware/uploadProfilePic');
const express            = require('express');
const router             = express.Router();
const { ensureSuperAdmin } = require('../middleware/authorize');
const adminController    = require('../controllers/adminController');
const areaRoles          = require('../config/roles');


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

// Edit team member (form)
router.get(
  '/team/:id/edit',
  ensureSuperAdmin,
  async (req, res, next) => {
    try {
      const { query } = require('../config/db');
      const { rows } = await query(
        'SELECT id, name, email, role, area, position FROM users WHERE id = $1',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).send('User not found');
      const member = rows[0];
      const pendingCountRes = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
      const pendingCount = parseInt(pendingCountRes.rows[0].count, 10);
      res.render('superadmin/team/edit-member', { member, areaRoles, pendingCount, error: null });
    } catch (err) { next(err); }
  }
);

// Update team member (submit)
router.post(
  '/team/:id/edit',
  ensureSuperAdmin,
  async (req, res, next) => {
    try {
      const { query } = require('../config/db');
      const { role, area, position } = req.body;
      if (!['Admin','SuperAdmin'].includes(role)) return res.status(400).send('Invalid role');
      await query(
        'UPDATE users SET role=$1, area=$2, position=$3, updated_at=NOW() WHERE id=$4',
        [role, area, position, req.params.id]
      );
      res.redirect('/superadmin/dashboard/team');
    } catch (err) { next(err); }
  }
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