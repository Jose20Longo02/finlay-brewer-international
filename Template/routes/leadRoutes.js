// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { ensureAdmin, ensureSuperAdmin } = require('../middleware/authorize');

// Public API endpoint from property detail page
router.post('/api/leads', leadController.createFromProperty);

// Admin leads page (only their own leads)
router.get('/admin/dashboard/leads', ensureAdmin, leadController.listForAdmin);

// SuperAdmin leads page (all leads)
router.get('/superadmin/dashboard/leads', ensureSuperAdmin, leadController.listAll);

// Update lead (status/notes)
router.post('/api/leads/:id', leadController.updateLead);

module.exports = router;


