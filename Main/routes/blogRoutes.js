// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

router.get('/blog/:slug', blogController.showPost);

module.exports = router;
