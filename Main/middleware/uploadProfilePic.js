// middleware/uploadProfilePic.js
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ensure upload folder exists
const uploadDir = path.join(__dirname, '../public/uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // if we have a logged-in user, use their ID; otherwise fall back to timestamp
    const idOrTimestamp = req.session.user?.id || Date.now();
    cb(null, `profile-${idOrTimestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else                                    cb(new Error('Only images allowed'), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('profile_picture');