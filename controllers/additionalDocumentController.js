const { AdditionalDocument } = require('../models/additionalDocument');
const cloudinary = require('../utils/upload'); // Import your cloudinary upload utility

exports.uploadDocument = async (req, res) => {
  try {
    const { contractID, typeID } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploadAfil(file); // Use your upload utility
    
    // Create document
    const document = new AdditionalDocument({
      typeID,
      contractID,
      documentFile: {
        url: result.url,
        publicId: result.public_id
      },
      status: 'pending'
    });

    await document.save();
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};