import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-update
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('A new version of WeCare PWA is available!');
      // Dispatch custom event to notify PWA context of update
      window.dispatchEvent(new CustomEvent('sw-update-available', { 
        detail: { updateSW } 
      }));
    },
    onOfflineReady() {
      console.log('WeCare PWA is ready for offline use!');
      // Dispatch custom event for PWA context
      window.dispatchEvent(new CustomEvent('sw-installed'));
    },
    onRegistered(registration) {
      console.log('Service Worker registered:', registration);
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);