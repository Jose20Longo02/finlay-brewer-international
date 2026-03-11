// routes/blogAdminRoutes.js
const express = require('express');
const router = express.Router();
const uploadBlogCover = require('../middleware/uploadBlogCover');
const uploadBlogInlineImage = require('../middleware/uploadBlogInlineImage');
const blogController = require('../controllers/blogController');

const allowStaff = (req, res, next) => {
  const role = req.session?.user?.role;
  if (role === 'Admin' || role === 'SuperAdmin') return next();
  res.status(403).send('Forbidden – staff only');
};

// List blogs (both Admin and SuperAdmin)
router.get('/', allowStaff, blogController.listBlogsAdmin);

// Inline image upload for TinyMCE (must be before :id routes)
router.post('/upload-image', allowStaff, uploadBlogInlineImage);

// New blog form & create (must be before :id routes)
router.get('/new', allowStaff, blogController.newBlogForm);
router.post('/new', allowStaff, uploadBlogCover, blogController.createBlog);

// Edit form & update
router.get('/:id/edit', allowStaff, blogController.editBlogForm);
router.post('/:id/edit', allowStaff, uploadBlogCover, blogController.updateBlog);

// Delete
router.post('/:id/delete', allowStaff, blogController.deleteBlog);

module.exports = router;
