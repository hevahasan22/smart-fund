const express = require('express');
const router = express.Router();
const sponsorController = require('../controllers/sponsorController');


router.post('/', sponsorController.createSponsor); 
router.get('/:sponsorID/availability', sponsorController.checkSponsorAvailability);

module.exports = router;