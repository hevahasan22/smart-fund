const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ctrl = require('../controllers/notificationsController');
const contractController = require('../controllers/contractController');

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.get('/unread-count', asyncHandler(ctrl.unreadCount));

// New sponsor requests routes
router.get('/sponsor-requests', asyncHandler(ctrl.listSponsorRequests));
router.get('/sponsor-requests/count', asyncHandler(ctrl.countSponsorRequests));

// Accept/Reject sponsor requests (act on pending approvals)
router.post('/sponsor-requests/:contractId/accept', asyncHandler(contractController.approveContractAsSponsor));
router.post('/sponsor-requests/:contractId/reject', asyncHandler(contractController.rejectContractAsSponsor));

router.patch('/:id/read', asyncHandler(ctrl.markAsRead));
router.patch('/mark-all-read', asyncHandler(ctrl.markAllAsRead));
router.delete('/', asyncHandler(ctrl.clearAll));

// Test endpoint
router.post('/test', asyncHandler(ctrl.testNotification));

module.exports = router; 