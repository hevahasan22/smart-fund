const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadAfil = async (req, res) => {
  try {
    console.log('🚀 Headers:', req.headers);
    console.log('🚀 Body:', req.body);
    console.log('✅ File:', req.file);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded!' });
    }

    // Stream upload to Cloudinary
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'uploads', // Specify your Cloudinary folder
            resource_type: 'auto', // Automatically detect file type (image, pdf, etc.)
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req.file.buffer);

    res.status(200).json({
      success: true,
      message: 'File uploaded to Cloudinary!',
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        asset_id: result.asset_id,
      },
    });
  } catch (error) {
    console.error('❌ Upload failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudinary upload failed',
      error: error.message,
    });
  }
};