const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');

const allowStaff = (req, res, next) => {
  if (req.session?.user?.role === 'Admin' || req.session?.user?.role === 'SuperAdmin') return next();
  res.status(403).send('Forbidden');
};

router.get('/admin/dashboard/buyers', allowStaff, buyerController.listBuyers);
router.get('/admin/dashboard/buyers/new', allowStaff, buyerController.newBuyerForm);
router.get('/admin/dashboard/buyers/from-lead/:leadId', allowStaff, buyerController.newBuyerFromLeadForm);
router.post('/admin/dashboard/buyers', allowStaff, buyerController.createBuyer);
router.get('/admin/dashboard/buyers/:id/edit', allowStaff, buyerController.editBuyerForm);
router.post('/admin/dashboard/buyers/:id', allowStaff, buyerController.updateBuyer);
router.post('/admin/dashboard/buyers/:id/delete', allowStaff, buyerController.deleteBuyer);

router.get('/superadmin/dashboard/buyers', allowStaff, buyerController.listBuyers);
router.get('/superadmin/dashboard/buyers/new', allowStaff, buyerController.newBuyerForm);
router.get('/superadmin/dashboard/buyers/from-lead/:leadId', allowStaff, buyerController.newBuyerFromLeadForm);
router.post('/superadmin/dashboard/buyers', allowStaff, buyerController.createBuyer);
router.get('/superadmin/dashboard/buyers/:id/edit', allowStaff, buyerController.editBuyerForm);
router.post('/superadmin/dashboard/buyers/:id', allowStaff, buyerController.updateBuyer);
router.post('/superadmin/dashboard/buyers/:id/delete', allowStaff, buyerController.deleteBuyer);

module.exports = router;
