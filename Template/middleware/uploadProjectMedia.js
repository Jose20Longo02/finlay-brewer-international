const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ensure upload folder exists and store files under public/uploads/projects
const uploadDir = path.join(__dirname, '../public/uploads/projects');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext).toLowerCase();
  const safeBase = base
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${Date.now()}-${safeBase}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, sanitizeFilename(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.fieldname === 'video' && file.mimetype.startsWith('video/');
  const isPdf   = file.fieldname === 'brochure' && (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf'));
  if (isImage || isVideo || isPdf) return cb(null, true);
  return cb(null, false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB per file
}).fields([
  { name: 'photos',   maxCount: 20 },
  { name: 'video',    maxCount: 1  },
  { name: 'brochure', maxCount: 1  }
]);


