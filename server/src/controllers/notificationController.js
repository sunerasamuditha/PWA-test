const notificationService = require('../services/notificationService');

/**
 * Get VAPID public key for client
 */
exports.getPublicKey = async (req, res, next) => {
  try {
    const publicKey = notificationService.getVapidPublicKey();
    
    if (!publicKey) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Push notifications are not configured on the server'
        }
      });
    }

    res.json({
      success: true,
      data: {
        publicKey
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to push notifications
 */
exports.subscribe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subscription } = req.body;
    const userAgent = req.headers['user-agent'];

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid subscription data'
        }
      });
    }

    const result = await notificationService.subscribe(userId, subscription, userAgent);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      data: {
        subscriptionId: result.id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unsubscribe from push notifications
 */
exports.unsubscribe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const count = await notificationService.unsubscribe(userId);

    res.json({
      success: true,
      message: `Unsubscribed from ${count} subscription(s)`,
      data: {
        unsubscribedCount: count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get subscription status for current user
 */
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const PushSubscription = require('../models/PushSubscription');

    const count = await PushSubscription.countByUserId(userId);
    const subscriptions = await PushSubscription.findByUserId(userId);

    res.json({
      success: true,
      data: {
        isSubscribed: count > 0,
        subscriptionCount: count,
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          userAgent: sub.user_agent,
          createdAt: sub.created_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send test notification
 */
exports.sendTestNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const notification = {
      title: 'WeCare Test Notification',
      body: 'This is a test notification from WeCare PWA',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    };

    const result = await notificationService.sendToUser(userId, notification);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: result
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: result.message || 'No active subscriptions found'
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Send notification to specific users (Admin only)
 */
exports.sendToUsers = async (req, res, next) => {
  try {
    const { userIds, notification } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'userIds must be a non-empty array'
        }
      });
    }

    if (!notification || !notification.title) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Notification must include a title'
        }
      });
    }

    const result = await notificationService.sendToUsers(userIds, notification);

    res.json({
      success: true,
      message: 'Notifications sent',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send notification to role (Admin only)
 */
exports.sendToRole = async (req, res, next) => {
  try {
    const { role, notification } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Role is required'
        }
      });
    }

    if (!notification || !notification.title) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Notification must include a title'
        }
      });
    }

    const result = await notificationService.sendToRole(role, notification);

    res.json({
      success: true,
      message: `Notification sent to ${result.successful} user(s) with role ${role}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Broadcast notification to all users (Admin only)
 */
exports.broadcast = async (req, res, next) => {
  try {
    const { notification } = req.body;

    if (!notification || !notification.title) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Notification must include a title'
        }
      });
    }

    const result = await notificationService.broadcast(notification);

    res.json({
      success: true,
      message: `Broadcast sent to ${result.successful} user(s)`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
