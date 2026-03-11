// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { ensureAdmin, ensureSuperAdmin } = require('../middleware/authorize');

// For Sellers page
router.get('/for-sellers', leadController.forSellersPage);

// Contact page
router.get('/contact', leadController.contactPage);

// Public API: home page contact form
router.post('/api/contact', leadController.createFromContact);

// Public API endpoint from property detail page
router.post('/api/leads', leadController.createFromProperty);

// Export leads CSV (more specific paths first)
router.get('/admin/dashboard/leads/export', ensureAdmin, leadController.exportLeadsCSV);
router.get('/superadmin/dashboard/leads/export', ensureSuperAdmin, leadController.exportLeadsCSV);

// Admin leads page (only their own leads)
router.get('/admin/dashboard/leads', ensureAdmin, leadController.listForAdmin);

// SuperAdmin leads page (all leads)
router.get('/superadmin/dashboard/leads', ensureSuperAdmin, leadController.listAll);

// API: get lead detail (Admin/SuperAdmin)
router.get('/api/leads/:id', (req, res, next) => {
  const r = req.session?.user?.role;
  if (r === 'Admin' || r === 'SuperAdmin') return next();
  res.status(403).json({ success: false });
}, leadController.getLeadDetail);

// Update lead (status/notes/reassign)
router.post('/api/leads/:id', (req, res, next) => {
  const r = req.session?.user?.role;
  if (r === 'Admin' || r === 'SuperAdmin') return next();
  res.status(403).json({ success: false });
}, leadController.updateLead);

module.exports = router;


