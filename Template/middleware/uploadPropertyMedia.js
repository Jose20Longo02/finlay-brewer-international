// middleware/uploadPropertyMedia.js
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ensure upload folder exists and store files under public/uploads/properties
const uploadDir = path.join(__dirname, '../public/uploads/properties');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
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
  { name: 'photos', maxCount: 20 },
  { name: 'video',  maxCount: 1  },
  { name: 'floorplan', maxCount: 1 },
  { name: 'plan_photo', maxCount: 1 }
]);