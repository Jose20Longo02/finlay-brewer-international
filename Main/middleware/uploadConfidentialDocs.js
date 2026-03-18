const multer = require('multer');
const path = require('path');
const fs = require('fs');
const multerS3 = require('multer-s3');
const { getSpacesClient, isSpacesEnabled } = require('../config/spaces');

const privateConfBase = path.join(__dirname, '../private/uploads/confidential');
const hasSpaces = isSpacesEnabled();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let storage;
if (hasSpaces) {
  const s3 = getSpacesClient();
  storage = multerS3({
    s3,
    bucket: process.env.SPACES_BUCKET,
    acl: 'private',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const propertyId = req.params && req.params.id ? String(req.params.id) : 'unknown';
      const safe = String(file.originalname || 'file').replace(/\s+/g, '-').replace(/[^\w.-]/g, '') || 'file';
      cb(null, `Properties/${propertyId}/Confidential Info/confidential-${Date.now()}-${safe}`);
    }
  });
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const propertyId = req.params && req.params.id ? String(req.params.id) : 'unknown';
      const dest = path.join(privateConfBase, 'properties', propertyId);
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    }
  });
}

const docsAllowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const docsAllowedExt = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (docsAllowedMime.has(file.mimetype) || docsAllowedExt.has(ext)) return cb(null, true);
  return cb(null, false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
}).array('confidential_docs', 20);
