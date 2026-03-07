// middleware/uploadProfilePic.js
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
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
      const ext = path.extname(file.originalname) || '.jpg';
      const userId = req.session && req.session.user && req.session.user.id ? String(req.session.user.id) : null;
      const folder = userId
        ? `Profiles/${userId}`
        : 'Profiles/__temp__';
      cb(null, `${folder}/profile-${Date.now()}${ext}`);
    }
  });
} else {
  // ensure upload folder exists
  const uploadDir = path.join(__dirname, '../public/uploads/profiles');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const idOrTimestamp = req.session.user?.id || Date.now();
      cb(null, `profile-${idOrTimestamp}${ext}`);
    }
  });
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else                                    cb(new Error('Only images allowed'), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('profile_picture');