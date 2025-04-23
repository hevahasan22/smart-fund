const express = require('express');
const router = express.Router();
const additionalDocumentController = require('../controllers/additionalDocumentController');
const auth = require('../middleware/auth');

router.post('/', auth, additionalDocumentController.uploadDocument);

module.exports = router;