// middleware/uploadPropertyMedia.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const multerS3 = require('multer-s3');
const { getSpacesClient, isSpacesEnabled } = require('../config/spaces');

const hasSpaces = isSpacesEnabled();
const privateConfBase = path.join(__dirname, '../private/uploads/confidential');
const privateConfTempBase = path.join(privateConfBase, '__temp__');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeName(name) {
  return String(name || 'file')
    .replace(/\s+/g, '-')
    .replace(/[^\w.-]/g, '') || 'file';
}

function confidentialDestination(req) {
  const propertyId = req.params && req.params.id ? String(req.params.id) : null;
  if (propertyId) return path.join(privateConfBase, 'properties', propertyId);
  const ownerPart = (req.session && req.session.user && req.session.user.id) ? `user-${req.session.user.id}` : 'anonymous';
  return path.join(privateConfTempBase, ownerPart);
}

const confidentialDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = confidentialDestination(req);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  }
});

let storage;
if (hasSpaces) {
  const s3 = getSpacesClient();
  const spacesStorage = multerS3({
    s3,
    bucket: process.env.SPACES_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const safe = safeName(file.originalname);
      const propertyId = req.params && req.params.id ? String(req.params.id) : null;
      const ownerPart = (req.session && req.session.user && req.session.user.id) ? `user-${req.session.user.id}` : 'anonymous';
      const folder = propertyId
        ? `Properties/${propertyId}`
        : `Properties/__temp__/${ownerPart}`;
      cb(null, `${folder}/${file.fieldname}-${Date.now()}-${safe}`);
    }
  });
  storage = {
    _handleFile(req, file, cb) {
      if (file.fieldname === 'confidential_docs') return confidentialDiskStorage._handleFile(req, file, cb);
      return spacesStorage._handleFile(req, file, cb);
    },
    _removeFile(req, file, cb) {
      if (file.fieldname === 'confidential_docs') return confidentialDiskStorage._removeFile(req, file, cb);
      return spacesStorage._removeFile(req, file, cb);
    }
  };
} else {
  // Local disk fallback for development.
  const uploadDir = path.join(__dirname, '../public/uploads/properties');
  ensureDir(uploadDir);
  const publicDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${safeName(file.originalname)}`)
  });
  storage = {
    _handleFile(req, file, cb) {
      if (file.fieldname === 'confidential_docs') return confidentialDiskStorage._handleFile(req, file, cb);
      return publicDiskStorage._handleFile(req, file, cb);
    },
    _removeFile(req, file, cb) {
      if (file.fieldname === 'confidential_docs') return confidentialDiskStorage._removeFile(req, file, cb);
      return publicDiskStorage._removeFile(req, file, cb);
    }
  };
}

const fileFilter = (req, file, cb) => {
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
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'confidential_docs') {
    if (docsAllowedMime.has(file.mimetype) || docsAllowedExt.has(ext)) return cb(null, true);
    return cb(null, false);
  }

  // Property media
  if (file.mimetype.startsWith('image/') || file.fieldname === 'video') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max per file
}).fields([
  { name: 'photos', maxCount: 20 },
  { name: 'video',  maxCount: 1  },
  { name: 'floorplan', maxCount: 1 },
  { name: 'plan_photo', maxCount: 1 },
  { name: 'confidential_docs', maxCount: 20 }
]);