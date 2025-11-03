import React, { useState, useEffect } from 'react';
import { usePWA } from '../contexts/PWAContext';
import './OfflineIndicator.css';

const OfflineIndicator = () => {
  const { isOnline, queuedRequestsCount, retryQueue } = usePWA();
  const [showBanner, setShowBanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
      setShowSuccess(false);
    } else if (wasOffline && isOnline) {
      // Coming back online
      setShowSuccess(true);
      setShowBanner(false);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setWasOffline(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  const handleRetry = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      await retryQueue();
    } catch (error) {
      console.error('Manual retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (showSuccess) {
    return (
      <div className="offline-indicator online-indicator-banner" role="alert" aria-live="polite">
        <div className="offline-indicator-content">
          <span className="offline-icon success-icon">✓</span>
          <span className="offline-message">
            Back online! {queuedRequestsCount > 0 && 'Retrying queued requests...'}
          </span>
        </div>
      </div>
    );
  }

  if (!showBanner) {
    return null;
  }

  return (
    <div className="offline-indicator offline-indicator-banner" role="alert" aria-live="polite">
      <div className="offline-indicator-content">
        <div className="offline-status">
          <span className="offline-icon">📡</span>
          <div className="offline-info">
            <span className="offline-message">You are currently offline</span>
            {queuedRequestsCount > 0 && (
              <span className="queued-requests">
                {queuedRequestsCount} request{queuedRequestsCount !== 1 ? 's' : ''} queued for retry
              </span>
            )}
          </div>
          <div className="status-dot"></div>
        </div>
        
        <div className="offline-actions">
          {queuedRequestsCount > 0 && (
            <button 
              className="retry-button" 
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? 'Retrying...' : 'Retry Now'}
            </button>
          )}
          <button className="dismiss-button" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
