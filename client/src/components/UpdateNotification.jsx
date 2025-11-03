import React, { useState } from 'react';
import { usePWA } from '../contexts/PWAContext';
import './UpdateNotification.css';

const UpdateNotification = () => {
  const { updateAvailable, activateUpdate } = usePWA();
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await activateUpdate();
      // The page will reload automatically
    } catch (error) {
      console.error('Update activation error:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-notification-content">
        <div className="update-icon">
          <svg 
            className="update-icon-svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </div>

        <div className="update-message">
          <h4 className="update-title">Update Available</h4>
          <p className="update-text">
            A new version of WeCare is ready to install
          </p>
        </div>

        <div className="update-actions">
          <button 
            className="update-button" 
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <span className="spinner"></span>
                Updating...
              </>
            ) : (
              'Update Now'
            )}
          </button>
          <button 
            className="later-button" 
            onClick={handleDismiss}
          >
            Later
          </button>
        </div>

        <button 
          className="close-update-button" 
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
