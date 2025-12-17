// Generate firebase-config.js from environment variables for token-getter.html
// Run during build: node scripts/generate-firebase-config.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`📄 Loaded environment from ${envPath}`);
} else {
  console.log('ℹ️  No .env file found, using process.env (OK for Vercel builds)');
}

// Load environment variables
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const vapidKey = process.env.VITE_FIREBASE_VAPID_KEY;

// Validate all required fields
const missing = Object.entries(config)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  console.error(`   Config: ${missing.join(', ')}`);
  process.exit(1);
}

if (!vapidKey) {
  console.warn('⚠️  VITE_FIREBASE_VAPID_KEY not set - push notifications will not work');
}

// Generate the JS file
const content = `// Auto-generated from environment variables - DO NOT COMMIT
// Generated at: ${new Date().toISOString()}

window.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};
window.FIREBASE_VAPID_KEY = ${vapidKey ? JSON.stringify(vapidKey) : 'null'};
`;

const outputPath = path.join(__dirname, '..', 'public', 'firebase-config.js');
fs.writeFileSync(outputPath, content, 'utf8');

console.log('✅ Generated public/firebase-config.js from environment variables');
