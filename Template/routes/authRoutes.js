// routes/authRoutes.js

const express               = require('express');
const router                = express.Router();
const authController        = require('../controllers/authController');
const uploadProfilePic      = require('../middleware/uploadProfilePic');
const { redirectIfAuthenticated } = require('../middleware/authorize');

// GET /auth/login  — only for guests
router.get(
  '/login',
  redirectIfAuthenticated,
  authController.loginPage
);

// GET /auth/register  — only for guests
router.get(
  '/register',
  redirectIfAuthenticated,
  authController.registerPage
);

// POST /auth/login  — don't let logged-in users re-submit
router.post(
  '/login',
  redirectIfAuthenticated,
  authController.login
);

// POST /auth/register  — multipart form + guest-only
router.post(
  '/register',
  redirectIfAuthenticated,
  uploadProfilePic,
  authController.register
);

// POST /auth/logout — any authenticated user
router.post(
  '/logout',
  authController.logout
);

module.exports = router;