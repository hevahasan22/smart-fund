const express = require('express');
const { upload } = require('../cloudinaryConfig');
const app=express()
app.use(express.json())

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Invalid file type. Only PDFs, JPEG, JPG, and PNG are allowed!' });
  }
  res.json({
    message: 'File uploaded successfully!',
    fileUrl: req.file.path // Cloudinary URL
  });
});

module.exports = router;
