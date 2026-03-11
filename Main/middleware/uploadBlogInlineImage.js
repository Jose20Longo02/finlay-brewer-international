// middleware/uploadBlogInlineImage.js – for TinyMCE inline image uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const multerS3 = require('multer-s3');
const { getSpacesClient, isSpacesEnabled } = require('../config/spaces');

const hasSpaces = isSpacesEnabled();

let storage;
if (hasSpaces) {
  const s3 = getSpacesClient();
  storage = multerS3({
    s3,
    bucket: process.env.SPACES_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const safe = (file.originalname || 'img')
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '') || 'img';
      const ownerPart = (req.session?.user?.id) ? `user-${req.session.user.id}` : 'anonymous';
      cb(null, `Blogs/inline/${ownerPart}/${Date.now()}-${safe}`);
    }
  });
} else {
  const uploadDir = path.join(__dirname, '../public/uploads/blogs/inline');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}${ext}`);
    }
  });
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('file'); // TinyMCE sends as "file"

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
      }
      return res.status(500).json({ error: 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file' });
    }
    const url = req.file.location || '/uploads/blogs/inline/' + req.file.filename;
    res.json({ location: url });
  });
};
