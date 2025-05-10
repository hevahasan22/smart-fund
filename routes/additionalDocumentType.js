const express = require('express');
const router = express.Router();
const additionalDocumentTypeController = require('../controllers/additionalDocumentTypeController');
const auth = require('../middleware/auth');

router.post('/', auth, additionalDocumentTypeController.createDocumentType);

module.exports = router;