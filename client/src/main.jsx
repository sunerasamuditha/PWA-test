import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// Service Worker Registration
if ('serviceWorker' in navigator) {
  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');

    // Service worker installed for the first time
    wb.addEventListener('installed', (event) => {
      if (!event.isUpdate) {
        console.log('WeCare PWA is ready for offline use!');
        // Dispatch custom event for PWA context
        window.dispatchEvent(new CustomEvent('sw-installed'));
      }
    });

    // New service worker is waiting to activate
    wb.addEventListener('waiting', (event) => {
      console.log('A new version of WeCare PWA is available!');
      // Dispatch custom event to notify PWA context of update
      window.dispatchEvent(new CustomEvent('sw-update-available', { 
        detail: { wb } 
      }));
    });

    // New service worker has taken control
    wb.addEventListener('controlling', (event) => {
      console.log('WeCare PWA updated to latest version!');
      // Reload is now handled by PWAContext after skipWaiting
    });

    // Listen for skip waiting message from PWA context
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
        wb.messageSkipWaiting();
      }
    });

    wb.register().catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);