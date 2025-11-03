import React, { useState, useEffect } from 'react';
import { getNotificationPermission, requestNotificationPermission, subscribeToPushNotifications } from '../utils/pushNotifications';
import { apiService } from '../services/api';

const NotificationPermissionPrompt = () => {
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    // Show prompt if permission is default (not yet asked)
    if (currentPermission === 'default') {
      // Wait a bit before showing to avoid overwhelming user
      const timer = setTimeout(() => {
        // Check if user has dismissed before
        const dismissed = localStorage.getItem('notification-prompt-dismissed');
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 60000); // Show after 1 minute

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAllow = async () => {
    setIsRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Get VAPID public key from server
        const publicKeyResponse = await apiService.notifications.getPublicKey();
        const vapidPublicKey = publicKeyResponse.data.publicKey;

        if (!vapidPublicKey) {
          console.error('Failed to retrieve VAPID public key from server.');
          return;
        }

        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications(vapidPublicKey);

        // Send subscription to server
        await apiService.notifications.subscribe(subscription);

        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || permission !== 'default') {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.prompt}>
        <div style={styles.iconContainer}>
          <svg 
            style={styles.icon} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        <div style={styles.content}>
          <h3 style={styles.title}>Stay Updated</h3>
          <p style={styles.message}>
            Enable notifications to receive appointment reminders and important updates
          </p>
        </div>

        <div style={styles.actions}>
          <button 
            style={styles.allowButton} 
            onClick={handleAllow}
            disabled={isRequesting}
          >
            {isRequesting ? 'Requesting...' : 'Allow'}
          </button>
          <button 
            style={styles.dismissButton} 
            onClick={handleDismiss}
          >
            Not Now
          </button>
        </div>

        <button 
          style={styles.closeButton} 
          onClick={handleDismiss}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    zIndex: 9997,
    animation: 'slideInUp 0.4s ease-out'
  },
  prompt: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
    minWidth: '350px',
    maxWidth: '400px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    position: 'relative',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  iconContainer: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    width: '24px',
    height: '24px',
    color: 'white'
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '600'
  },
  message: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.4',
    opacity: 0.9
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexShrink: 0,
    marginTop: '4px'
  },
  allowButton: {
    background: 'white',
    color: '#10b981',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '13px',
    minWidth: '100px'
  },
  dismissButton: {
    background: 'transparent',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    padding: '6px 16px',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '12px'
  },
  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: 'none',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    transition: 'all 0.2s'
  }
};

export default NotificationPermissionPrompt;
