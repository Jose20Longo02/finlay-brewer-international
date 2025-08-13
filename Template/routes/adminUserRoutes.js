// routes/adminUserRoutes.js
const express       = require('express');
const router        = express.Router();
const { ensureAdmin } = require('../middleware/authorize');
const adminController = require('../controllers/adminController');
const uploadProfilePic   = require('../middleware/uploadProfilePic');
const propertyController   = require('../controllers/propertyController');
const projectController  = require('../controllers/projectController');
const uploadProjectMedia = require('../middleware/uploadProjectMedia');

// Allow Admin and SuperAdmin
const allowStaff = (req, res, next) => {
  const role = req.session.user?.role;
  return (role === 'Admin' || role === 'SuperAdmin')
    ? next()
    : res.status(403).send('Forbidden – staff only');
};

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
// Projects management (all staff)
router.get('/projects', ensureAdmin, projectController.listProjectsForAdmin);
router.get('/projects/new', allowStaff, projectController.newProjectForm);
router.post('/projects', allowStaff, uploadProjectMedia, projectController.createProject);
router.get('/projects/:id/edit', allowStaff, projectController.editProjectForm);
router.post('/projects/:id', allowStaff, uploadProjectMedia, projectController.updateProject);
router.post('/projects/:id/delete', allowStaff, projectController.deleteProject);

module.exports = router;