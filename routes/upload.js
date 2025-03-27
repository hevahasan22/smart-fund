const express = require('express');
const router = express.Router();
const upload = require("../middleware/multer");

router.post('/', (req, res, next) => {
  console.log('🚀 Incoming request headers:', req.headers);
  console.log('🚀 Incoming request body:', req.body);
  next();
}, upload.single('file'), (req, res) => {
  console.log('✅ File received:', req.file);

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded!" });
  }

  res.status(200).json({
    success: true,
    message: "Uploaded!",
    data: req.file // Cloudinary URL will be in req.file.path
  });
});

module.exports = router;
