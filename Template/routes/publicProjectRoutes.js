// routes/publicProjectRoutes.js
const express = require('express');
const router  = express.Router();

const { listProjectsPublic, showProject } = require('../controllers/projectController');

// Public projects listing with filters and pagination
router.get('/', listProjectsPublic);

// Public project detail by slug
router.get('/:slug', showProject);

module.exports = router;


