import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

// Initialize Firebase (reuse existing app if already initialized)
const app = getApps()[0] || initializeApp(firebaseConfig);

// Initialize Firebase Analytics (client-only) and Realtime Database
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : undefined;
const db = getDatabase(app);

export { db, analytics };
