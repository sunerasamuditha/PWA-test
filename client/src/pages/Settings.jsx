import React, { useState, useEffect } from 'react';
import { usePWA } from '../contexts/PWAContext';
import { clearAllFailedRequests, getQueueSize } from '../utils/requestQueue';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, getCurrentSubscription } from '../utils/pushNotifications';
import { apiService } from '../services/api';

const Settings = () => {
  const {
    isOnline,
    isInstalled,
    isInstallable,
    queuedRequestsCount,
    promptInstall,
    retryQueue
  } = usePWA();

  const [cacheSize, setCacheSize] = useState('Calculating...');
  const [isClearing, setIsClearing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState('default');

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setNotificationsPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === 'granted');
    }

    // Estimate cache size
    estimateCacheSize();
  }, []);

  const estimateCacheSize = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        const usageMB = (usage / (1024 * 1024)).toFixed(2);
        const quotaMB = (quota / (1024 * 1024)).toFixed(2);
        const percentage = quota > 0 ? ((usage / quota) * 100).toFixed(1) : 0;
        
        setCacheSize(`${usageMB} MB / ${quotaMB} MB (${percentage}%)`);
      } else {
        setCacheSize('Not available');
      }
    } catch (error) {
      console.error('Error estimating cache size:', error);
      setCacheSize('Error calculating');
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the app cache? This will remove all offline data and the app will reload.')) {
      return;
    }

    setIsClearing(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear failed requests queue
      await clearAllFailedRequests();

      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      alert('Cache cleared successfully. The app will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to clear all queued requests?')) {
      return;
    }

    try {
      await clearAllFailedRequests();
      alert('Request queue cleared successfully.');
    } catch (error) {
      console.error('Error clearing queue:', error);
      alert('Failed to clear request queue.');
    }
  };

  const handleRetryQueue = async () => {
    setIsRetrying(true);
    try {
      await retryQueue();
    } catch (error) {
      console.error('Error retrying queue:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleInstallApp = async () => {
    try {
      const accepted = await promptInstall();
      if (accepted) {
        alert('App installed successfully!');
      }
    } catch (error) {
      console.error('Installation error:', error);
      alert('Failed to install app.');
    }
  };

  const handleRequestNotificationPermission = async () => {
    try {
      if (!('Notification' in window)) {
        alert('Notifications are not supported in this browser.');
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationsPermission(permission);
      setNotificationsEnabled(permission === 'granted');

      if (permission === 'granted') {
        // Get VAPID public key from server
        const publicKeyResponse = await apiService.notifications.getPublicKey();
        const vapidPublicKey = publicKeyResponse.data.publicKey;

        if (!vapidPublicKey) {
          alert('Failed to retrieve VAPID public key from server.');
          return;
        }

        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications(vapidPublicKey);

        // Send subscription to server
        await apiService.notifications.subscribe(subscription);

        alert('Notifications enabled successfully!');
      } else if (permission === 'denied') {
        alert('Notification permission denied. You can enable it in your browser settings.');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      alert('Failed to request notification permission.');
    }
  };

  return (
    <div className="page">
      <h1>Settings</h1>

      {/* PWA Section */}
      <div className="settings-pwa-section">
        <h3>Progressive Web App (PWA)</h3>

        <div className="pwa-status-grid">
          <div className="pwa-status-item">
            <h4>Connection Status</h4>
            <div className="pwa-status-value">
              <span className={`pwa-status-badge ${isOnline ? 'online' : 'offline'}`}>
                <span className="status-dot"></span>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="pwa-status-item">
            <h4>Installation Status</h4>
            <div className="pwa-status-value">
              <span className={`pwa-status-badge ${isInstalled ? 'installed' : 'not-installed'}`}>
                {isInstalled ? 'Installed' : 'Not Installed'}
              </span>
            </div>
          </div>

          <div className="pwa-status-item">
            <h4>Queued Requests</h4>
            <div className="pwa-status-value">
              {queuedRequestsCount}
            </div>
          </div>

          <div className="pwa-status-item">
            <h4>Notifications</h4>
            <div className="pwa-status-value">
              <span className={`pwa-status-badge ${notificationsEnabled ? 'installed' : 'not-installed'}`}>
                {notificationsPermission === 'granted' ? 'Enabled' : 
                 notificationsPermission === 'denied' ? 'Blocked' : 'Not Set'}
              </span>
            </div>
          </div>
        </div>

        <div className="cache-info">
          <h4>Storage Usage</h4>
          <div className="cache-info-grid">
            <div className="cache-info-item">
              <span className="cache-info-label">Cache Size</span>
              <span className="cache-info-value">{cacheSize}</span>
            </div>
          </div>
        </div>

        <div className="pwa-actions">
          {isInstallable && !isInstalled && (
            <button 
              className="pwa-action-button" 
              onClick={handleInstallApp}
            >
              Install App
            </button>
          )}

          {queuedRequestsCount > 0 && (
            <>
              <button 
                className="pwa-action-button" 
                onClick={handleRetryQueue}
                disabled={isRetrying || !isOnline}
              >
                {isRetrying ? 'Retrying...' : 'Retry Queued Requests'}
              </button>
              <button 
                className="pwa-action-button secondary" 
                onClick={handleClearQueue}
              >
                Clear Request Queue
              </button>
            </>
          )}

          {notificationsPermission !== 'granted' && (
            <button 
              className="pwa-action-button" 
              onClick={handleRequestNotificationPermission}
              disabled={notificationsPermission === 'denied'}
            >
              {notificationsPermission === 'denied' 
                ? 'Notifications Blocked' 
                : 'Enable Notifications'}
            </button>
          )}

          <button 
            className="pwa-action-button danger" 
            onClick={handleClearCache}
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear Cache & Reload'}
          </button>
        </div>
      </div>

      {/* Other Settings Sections */}
      <div className="card">
        <h2>Account Settings</h2>
        <p>Manage your account preferences and security settings.</p>
        <div className="mt-4">
          <button className="btn btn-primary me-2">Edit Profile</button>
          <button className="btn btn-secondary">Change Password</button>
        </div>
      </div>

      <div className="card mt-4">
        <h2>Privacy & Data</h2>
        <p>Control how your data is used and stored.</p>
        <div className="mt-4">
          <label className="d-flex align-items-center">
            <input type="checkbox" className="me-2" />
            <span>Allow analytics and usage tracking</span>
          </label>
          <label className="d-flex align-items-center mt-2">
            <input type="checkbox" className="me-2" />
            <span>Share data for service improvements</span>
          </label>
        </div>
      </div>

      <div className="card mt-4">
        <h2>Appearance</h2>
        <p>Customize the look and feel of the app.</p>
        <div className="mt-4">
          <label className="d-flex align-items-center">
            <span className="me-2">Theme:</span>
            <select className="form-control" style={{ maxWidth: '200px' }}>
              <option>Light</option>
              <option>Dark</option>
              <option>Auto</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
