const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');  // Make sure this is the correct path

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads',  // Cloudinary folder
    format: async (req, file) => file.mimetype.split('/')[1], // Use dynamic format
    public_id: (req, file) => file.originalname.split('.')[0]  // Use filename without extension
  }
});

// Initialize multer with Cloudinary storage
const upload = multer({ storage });

module.exports = upload;
