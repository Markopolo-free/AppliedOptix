/* eslint-disable no-undef */
// Service Worker for Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in the Service Worker (web config is public)
firebase.initializeApp({
  apiKey: 'AIzaSyAgZxO77EwYqP4AZzgo4M1nGv28yf8T9Ic',
  authDomain: 'emobility-service.firebaseapp.com',
  databaseURL: 'https://emobility-service-default-rtdb.firebaseio.com',
  projectId: 'emobility-service',
  storageBucket: 'emobility-service.firebasestorage.app',
  messagingSenderId: '535363619209',
  appId: '1:535363619209:web:25eb5330be538a45de3958',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/vite.svg',
    badge: '/vite.svg',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('push', (event) => {
  if (event.data) {
    const payload = event.data.json();
    console.log('Push notification received:', payload);
  }
});
