# PWA Testing Guide

## Overview
This guide provides comprehensive instructions for testing Progressive Web App (PWA) features in the WeCare application, including offline functionality, service workers, push notifications, and app installation.

## Prerequisites

### Required Tools
- Modern browser (Chrome/Edge recommended for DevTools)
- HTTPS-enabled server (required for service workers)
- Mobile device or device emulator for testing
- Push notification testing tool (e.g., web-push CLI)

### Environment Setup
```bash
# Install dependencies
cd client
npm install

# Build PWA assets
npm run build

# Serve with HTTPS (required for service workers)
npm run preview -- --host --https
```

## Test Categories

### 1. Service Worker Registration

#### Test 1.1: Service Worker Installs Successfully
**Objective**: Verify service worker registers and installs correctly

**Steps**:
1. Open application in browser
2. Open DevTools → Application → Service Workers
3. Verify service worker shows as "activated and running"
4. Check for registration errors in Console

**Expected Results**:
- Service worker status: "activated"
- No registration errors
- Service worker scope: `/` (root)

**Code Reference**:
```javascript
// client/src/main.jsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.error('SW registration failed:', err));
  });
}
```

#### Test 1.2: Service Worker Updates on Code Changes
**Objective**: Verify service worker updates when new version deployed

**Steps**:
1. Note current service worker version
2. Make code change and rebuild
3. Refresh page
4. Check for "waiting to activate" service worker
5. Click "Skip waiting" or hard refresh

**Expected Results**:
- New service worker appears as "waiting"
- After activation, new version runs
- Old cache cleared

---

### 2. Offline Functionality

#### Test 2.1: App Loads Offline
**Objective**: Verify app shell loads when offline

**Steps**:
1. Load app while online
2. Open DevTools → Application → Service Workers
3. Check "Offline" checkbox
4. Refresh page

**Expected Results**:
- App shell loads from cache
- No network errors
- Offline indicator shows (if implemented)
- Navigation works for cached routes

#### Test 2.2: API Requests Fail Gracefully Offline
**Objective**: Verify offline error handling for API calls

**Steps**:
1. Enable offline mode
2. Try to load dynamic content (appointments, documents)
3. Observe error messages

**Expected Results**:
- User-friendly offline message displayed
- App doesn't crash
- Cached data shown if available
- Retry mechanism offered

#### Test 2.3: Form Submissions Queue Offline
**Objective**: Verify background sync queues offline submissions

**Steps**:
1. Fill out form (e.g., appointment booking)
2. Enable offline mode
3. Submit form
4. Disable offline mode

**Expected Results**:
- Form queues for submission
- Success message: "Will submit when online"
- Request sends when reconnected
- User notified of success

**Implementation Note**: Requires Background Sync API
```javascript
// Service worker background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-appointments') {
    event.waitUntil(syncAppointments());
  }
});
```

---

### 3. Caching Strategies

#### Test 3.1: Static Assets Cached (Cache-First)
**Objective**: Verify static files served from cache

**Steps**:
1. Load app and check Network tab
2. Note resources loaded from cache
3. Disable network
4. Refresh page
5. Check sources of loaded resources

**Expected Results**:
- Static assets (JS, CSS, images) from cache
- No network requests for cached files
- Fast load times

**Cache Strategy**:
```javascript
// Cache-first for static assets
workbox.routing.registerRoute(
  /\.(?:js|css|png|jpg|jpeg|svg|gif)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);
```

#### Test 3.2: API Requests Use Network-First
**Objective**: Verify API calls prioritize network

**Steps**:
1. Load app and make API request
2. Check Network tab timing
3. Enable offline mode
4. Make same API request
5. Check if cached response shown

**Expected Results**:
- Online: Fresh data from network
- Offline: Cached response if available
- Appropriate staleness indicators

**Cache Strategy**:
```javascript
// Network-first for API calls
workbox.routing.registerRoute(
  /\/api\/.*/,
  new workbox.strategies.NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);
```

---

### 4. Push Notifications

#### Test 4.1: Request Notification Permission
**Objective**: Verify permission request flow

