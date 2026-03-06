// middleware/uploadPropertyMedia.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');

const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

let storage;
if (hasCloudinary) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const isVideo = file.fieldname === 'video' || file.mimetype.startsWith('video/');
      return {
        folder: 'realestate/properties',
        resource_type: isVideo ? 'video' : 'image',
        public_id: `${Date.now()}-${(file.originalname || 'file').replace(/\s+/g, '-').replace(/[^\w.-]/g, '')}`
      };
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