const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const sponsorValidator = require('../middleware/sponsorValidator');
const auth = require('../middleware/auth');

// Apply for new loan contract
router.post(
  '/',
  auth,
  sponsorValidator,
  contractController.createContract
);

// Get user contracts
router.get(
  '/my-contracts',
  auth,
  contractController.getUserContracts
);

module.exports = router;