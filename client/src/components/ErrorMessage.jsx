import React, { useState, useEffect } from 'react';
import './ErrorMessage.css';

const ErrorMessage = ({ 
  message, 
  type = 'error', 
  onClose, 
  autoHide = false, 
  duration = 5000,
  showIcon = true,
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoHide, duration]);

  // Handle close
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(() => onClose(), 300); // Wait for animation to complete
    }
  };

  // Get icon based on message type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'error':
      default:
        return '❌';
    }
  };

  // Get ARIA role based on type
  const getAriaRole = () => {
    switch (type) {
      case 'success':
      case 'info':
        return 'status';
      case 'warning':
      case 'error':
      default:
        return 'alert';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={`error-message ${type} ${className}`}
      role={getAriaRole()}
      aria-live="polite"
    >
      <div className="error-content">
        {showIcon && (
          <span className="error-icon" aria-hidden="true">
            {getIcon()}
          </span>
        )}
        <span className="error-text">{message}</span>
      </div>
      
      {onClose && (
        <button 
          className="error-close"
          onClick={handleClose}
          aria-label="Close message"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;