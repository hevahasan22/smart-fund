const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const ctrl = require('../controllers/notificationsController');

router.use(authenticate);

router.get('/', asyncHandler(ctrl.list));
router.get('/unread-count', asyncHandler(ctrl.unreadCount));
router.patch('/:id/read', asyncHandler(ctrl.markAsRead));
router.patch('/mark-all-read', asyncHandler(ctrl.markAllAsRead));
router.delete('/', asyncHandler(ctrl.clearAll));

module.exports = router; 