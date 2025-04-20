const express=require('express')
const app = express();
app.use(express.json())
const upload=require('../middleware/multer')

exports.uploadAfil = (req, res) => {
  console.log('🚀 Incoming request headers:', req.headers);
  console.log('🚀 Incoming request body:', req.body);
  console.log('✅ File received:', req.file);

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded!" });
  }

  res.status(200).json({
    success: true,
    message: "Uploaded!",
    data: req.file, // or req.file.path if using Cloudinary
  });
};