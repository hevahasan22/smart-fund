const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler'); // Recommended instead of wrapping each route

// Import route handlers
const userRoutes = require('./userAuth');
const uploadRoutes = require('./upload');
const contractRoutes = require('./contract');
const paymentRoutes = require('./payment');
const loanRoutes = require('./loan');
const investorRoutes = require('./investor');
const typeTermRoutes = require('./typeTerm');
const loanTypeRoutes = require('./loanType');
const loanTermRoutes = require('./loanTerm');
const adminRoutes=require('./admin');
const docTypeRoutes=require('./additionalDocumentType');
const docRouts=require('./additionalDocumet');
const relationRoutes=require('./documentTypeTermRelation');
const notificationRoutes=require('./notifications');

// Mount routes with proper error handling
router.use('/upload', asyncHandler(uploadRoutes));
router.use('/users', asyncHandler(userRoutes));
router.use('/contracts', asyncHandler(contractRoutes));
router.use('/payments', asyncHandler(paymentRoutes));
router.use('/loans', asyncHandler(loanRoutes));
router.use('/investors', asyncHandler(investorRoutes));
router.use('/type-terms', asyncHandler(typeTermRoutes));
router.use('/loan-types', asyncHandler(loanTypeRoutes));
router.use('/loan-terms', asyncHandler(loanTermRoutes));
router.use('/admins',asyncHandler(adminRoutes));
router.use('/docTypes', asyncHandler(docTypeRoutes));
router.use('/docs', asyncHandler(docRouts));
router.use('/document-relations', asyncHandler(relationRoutes));
router.use('/notifications', asyncHandler(notificationRoutes));

// Export the router
module.exports = router;