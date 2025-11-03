import React, { useState, useEffect } from 'react';
import { usePWA } from '../contexts/PWAContext';
import './InstallPrompt.css';

const InstallPrompt = () => {
  const { isInstallable, isInstalled, promptInstall, dismissInstall } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the prompt recently
    const dismissedTimestamp = localStorage.getItem('install-prompt-dismissed');
    if (dismissedTimestamp) {
      const daysSinceDismissal = (Date.now() - parseInt(dismissedTimestamp)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < 7) {
        // Don't show again for 7 days
        return;
      }
    }

    // Show prompt after delay (avoid immediate annoyance)
    if (isInstallable && !isInstalled) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 30000); // Show after 30 seconds

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    dismissInstall();
    setShowPrompt(false);
    
    // Store dismissal timestamp
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-banner">
        <div className="install-prompt-content">
          <div className="install-prompt-icon">
            <div className="app-icon">WC</div>
          </div>
          
          <div className="install-prompt-info">
            <h3 className="install-prompt-title">Install WeCare PWA</h3>
            <p className="install-prompt-message">
              Get quick access and enhanced experience
            </p>
            
            <ul className="install-benefits-list">
              <li>Access offline</li>
              <li>Faster loading</li>
              <li>Home screen shortcut</li>
              <li>Native app experience</li>
            </ul>
          </div>
          
          <div className="install-prompt-actions">
            <button 
              className="install-button" 
              onClick={handleInstall}
              disabled={isInstalling}
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
            <button 
              className="dismiss-button" 
              onClick={handleDismiss}
            >
              Not Now
            </button>
          </div>
          
          <button 
            className="close-button" 
            onClick={handleDismiss}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
