const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

class NotificationService {
  constructor() {
    // Initialize VAPID keys from environment variables
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@wecare.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webPush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
      );
      console.log('Web push VAPID configured');
    } else {
      console.warn('VAPID keys not configured. Push notifications will not work.');
      console.warn('Generate keys using: npx web-push generate-vapid-keys');
    }
  }

  /**
   * Get VAPID public key
   * @returns {string} VAPID public key
   */
  getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  /**
   * Subscribe user to push notifications
   * @param {number} userId - User ID
   * @param {Object} subscription - Push subscription object from client
   * @param {string} userAgent - User agent string
   * @returns {Promise<Object>} Created subscription
   */
  async subscribe(userId, subscription, userAgent = null) {
    try {
      // Check if subscription already exists
      const existing = await PushSubscription.findByEndpoint(subscription.endpoint);
      
      if (existing) {
        // Update existing subscription
        return await PushSubscription.update(existing.id, {
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          user_agent: userAgent,
          is_active: true
        });
      }

      // Create new subscription
      return await PushSubscription.create({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent
      });
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of deactivated subscriptions
   */
  async unsubscribe(userId) {
    try {
      return await PushSubscription.deactivateByUserId(userId);
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a user
   * @param {number} userId - User ID
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send results
   */
  async sendToUser(userId, notification) {
    try {
      const subscriptions = await PushSubscription.findByUserId(userId);
      
      if (subscriptions.length === 0) {
        return {
          success: false,
          message: 'No active subscriptions found for user'
        };
      }

      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendNotification(sub, notification))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: successful > 0,
        total: subscriptions.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   * @param {Array<number>} userIds - Array of user IDs
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send results
   */
  async sendToUsers(userIds, notification) {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification))
      );

      return {
        total: userIds.length,
        results
      };
    } catch (error) {
      console.error('Error sending notifications to users:', error);
      throw error;
    }
  }

  /**
   * Send notification to a specific subscription
   * @param {Object} subscription - Subscription from database
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send result
   */
  async sendNotification(subscription, notification) {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh_key,
          auth: subscription.auth_key
        }
      };

      const payload = JSON.stringify({
        title: notification.title || 'WeCare Notification',
        body: notification.body || '',
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/icon-192x192.png',
        data: notification.data || {},
        ...notification
      });

      const result = await webPush.sendNotification(pushSubscription, payload);

      return {
        success: true,
        statusCode: result.statusCode
      };
    } catch (error) {
      console.error('Error sending push notification:', error);

      // Handle expired/invalid subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log('Subscription expired, deactivating:', subscription.id);
        await PushSubscription.deactivate(subscription.id);
      }

      throw error;
    }
  }

  /**
   * Send notification to all users with a specific role
   * @param {string} role - User role
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send results
   */
  async sendToRole(role, notification) {
    try {
      const subscriptions = await PushSubscription.findAllActive();
      const roleSubscriptions = subscriptions.filter(sub => sub.role === role);

      const results = await Promise.allSettled(
        roleSubscriptions.map(sub => this.sendNotification(sub, notification))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: successful > 0,
        total: roleSubscriptions.length,
        successful,
        failed
      };
    } catch (error) {
      console.error('Error sending notifications to role:', error);
      throw error;
    }
  }

  /**
   * Broadcast notification to all subscribed users
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send results
   */
  async broadcast(notification) {
    try {
      const subscriptions = await PushSubscription.findAllActive();

      const results = await Promise.allSettled(
        subscriptions.map(sub => this.sendNotification(sub, notification))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: successful > 0,
        total: subscriptions.length,
        successful,
        failed
      };
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder notification
   * @param {number} userId - User ID
   * @param {Object} appointment - Appointment data
   * @returns {Promise<Object>} Send result
   */
  async sendAppointmentReminder(userId, appointment) {
    const notification = {
      title: 'Appointment Reminder',
      body: `Your appointment is scheduled for ${appointment.date} at ${appointment.time}`,
      icon: '/icons/icon-192x192.png',
      data: {
        type: 'appointment_reminder',
        appointmentId: appointment.id,
        url: `/appointments/${appointment.id}`
      }
    };

    return await this.sendToUser(userId, notification);
  }

  /**
   * Clean up old inactive subscriptions
   * @returns {Promise<number>} Number of deleted subscriptions
   */
  async cleanup() {
    try {
      const deleted = await PushSubscription.cleanupOld(90);
      console.log(`Cleaned up ${deleted} old push subscriptions`);
      return deleted;
    } catch (error) {
      console.error('Error cleaning up subscriptions:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
