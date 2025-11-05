// Push Notification Utility for Progressive Web App
// Handles subscription management and push notification interactions

/**
 * Convert base64 URL-safe string to Uint8Array
 * Required for VAPID public key conversion
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Serialize PushSubscription safely for cross-browser compatibility
 * @param {PushSubscription} subscription - The push subscription to serialize
 * @returns {Object} Serialized subscription object
 */
function serializeSubscription(subscription) {
  // Try to use toJSON if available (modern browsers)
  if (subscription.toJSON) {
    return subscription.toJSON();
  }

  // Fallback for older browsers: manually serialize
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: p256dh ? arrayBufferToBase64(p256dh) : null,
      auth: auth ? arrayBufferToBase64(auth) : null
    }
  };
}

/**
 * Request notification permission from user
 * @returns {Promise<string>} Permission state: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser');
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Get current notification permission status
 * @returns {string} Permission state: 'granted', 'denied', or 'default'
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Subscribe to push notifications
 * @param {string} vapidPublicKey - VAPID public key from server
 * @returns {Promise<PushSubscription>} Push subscription object
 */
export async function subscribeToPushNotifications(vapidPublicKey) {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      throw new Error('Notifications are not supported');
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers are not supported');
    }

    if (!('PushManager' in window)) {
      throw new Error('Push notifications are not supported');
    }

    // Request permission if not already granted
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return serializeSubscription(existingSubscription);
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    return serializeSubscription(subscription);
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 * @returns {Promise<boolean>} True if unsubscribed successfully
 */
export async function unsubscribeFromPushNotifications() {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const successful = await subscription.unsubscribe();
      return successful;
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw error;
  }
}

/**
 * Get current push subscription
 * @returns {Promise<Object|null>} Serialized subscription or null
 */
export async function getCurrentSubscription() {
  try {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? serializeSubscription(subscription) : null;
  } catch (error) {
    console.error('Error getting current subscription:', error);
    return null;
  }
}

/**
 * Check if push notifications are supported
 * @returns {boolean} True if supported
 */
export function isPushNotificationSupported() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Show a local notification (does not require server)
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 * @returns {Promise<void>}
 */
export async function showLocalNotification(title, options = {}) {
  try {
    if (!('Notification' in window)) {
      throw new Error('Notifications are not supported');
    }

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    if ('serviceWorker' in navigator) {
      // Show via service worker for better persistence
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        ...options
      });
    } else {
      // Fallback to direct notification
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        ...options
      });
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    throw error;
  }
}

/**
 * Test push notification by showing a local notification
 * @returns {Promise<void>}
 */
export async function testNotification() {
  await showLocalNotification('WeCare Test Notification', {
    body: 'Push notifications are working correctly!',
    tag: 'test-notification',
    requireInteraction: false
  });
}
