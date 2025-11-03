import React, { createContext, useContext, useState, useEffect } from 'react';
import { retryAllFailedRequests, getQueueSize } from '../utils/requestQueue';
import { apiService } from '../services/api';

const PWAContext = createContext();

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within PWAProvider');
  }
  return context;
};

export const PWAProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [queuedRequestsCount, setQueuedRequestsCount] = useState(0);
  const [workboxInstance, setWorkboxInstance] = useState(null);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      // Retry failed requests when coming back online
      try {
        const result = await retryAllFailedRequests(apiService);
        if (result.success_count > 0) {
          console.log(`Successfully retried ${result.success_count} requests`);
          window.dispatchEvent(new CustomEvent('requests-retried', { detail: result }));
        }
        
        // Update queue count
        const count = await getQueueSize();
        setQueuedRequestsCount(count);
      } catch (error) {
        console.error('Error retrying failed requests:', error);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Detect if app is already installed
  useEffect(() => {
    const checkIfInstalled = () => {
      // Check if running in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = window.navigator.standalone === true;
      
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkIfInstalled();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkIfInstalled);

    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkIfInstalled);
    };
  }, []);

  // Listen to service worker updates
  useEffect(() => {
    const handleSWUpdate = (event) => {
      setUpdateAvailable(true);
      setWorkboxInstance(event.detail.wb);
    };

    window.addEventListener('sw-update-available', handleSWUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleSWUpdate);
    };
  }, []);

  // Periodically check queue size
  useEffect(() => {
    const updateQueueCount = async () => {
      const count = await getQueueSize();
      setQueuedRequestsCount(count);
    };

    // Initial check
    updateQueueCount();

    // Check every 30 seconds
    const interval = setInterval(updateQueueCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen to custom queue events
  useEffect(() => {
    const handleQueueEvent = async () => {
      const count = await getQueueSize();
      setQueuedRequestsCount(count);
    };

    window.addEventListener('request-queued', handleQueueEvent);
    window.addEventListener('request-removed', handleQueueEvent);
    window.addEventListener('queue-cleared', handleQueueEvent);

    return () => {
      window.removeEventListener('request-queued', handleQueueEvent);
      window.removeEventListener('request-removed', handleQueueEvent);
      window.removeEventListener('queue-cleared', handleQueueEvent);
    };
  }, []);

  /**
   * Prompt user to install PWA
   */
  const promptInstall = async () => {
    if (!installPrompt) {
      console.warn('Install prompt not available');
      return false;
    }

    try {
      const result = await installPrompt.prompt();
      const outcome = await installPrompt.userChoice;
      
      if (outcome.outcome === 'accepted') {
        console.log('User accepted install prompt');
        setIsInstallable(false);
        setInstallPrompt(null);
        return true;
      } else {
        console.log('User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  };

  /**
   * Dismiss install prompt
   */
  const dismissInstall = () => {
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  /**
   * Activate waiting service worker update
   */
  const activateUpdate = () => {
    if (!workboxInstance) {
      console.warn('Workbox instance not available');
      return;
    }

    // Send skip waiting message to service worker
    workboxInstance.messageSkipWaiting();

    // Listen for controlling event, then reload
    const handleControlling = () => {
      window.location.reload();
    };
    
    workboxInstance.addEventListener('controlling', handleControlling, { once: true });
  };

  /**
   * Manually retry queued requests
   */
  const retryQueue = async () => {
    try {
      const result = await retryAllFailedRequests(apiService);
      const count = await getQueueSize();
      setQueuedRequestsCount(count);
      return result;
    } catch (error) {
      console.error('Error retrying queue:', error);
      throw error;
    }
  };

  const value = {
    isOnline,
    installPrompt,
    isInstallable,
    isInstalled,
    updateAvailable,
    queuedRequestsCount,
    promptInstall,
    dismissInstall,
    activateUpdate,
    retryQueue
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};
