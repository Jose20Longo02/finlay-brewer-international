const express = require('express');
const { ensureSuperAdmin } = require('../middleware/authorize');
const ownerController = require('../controllers/ownerController');

const router = express.Router();

router.get('/superadmin/dashboard/owners', ensureSuperAdmin, ownerController.listOwners);
router.get('/superadmin/dashboard/owners/new', ensureSuperAdmin, ownerController.newOwnerForm);
router.post('/superadmin/dashboard/owners', ensureSuperAdmin, ownerController.createOwner);
router.get('/superadmin/dashboard/owners/:id/edit', ensureSuperAdmin, ownerController.editOwnerForm);
router.post('/superadmin/dashboard/owners/:id', ensureSuperAdmin, ownerController.updateOwner);
router.post('/superadmin/dashboard/owners/:id/delete', ensureSuperAdmin, ownerController.deleteOwner);

module.exports = router;
