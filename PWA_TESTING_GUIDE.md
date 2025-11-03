# PWA Testing Guide for WeCare Healthcare Platform

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Lighthouse PWA Audit](#lighthouse-pwa-audit)
4. [Service Worker Testing](#service-worker-testing)
5. [Manifest Validation](#manifest-validation)
6. [Install & Prompt Behavior](#install--prompt-behavior)
7. [Push Notifications](#push-notifications)
8. [Update Flow Testing](#update-flow-testing)
9. [Cache Management](#cache-management)
10. [Accessibility Testing](#accessibility-testing)
11. [Device & Network Matrix](#device--network-matrix)
12. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive steps for testing the Progressive Web App (PWA) capabilities of the WeCare Healthcare Platform. The platform must meet PWA standards for installability, offline functionality, performance, and accessibility.

### PWA Requirements
- **Installable**: App can be installed on mobile/desktop
- **Offline-first**: Core features work without internet
- **Performance**: Fast load times (LCP < 2.5s, FID < 100ms)
- **Responsive**: Works across all screen sizes
- **Secure**: Served over HTTPS
- **Accessible**: WCAG 2.1 AA compliance

---

## Prerequisites

### Required Tools
1. **Browsers**:
   - Chrome/Edge (latest version) - for DevTools and Lighthouse
   - Firefox (latest version)
   - Safari (for iOS testing)

2. **Testing Tools**:
   - Lighthouse CLI: `npm install -g lighthouse`
   - Chrome DevTools
   - Workbox Service Worker Library

3. **Test Devices**:
   - Android device (physical or emulator)
   - iOS device (physical or simulator)
   - Desktop (Windows/Mac/Linux)

4. **Network Conditions**:
   - WiFi
   - 4G/LTE
   - 3G (simulated)
   - Offline mode

### Test Environment Setup
```bash
# Install the app locally
cd client
npm install
npm run build
npm run preview

# Run on HTTPS (required for PWA features)
# Use ngrok or local SSL certificate
```

---

## Lighthouse PWA Audit

### Running Lighthouse Audit

#### Method 1: Chrome DevTools
1. Open Chrome DevTools (F12)
2. Navigate to **Lighthouse** tab
3. Select:
   - ✅ Progressive Web App
   - ✅ Performance
   - ✅ Accessibility
   - ✅ Best Practices
   - ✅ SEO
4. Choose Device: Mobile or Desktop
5. Click **Analyze page load**

#### Method 2: Lighthouse CLI
```bash
# Run Lighthouse audit
lighthouse https://your-app-url.com --view

# Export results as JSON
lighthouse https://your-app-url.com --output json --output-path ./reports/lighthouse-report.json

# Run with specific throttling
lighthouse https://your-app-url.com --throttling-method=simulate --throttling.cpuSlowdownMultiplier=4
```

### Target Scores
| Category | Minimum Score | Target Score |
|----------|--------------|--------------|
| PWA | 90 | 100 |
| Performance | 80 | 90+ |
| Accessibility | 90 | 95+ |
| Best Practices | 90 | 100 |
| SEO | 85 | 90+ |

### PWA Audit Checklist
- [ ] ✅ Registers a service worker that controls page and start_url
- [ ] ✅ Web app manifest meets installability requirements
- [ ] ✅ Configured for a custom splash screen
- [ ] ✅ Sets a theme color for the address bar
- [ ] ✅ Content is sized correctly for the viewport
- [ ] ✅ Displays images with correct aspect ratio
- [ ] ✅ Provides a valid apple-touch-icon
- [ ] ✅ Redirects HTTP traffic to HTTPS
- [ ] ✅ Configured for offline use
- [ ] ✅ Page load is fast enough on mobile networks

---

## Service Worker Testing

### 1. Service Worker Registration

**Test Steps**:
1. Open DevTools → Application → Service Workers
2. Navigate to the app
3. Verify service worker registration:
   - Status: **activated and running**
   - Scope: `/` (covers entire app)
   - Source: `/service-worker.js` or `/sw.js`

**Expected Result**: Service worker should register within 2-3 seconds of page load.

### 2. Caching Strategies

The app uses multiple caching strategies:

#### Cache-First Strategy (Static Assets)
- **Files**: CSS, JS, fonts, images
- **Test**:
  1. Load the app (online)
  2. Open DevTools → Application → Cache Storage
  3. Verify presence of static assets in cache
  4. Go offline
  5. Refresh page
  6. **Expected**: Page loads from cache instantly

#### Network-First Strategy (API Calls)
- **Endpoints**: `/api/*`
- **Test**:
  1. Make API call (online) - fetches from network
  2. Go offline
  3. Make same API call
  4. **Expected**: Returns cached response with stale data indicator

#### Stale-While-Revalidate (Documents/Images)
- **Files**: Patient documents, profile pictures
- **Test**:
  1. View a document (online) - cached
  2. Server updates document
  3. Reload app
  4. **Expected**: Shows cached version immediately, then updates in background

### 3. Offline Functionality Testing

**Critical Features (Must Work Offline)**:
- [ ] View Dashboard
- [ ] View Appointments (cached)
- [ ] View Health History
- [ ] View Patient Documents (cached)
- [ ] Access Profile
- [ ] View offline fallback page for uncached routes

**Deferred Features (Queue for Later)**:
- [ ] Book Appointment → Queued
- [ ] Upload Document → Queued
- [ ] Update Profile → Queued

**Test Procedure**:
1. Enable offline mode: DevTools → Network → Offline checkbox
2. Test each feature above
3. Re-enable online mode
4. Verify queued actions execute automatically

### 4. Background Sync Testing

**Test Steps**:
1. Go offline
2. Perform actions that require network (book appointment, upload document)
3. Verify sync queue in DevTools → Application → Background Sync
4. Go online
5. **Expected**: Queued actions execute automatically within 5 seconds
6. User receives confirmation notification

---

## Manifest Validation

### Manifest File Location
- `/client/public/manifest.json`

### Required Fields
```json
{
  "name": "WeCare Healthcare Platform",
  "short_name": "WeCare",
  "description": "Healthcare management platform for patients and providers",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Validation Steps
1. Open DevTools → Application → Manifest
2. Verify all fields display correctly
3. Check icon loading (no 404 errors)
4. Validate maskable icons using: https://maskable.app/

**Expected Result**: No warnings in manifest section

---

## Install & Prompt Behavior

### Desktop Installation (Chrome/Edge)

**Test Steps**:
1. Visit the app on Chrome/Edge
2. Wait 30 seconds (or meet engagement criteria)
3. Look for install button in address bar (⊕ icon)
4. Click install → **Expected**: Install dialog appears
5. Click "Install" → **Expected**: App installs and opens in app window
6. Verify:
   - App appears in Start Menu/Applications
   - App icon matches manifest
   - App opens without browser UI
   - Window has custom title bar

### Mobile Installation (Android)

**Test Steps**:
1. Visit app on Chrome Mobile
2. Wait for "Add to Home Screen" prompt
3. Tap "Add" → **Expected**: App icon appears on home screen
4. Launch app from home screen
5. Verify:
   - Opens in fullscreen (no browser UI)
   - Splash screen shows (2-3 seconds)
   - Theme color matches manifest
   - Status bar color matches theme

### iOS Installation

**Test Steps**:
1. Visit app on Safari (iOS)
2. Tap Share button → "Add to Home Screen"
3. Customize name if needed → Tap "Add"
4. Launch from home screen
5. Verify:
   - Apple touch icon displays correctly
   - Opens in standalone mode
   - Status bar styled correctly

### Prompt Deferral Testing

**Test Steps**:
1. Trigger install prompt
2. Click "Not now" or dismiss
3. Verify prompt doesn't show again for 3 days
4. Manually trigger prompt via settings/menu
5. **Expected**: Install prompt appears on demand

---

## Push Notifications

### Notification Permission Request

**Test Steps**:
1. First visit → **Expected**: No automatic prompt
2. User performs action (book appointment, enable notifications in settings)
3. **Expected**: Permission request appears
4. Grant permission
5. Verify registration in DevTools → Application → Service Workers → Push Subscription

### Notification Delivery

**Test Scenarios**:

#### 1. Appointment Reminder
```javascript
// Trigger from server
POST /api/notifications/send
{
  "userId": 123,
  "type": "appointment_reminder",
  "appointmentId": 456
}
```
**Expected Notification**:
- Title: "Appointment Reminder"
- Body: "You have an appointment tomorrow at 10:00 AM with Dr. Smith"
- Icon: App icon
- Actions: ["View", "Reschedule"]

#### 2. Document Upload Complete
**Expected Notification**:
- Title: "Document Uploaded"
- Body: "Your medical record has been successfully uploaded"
- Icon: Document icon
- Action: ["View Document"]

### Notification Action Handling

**Test Steps**:
1. Receive notification
2. Click action button ("View", "Reschedule", etc.)
3. **Expected**: App opens to relevant page
4. If offline, queue action for background sync

### Notification Badge

**Test Steps**:
1. Receive notification while app is closed
2. **Expected**: Badge count appears on app icon
3. Open app
4. **Expected**: Badge clears automatically

---

## Update Flow Testing

### Detecting New Service Worker

**Test Steps**:
1. Deploy new version with updated service worker
2. User visits app (old SW still active)
3. **Expected**: New SW detected and installed in background
4. User sees update notification:
   - "New version available. Refresh to update."
   - [Refresh Now] button

### Skip Waiting & Activation

**Test Steps**:
1. User clicks "Refresh Now"
2. **Expected**:
   - New SW activates immediately (`skipWaiting()`)
   - Page reloads
   - New version loads

### Handling Long-Running Tabs

**Test Steps**:
1. Open app tab
2. Leave tab open for 24+ hours
3. Deploy new version
4. Return to tab
5. **Expected**: Update banner appears
6. User can choose to update or continue with old version

---

## Cache Management

### Cache Size Monitoring

**Test Steps**:
1. Open DevTools → Application → Cache Storage
2. Check sizes of all caches:
   - `static-cache-v1`: < 5MB
   - `api-cache-v1`: < 10MB
   - `documents-cache-v1`: < 50MB
3. **Expected**: Total cache < 100MB

### Cache Eviction Strategy

**Test Steps**:
1. Fill cache to near limit (95MB)
2. Add more items
3. **Expected**: Oldest LRU items evicted automatically
4. Verify critical assets remain cached

### Manual Cache Clear

**Test Steps**:
1. Go to app settings → Clear Cache
2. **Expected**: All caches cleared except service worker script
3. Page reload fetches fresh resources

---

## Accessibility Testing

### Keyboard Navigation

**Test Steps**:
1. Use Tab key to navigate entire app
2. Verify:
   - All interactive elements reachable
   - Focus indicators visible
   - Tab order logical
   - Skip links present ("Skip to main content")

### Screen Reader Testing

**Tools**: NVDA (Windows), VoiceOver (Mac/iOS), TalkBack (Android)

**Test Steps**:
1. Enable screen reader
2. Navigate app with screen reader only
3. Verify:
   - All content announced clearly
   - Form labels associated correctly
   - Error messages read aloud
   - ARIA landmarks present (nav, main, aside)
   - Images have alt text

### Color Contrast

**Tools**: axe DevTools, Lighthouse

**Test Steps**:
1. Run axe accessibility scan
2. Check contrast ratios:
   - Normal text: ≥ 4.5:1
   - Large text (18pt+): ≥ 3:1
   - UI components: ≥ 3:1

### Touch Target Size

**Test Steps**:
1. Check all buttons/links on mobile
2. **Expected**: Minimum 44x44px touch target
3. Adequate spacing between targets (8px+)

---

## Device & Network Matrix

### Test Matrix

| Device | OS | Browser | Network | Priority |
|--------|-----|---------|---------|----------|
| iPhone 14 | iOS 17 | Safari | WiFi | P0 |
| iPhone 14 | iOS 17 | Safari | 4G | P0 |
| Samsung Galaxy S23 | Android 14 | Chrome | WiFi | P0 |
| Samsung Galaxy S23 | Android 14 | Chrome | 4G | P0 |
| Pixel 7 | Android 13 | Chrome | 3G (simulated) | P1 |
| iPad Pro | iOS 17 | Safari | WiFi | P1 |
| Windows 11 PC | - | Chrome | WiFi | P0 |
| Windows 11 PC | - | Edge | WiFi | P1 |
| MacBook Pro | macOS | Chrome | WiFi | P0 |
| MacBook Pro | macOS | Safari | WiFi | P1 |

### Network Throttling Profiles

**Chrome DevTools → Network → Throttling**:

1. **Fast 3G**:
   - Download: 1.6 Mbps
   - Upload: 750 Kbps
   - Latency: 150ms

2. **Slow 3G**:
   - Download: 400 Kbps
   - Upload: 400 Kbps
   - Latency: 400ms

3. **Offline**: Complete network disconnection

---

## Troubleshooting

### Issue: Service Worker Not Registering

**Symptoms**: No SW in DevTools Application tab

**Solutions**:
1. Check HTTPS - PWA requires secure context
2. Verify `/service-worker.js` exists and returns 200
3. Check for JS errors in console
4. Clear browser cache and hard reload (Ctrl+Shift+R)
5. Check SW scope matches app URLs

### Issue: Install Prompt Not Showing

**Symptoms**: No "Add to Home Screen" option

**Checklist**:
- [ ] Manifest file valid and linked in `<head>`
- [ ] Icons present (192x192 and 512x512 minimum)
- [ ] HTTPS enabled
- [ ] Service worker registered successfully
- [ ] `start_url` resolves and returns 200
- [ ] User hasn't dismissed prompt recently (Chrome: 3 months)

### Issue: Offline Mode Not Working

**Symptoms**: Errors when offline

**Debug Steps**:
1. DevTools → Application → Service Workers → Check status
2. Application → Cache Storage → Verify resources cached
3. Network tab → Offline → Try loading page
4. Check SW fetch event handler for errors
5. Verify cache names match between SW and app

### Issue: Notifications Not Received

**Symptoms**: No push notifications

**Checklist**:
- [ ] Permission granted (DevTools → Application → Permissions)
- [ ] Push subscription active (Application → Service Workers)
- [ ] Server sending correct payload format
- [ ] Notification service worker event handler present
- [ ] Test with different notification libraries (OneSignal, FCM)

### Issue: App Not Updating

**Symptoms**: Old version persists after deployment

**Solutions**:
1. Force SW update: DevTools → Application → Service Workers → Update
2. Verify SW version number incremented
3. Check `skipWaiting()` called in new SW
4. Clear all caches and reload
5. Unregister SW and re-register

### Issue: High Cache Usage

**Symptoms**: Storage quota exceeded

**Solutions**:
1. Implement cache size limits
2. Use cache expiration (max-age)
3. Implement LRU eviction
4. Don't cache large files (videos, PDFs > 10MB)
5. Request persistent storage:
   ```javascript
   navigator.storage.persist().then(granted => {
     console.log('Persistent storage:', granted);
   });
   ```

---

## Appendix: Useful Commands

### Check Storage Usage
```javascript
navigator.storage.estimate().then(estimate => {
  console.log(`Usage: ${estimate.usage} of ${estimate.quota} bytes`);
  console.log(`Percentage: ${(estimate.usage / estimate.quota * 100).toFixed(2)}%`);
});
```

### Clear All Service Workers
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
```

### Manual Cache Clear
```javascript
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
```

---

## Sign-Off Checklist

Before marking PWA testing complete, ensure:

- [ ] Lighthouse PWA score ≥ 90
- [ ] Install prompt works on 3+ browsers
- [ ] Offline mode tested on 5+ critical pages
- [ ] Service worker update flow verified
- [ ] Push notifications delivered successfully
- [ ] Accessibility score ≥ 90
- [ ] Tested on 3+ device types
- [ ] Tested on 3+ network conditions
- [ ] All critical issues resolved
- [ ] Performance metrics meet targets

---

**Document Version**: 1.0  
**Last Updated**: November 2025  
**Author**: WeCare QA Team
