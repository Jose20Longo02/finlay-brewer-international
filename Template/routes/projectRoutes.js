// routes/projectRoutes.js
const express = require('express');
const router  = express.Router();
const { ensureSuperAdmin } = require('../middleware/authorize');

// Make sure this path is correct!
const {
  listProjects,
  newProjectForm,
  createProject,
  editProjectForm,
  updateProject,
  deleteProject
} = require('../controllers/projectController');

// These must all be functions
router.get('/',               ensureSuperAdmin, listProjects);
router.get('/new',            ensureSuperAdmin, newProjectForm);
router.post('/',              ensureSuperAdmin, createProject);
router.get('/:id/edit',       ensureSuperAdmin, editProjectForm);
router.post('/:id',           ensureSuperAdmin, updateProject);
router.post('/:id/delete',    ensureSuperAdmin, deleteProject);

module.exports = router;