**Steps**:
1. Fresh browser profile (no existing permissions)
2. Click "Enable Notifications" button
3. Observe permission prompt

**Expected Results**:
- Browser shows permission dialog
- Choice persists across sessions
- Denied: Feature gracefully disabled
- Granted: Subscription created

**Code Reference**:
```javascript
async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await subscribeToPushNotifications();
  }
}
```

#### Test 4.2: Subscribe to Push Notifications
**Objective**: Verify push subscription creation

**Steps**:
1. Grant notification permission
2. Check subscription object created
3. Verify subscription sent to server

**Expected Results**:
- PushSubscription object exists
- Endpoint URL valid
- Auth keys generated
- Server stores subscription

**Verification**:
```javascript
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.getSubscription();
console.log('Subscription:', subscription);
```

#### Test 4.3: Receive Push Notification
**Objective**: Test receiving and displaying push notifications

**Steps**:
1. Subscribe to push notifications
2. Send test push using server endpoint
3. Observe notification

**Expected Results**:
- Notification appears (even if app closed)
- Title, body, icon display correctly
- Click opens app to relevant page

**Server Test**:
```bash
# Using web-push CLI
web-push send-notification \
  --endpoint="<subscription-endpoint>" \
  --key="<p256dh-key>" \
  --auth="<auth-secret>" \
  --payload='{"title":"Test","body":"Testing push"}'
```

**Service Worker Handler**:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url }
    })
  );
});
```

#### Test 4.4: Notification Click Action
**Objective**: Verify notification click opens app

**Steps**:
1. Receive push notification
2. Click notification
3. Observe app behavior

**Expected Results**:
- App opens/focuses
- Navigates to relevant page (appointment details, etc.)
- Notification dismissed

**Implementation**:
```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

---

### 5. App Installation (Add to Home Screen)

#### Test 5.1: Install Prompt Appears
**Objective**: Verify beforeinstallprompt event fires

**Steps**:
1. Visit app on mobile or desktop Chrome
2. Use app (triggers engagement heuristic)
3. Check for install banner/prompt

**Expected Results**:
- Install prompt appears automatically OR
- Custom "Install App" button shows
- Prompt deferred for custom timing

**Code Reference**:
```javascript
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install outcome:', outcome);
  deferredPrompt = null;
}
```

#### Test 5.2: Install PWA on Mobile
**Objective**: Install and launch from home screen

**Steps**:
1. On Android Chrome: Tap "Add to Home Screen"
2. Confirm installation
3. Launch from home screen icon

**Expected Results**:
- Icon appears on home screen
- App opens in standalone mode (no browser UI)
- Splash screen shows during launch
- Status bar color matches theme

#### Test 5.3: Install PWA on Desktop
**Objective**: Install as desktop app

**Steps**:
1. Chrome/Edge: Click install icon in address bar
2. Confirm installation
3. Launch from desktop/Start menu

**Expected Results**:
- App added to applications
- Opens in dedicated window
- App shortcuts work (if defined)
- Uninstall option available

#### Test 5.4: Manifest Validation
**Objective**: Verify manifest.json correctness

**Steps**:
1. DevTools → Application → Manifest
2. Check all fields populated
3. Run Lighthouse PWA audit

