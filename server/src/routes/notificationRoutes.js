const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/notifications/public-key
 * @desc    Get VAPID public key for push notifications
 * @access  Public
 */
router.get('/public-key', notificationController.getPublicKey);

/**
 * @route   POST /api/notifications/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private (any authenticated user)
 */
router.post('/subscribe', authenticate, notificationController.subscribe);

/**
 * @route   POST /api/notifications/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private (any authenticated user)
 */
router.post('/unsubscribe', authenticate, notificationController.unsubscribe);

/**
 * @route   GET /api/notifications/subscription-status
 * @desc    Get subscription status for current user
 * @access  Private (any authenticated user)
 */
router.get('/subscription-status', authenticate, notificationController.getSubscriptionStatus);

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification to current user
 * @access  Private (any authenticated user)
 */
router.post('/test', authenticate, notificationController.sendTestNotification);

/**
 * @route   POST /api/notifications/send-to-users
 * @desc    Send notification to specific users
 * @access  Private (admin/super_admin only)
 */
router.post(
  '/send-to-users',
  authenticate,
  authorize(['admin', 'super_admin']),
  notificationController.sendToUsers
);

/**
 * @route   POST /api/notifications/send-to-role
 * @desc    Send notification to all users with specific role
 * @access  Private (admin/super_admin only)
 */
router.post(
  '/send-to-role',
  authenticate,
  authorize(['admin', 'super_admin']),
  notificationController.sendToRole
);

/**
 * @route   POST /api/notifications/broadcast
 * @desc    Broadcast notification to all users
 * @access  Private (admin/super_admin only)
 */
router.post(
  '/broadcast',
  authenticate,
  authorize(['admin', 'super_admin']),
  notificationController.broadcast
);

module.exports = router;
