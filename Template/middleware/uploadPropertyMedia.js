// middleware/uploadPropertyMedia.js
const multer  = require('multer');
const path    = require('path');

// store files under public/uploads/properties
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/properties/'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  // only images and one video
  if (file.mimetype.startsWith('image/') || file.fieldname === 'video') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max per file
}).fields([
  { name: 'photos', maxCount: 10 },
  { name: 'video',  maxCount: 1  }
]);