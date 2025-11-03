import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  fullScreen = false,
  color = '#007bff',
  overlay = false 
}) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const spinnerClass = `loading-spinner ${sizeClasses[size] || sizeClasses.medium}`;

  const SpinnerElement = (
    <div className={spinnerClass}>
      <div 
        className="spinner-circle" 
        style={{ borderTopColor: color }}
      ></div>
      {message && (
        <div className="spinner-message">{message}</div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="spinner-fullscreen">
        {SpinnerElement}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="spinner-overlay">
        {SpinnerElement}
      </div>
    );
  }

  return SpinnerElement;
};

export default LoadingSpinner;