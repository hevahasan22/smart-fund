const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middleware/auth');

router.post(
  '/create',
  [
    authMiddleware,
    check('loanID', 'Loan ID is required').not().isEmpty(),
    check('sponsorID_1', 'Primary sponsor is required').not().isEmpty(),
    check('sponsorID_2', 'Secondary sponsor is required').not().isEmpty(),
    check('employmentStatus', 'Employment status is required').not().isEmpty()
  ],
  contractController.createContract
);

module.exports = router;