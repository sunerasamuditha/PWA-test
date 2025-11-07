import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// Only register service worker in production
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
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
  }).catch((error) => {
    console.error('Failed to import service worker module:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);