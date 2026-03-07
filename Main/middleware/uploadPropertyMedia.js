// middleware/uploadPropertyMedia.js
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
      const safe = (file.originalname || 'file')
        .replace(/\s+/g, '-')
        .replace(/[^\w.-]/g, '');
      const propertyId = req.params && req.params.id ? String(req.params.id) : null;
      const ownerPart = (req.session && req.session.user && req.session.user.id) ? `user-${req.session.user.id}` : 'anonymous';
      const folder = propertyId
        ? `Properties/${propertyId}`
        : `Properties/__temp__/${ownerPart}`;
      cb(null, `${folder}/${file.fieldname}-${Date.now()}-${safe}`);
    }
  });
} else {
  // Local disk fallback for development.
  const uploadDir = path.join(__dirname, '../public/uploads/properties');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + file.originalname;
      cb(null, unique);
    }
  });
}

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