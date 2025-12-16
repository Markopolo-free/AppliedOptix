# Firebase Cloud Messaging Setup Guide

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the eMotility Staff Portal.

## Overview

Firebase Cloud Messaging allows you to send free push notifications to users. The implementation includes:
- Frontend notification permission request
- Service Worker for handling background notifications
- Real-time message listener for foreground notifications
- Token management for identifying devices

## Setup Steps

### 1. Get Your Firebase VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Project Settings** (gear icon) → **Cloud Messaging**
4. Under "Web API Key Configuration", click **Generate Key Pair**
5. Copy the **Server Key** (this is your VAPID key)

### 2. Configure Environment Variables

1. Create a `.env.local` file in the root directory (or edit existing one):
   ```env
   VITE_FIREBASE_VAPID_KEY=your_server_key_here
   ```

2. You can use `.env.local.example` as a template

### 3. Integration in App

The notification system is automatically initialized in `App.tsx`:
- On app load, Firebase Messaging is initialized
- Users see a notification permission request button (via `NotificationPermissionComponent`)
- When granted, FCM token is generated and stored

### 4. Add Notification Permission UI

To prompt users to enable notifications, add the component to your desired location:

```tsx
import { NotificationPermissionComponent } from './components/NotificationPermissionComponent';

export const MyComponent = () => {
  return (
    <>
      <NotificationPermissionComponent 
        onPermissionGranted={(token) => {
          console.log('Notifications enabled, token:', token);
        }}
      />
      {/* Rest of component */}
    </>
  );
};
```

## Sending Notifications

### From Firebase Admin SDK (Backend/Cloud Function)

```javascript
const admin = require('firebase-admin');

async function sendNotification(fcmToken, title, body) {
  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.log('Error sending message:', error);
  }
}
```

### Sending to Topics

```javascript
// Subscribe user to a topic
const admin = require('firebase-admin');

await admin.messaging().subscribeToTopic(fcmToken, 'staff-notifications');

// Send to all users subscribed to topic
const message = {
  notification: {
    title: 'Important Update',
    body: 'New campaign created',
  },
  topic: 'staff-notifications',
};

await admin.messaging().send(message);
```

### Send via Firebase Console

1. Go to **Cloud Messaging** in Firebase Console
2. Click **Create Campaign**
3. Add title and body
4. Choose target (all users or specific audience)
5. Click **Publish**

## Receiving Notifications

### Foreground Messages (App Open)
Handled by `setupMessageListener()` in `notificationService.ts`:
```tsx
import { setupMessageListener } from './services/notificationService';

useEffect(() => {
  setupMessageListener((message) => {
    console.log('Foreground notification:', message);
    // Show toast, update UI, etc.
  });
}, []);
```

### Background Messages (App Closed)
Handled automatically by the Service Worker (`firebase-messaging-sw.js`):
- Displays system notification
- No code needed - works out of the box

## Key Files

- **[services/notificationService.ts](services/notificationService.ts)** - Core notification logic
- **[public/firebase-messaging-sw.js](public/firebase-messaging-sw.js)** - Service Worker for background notifications
- **[components/NotificationPermissionComponent.tsx](components/NotificationPermissionComponent.tsx)** - UI for requesting permission
- **[App.tsx](App.tsx)** - App initialization with FCM setup

## Security Considerations

1. **VAPID Key**: Keep your VAPID key in `.env.local` (never commit to repo)
2. **Token Storage**: FCM tokens are stored in `localStorage` - can be encrypted if needed
3. **Topic Subscription**: Validate user authorization before subscribing to sensitive topics
4. **Message Data**: Don't send sensitive data in notification payloads

## Testing

### In Development

1. Build the app: `npm run build`
2. Test locally with HTTPS (required for FCM)
3. Check browser console for logs
4. Use Firebase Console to send test notifications

### Send Test Notification via Firebase Admin SDK

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const fcmToken = 'user_token_here'; // From localStorage

await admin.messaging().send({
  notification: {
    title: 'Test Notification',
    body: 'This is a test message',
  },
  token: fcmToken,
});
```

## Troubleshooting

### Notifications Not Showing

1. **Check Permission Status**: Open DevTools → Application → Notifications
2. **Verify VAPID Key**: Ensure it's correctly set in `.env.local`
3. **Service Worker**: Check if it's registered (DevTools → Application → Service Workers)
4. **Token Generation**: Check localStorage for `fcm_token`

### Service Worker Issues

If service worker fails to register:
1. Ensure app is served over HTTPS (localhost is exception)
2. Check browser console for errors
3. Verify `firebase-messaging-sw.js` is in `public/` folder

### Tokens Not Generating

1. Ensure Firebase config is correct
2. Check that notification permission is granted
3. Verify VAPID key matches Firebase project

## Advanced: Custom Notification Handling

To handle notifications differently based on data:

```tsx
import { setupMessageListener } from './services/notificationService';

setupMessageListener((message) => {
  const { notification, data } = message;

  if (data?.type === 'campaign_alert') {
    // Handle campaign notification
    showCampaignAlert(data?.campaignId);
  } else if (data?.type === 'system_update') {
    // Handle system notification
    refreshSystemData();
  }
});
```

## Cost

Firebase Cloud Messaging is **completely free**:
- No cost for sending notifications
- No cost for receiving notifications
- Only Firebase Realtime Database usage is billable (already in use)

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
