// middleware/uploadBlogCover.js
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
      const safe = (file.originalname || 'cover')
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '') || 'cover';
      const blogId = req.params && req.params.id ? String(req.params.id) : 'new';
      const ownerPart = (req.session?.user?.id) ? `user-${req.session.user.id}` : 'anonymous';
      const folder = `Blogs/${ownerPart}/${blogId}`;
      cb(null, `${folder}/cover-${Date.now()}-${safe}`);
    }
  });
} else {
  const uploadDir = path.join(__dirname, '../public/uploads/blogs');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase() || '.jpg';
      cb(null, `cover-${Date.now()}${ext}`);
    }
  });
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
}).single('cover_image');

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).redirect(req.originalUrl + '?error=File+too+large+%285MB+max%29');
      }
      return next(err);
    }
    // Normalize URL for S3: multer-s3 puts location in req.file.location
    if (req.file && req.file.location) {
      req.coverImageUrl = req.file.location;
    } else if (req.file && req.file.filename) {
      req.coverImageUrl = '/uploads/blogs/' + req.file.filename;
    }
    next();
  });
};
