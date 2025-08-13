// routes/projectRoutes.js
const express = require('express');
const router  = express.Router();
const { ensureSuperAdmin } = require('../middleware/authorize');
const uploadProjectMedia = require('../middleware/uploadProjectMedia');

// Make sure this path is correct!
const {
  listProjects,
  listProjectsPublic,
  showProject,
  newProjectForm,
  createProject,
  editProjectForm,
  updateProject,
  deleteProject
} = require('../controllers/projectController');

// Allow both Admin and SuperAdmin for create/edit
const allowStaff = (req, res, next) => {
  const role = req.session.user?.role;
  return (role === 'Admin' || role === 'SuperAdmin')
    ? next()
    : res.status(403).send('Forbidden – staff only');
};

// SuperAdmin dashboard: list/manage projects
router.get('/', ensureSuperAdmin, listProjects);

// Admin routes
router.get('/admin',               ensureSuperAdmin, listProjects);
router.get('/new',            allowStaff, newProjectForm);
router.post('/',              allowStaff, uploadProjectMedia, createProject);
router.get('/:id/edit',       allowStaff, editProjectForm);
router.post('/:id',           allowStaff, uploadProjectMedia, updateProject);
router.post('/:id/delete',    allowStaff, deleteProject);

module.exports = router;