import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

// Initialize Firebase (reuse existing app if already initialized)
const app = getApps()[0] || initializeApp(firebaseConfig);

// Initialize Firebase Realtime Database and get a reference to the service
const db = getDatabase(app);

export { db };
