import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';
import { ref, set, serverTimestamp } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';
import { db } from './firebase';

let messaging: Messaging | null = null;

export const initNotifications = async () => {
  try {
    // Check if FCM is supported in this browser (fails on most mobile browsers)
    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.log('[FCM] Firebase Messaging is not supported in this browser (likely mobile)');
      return false;
    }

    // Initialize Firebase if not already done
    const app = getApps()[0] || initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    
    console.log('Firebase Messaging initialized');
    return true;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return false;
  }
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!messaging) {
    console.error('Firebase Messaging not initialized');
    return null;
  }

  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return null;
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      return await getFCMToken();
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return await getFCMToken();
    } else {
      console.log('User denied notification permission');
      return null;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
};

export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) {
    console.error('Firebase Messaging not initialized');
    return null;
  }

  try {
    // Diagnostics: log environment essentials once
    const diag = {
      origin: window.location.origin,
      vapidKeyDefined: !!import.meta.env.VITE_FIREBASE_VAPID_KEY,
      apiKeyDefined: !!import.meta.env.VITE_FIREBASE_API_KEY,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      senderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    console.log('[FCM] Diagnostics:', diag);
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
    }

    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
    } catch (err: any) {
      console.error('[FCM] getToken failed:', {
        message: err?.message,
        code: err?.code,
        name: err?.name,
      });
      throw err;
    }

    if (token) {
      console.log('FCM Token:', token);
      // Store token locally and in Firebase for backend processing
      localStorage.setItem('fcm_token', token);
      try {
        const tokenRef = ref(db, `fcmTokens/${token}`);
        await set(tokenRef, {
          createdAt: serverTimestamp(),
          // userEmail will be set by UI component if available via a separate write
        });
      } catch (e) {
        console.warn('Failed to save FCM token to database:', e);
      }
      return token;
    } else {
      console.log('No registration token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    // Extra hint when referer restriction likely blocks
    const origin = window.location.origin;
    if (origin.includes('localhost:3001') || origin.includes('127.0.0.1:3001')) {
      console.warn('[FCM] If you see PERMISSION_DENIED for installations, ensure your Google Cloud API key has HTTP referrer allowlist including http://localhost:3001/*');
    }
    return null;
  }
};

export const setupMessageListener = (callback: (message: any) => void) => {
  if (!messaging) {
    console.error('Firebase Messaging not initialized');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    callback(payload);
  });
};

export const isNotificationSupported = async (): Promise<boolean> => {
  try {
    const messagingSupported = await isSupported();
    return 'Notification' in window && 'serviceWorker' in navigator && messagingSupported;
  } catch {
    return false;
  }
};

export const getNotificationPermissionStatus = (): NotificationPermission => {
  return Notification.permission;
};

export const saveTokenToDatabase = async (token: string, userEmail?: string) => {
  try {
    const tokenRef = ref(db, `fcmTokens/${token}`);
    await set(tokenRef, {
      userEmail: userEmail || null,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Failed to update FCM token metadata:', e);
  }
};
