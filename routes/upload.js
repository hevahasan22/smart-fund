const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { uploadAfil } = require('../controllers/upload');

// Route for file upload
router.post('/upload', upload.single('file'), uploadAfil);

module.exports = router;