**Expected Fields**:
```json
{
  "name": "WeCare Health Management",
  "short_name": "WeCare",
  "description": "Comprehensive health management platform",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

### 6. Performance & Lighthouse

#### Test 6.1: Lighthouse PWA Score
**Objective**: Achieve 90+ PWA score

**Steps**:
1. DevTools → Lighthouse
2. Select "Progressive Web App" category
3. Run audit
4. Review results

**Target Metrics**:
- PWA Score: ≥90
- Service Worker: Registered ✓
- HTTPS: Enabled ✓
- Installable: Yes ✓
- Mobile-friendly: Yes ✓

#### Test 6.2: Performance Metrics
**Objective**: Meet Core Web Vitals

**Steps**:
1. Run Lighthouse performance audit
2. Check Core Web Vitals
3. Identify bottlenecks

**Target Metrics**:
- **LCP** (Largest Contentful Paint): <2.5s
- **FID** (First Input Delay): <100ms
- **CLS** (Cumulative Layout Shift): <0.1
- **TTI** (Time to Interactive): <3.8s

---

### 7. Cross-Browser Testing

#### Test 7.1: Chrome/Edge (Chromium)
**Features Supported**:
- ✅ Service Workers
- ✅ Push Notifications
- ✅ App Installation
- ✅ Background Sync

#### Test 7.2: Firefox
**Features Supported**:
- ✅ Service Workers
- ✅ Push Notifications
- ⚠️ App Installation (limited)
- ❌ Background Sync (not supported)

#### Test 7.3: Safari (iOS/macOS)
**Features Supported**:
- ✅ Service Workers (iOS 11.3+)
- ⚠️ Push Notifications (web push not supported on iOS)
- ✅ Add to Home Screen
- ❌ Background Sync

**Safari-Specific Tests**:
1. Test Add to Home Screen on iOS
2. Verify icon masking (apple-touch-icon)
3. Check standalone mode launch
4. Test without push notifications

---

## Common Issues & Troubleshooting

### Issue 1: Service Worker Not Updating
**Symptoms**: Old version persists after deploy

**Solutions**:
1. Hard refresh (Ctrl+Shift+R)
2. Unregister and re-register SW
3. Clear site data in DevTools
4. Check cache versioning strategy
5. Implement "Update Available" notification

### Issue 2: Push Notifications Not Received
**Symptoms**: No notifications despite subscription

**Debugging Steps**:
1. Check subscription endpoint valid
2. Verify VAPID keys match
3. Test with web-push CLI directly
4. Check notification permission granted
5. Ensure service worker active
6. Review browser console for errors

### Issue 3: App Not Installable
**Symptoms**: No install prompt appears

**Requirements Check**:
- ✅ Served over HTTPS
- ✅ Manifest.json valid and linked
- ✅ Service worker registered
- ✅ Icons in manifest (192px, 512px)
- ✅ start_url valid
- ✅ display set to standalone/fullscreen/minimal-ui

### Issue 4: Offline Not Working
**Symptoms**: App fails when offline

**Debugging**:
1. Check service worker activated
2. Verify cache strategies defined
3. Inspect Cache Storage in DevTools
4. Test fetch handlers in SW
5. Check for CORS issues with cached requests

---

## Automated PWA Testing

### Using Puppeteer
```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Test service worker registration
  await page.goto('https://localhost:3000');
  const swRegistered = await page.evaluate(() => {
    return navigator.serviceWorker.controller !== null;
  });
  console.log('Service Worker registered:', swRegistered);
  
  // Test offline
  await page.setOfflineMode(true);
  await page.reload();
  const offlineWorks = await page.evaluate(() => {
    return document.body.innerText.includes('WeCare');
  });
  console.log('Offline works:', offlineWorks);
  
  await browser.close();
})();
```

### Using Lighthouse CI
```yaml
# .github/workflows/pwa-test.yml
name: PWA Tests
on: [push]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
          configPath: './lighthouserc.json'
          uploadArtifacts: true
```

---

## Checklist: Pre-Production PWA Verification

- [ ] Service worker registers on all supported browsers
- [ ] App loads offline (cached shell)
- [ ] Static assets cached effectively
- [ ] API calls fail gracefully offline
- [ ] Push notifications work (Chrome/Firefox)
- [ ] Install prompt appears
- [ ] App installable on Android
- [ ] App installable on iOS (Add to Home Screen)
- [ ] App installable on desktop (Chrome/Edge)
- [ ] Manifest.json valid (no warnings)
- [ ] Icons display correctly (all sizes)
- [ ] Lighthouse PWA score ≥90
- [ ] Core Web Vitals meet targets
- [ ] HTTPS enforced
- [ ] Cross-browser tested
- [ ] Offline error messages user-friendly
- [ ] Service worker update mechanism works
- [ ] No console errors on install/activate
- [ ] Privacy policy mentions push notifications

---

## References

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google: PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)

---

**Last Updated**: 2024
**Maintained By**: WeCare Development Team
