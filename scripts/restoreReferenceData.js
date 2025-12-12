// This script restores all reference data categories from a backup JSON file to Firebase.
// Usage: node scripts/restoreReferenceData.js <backupFile>

const { getDatabase, ref, set } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const fs = require('fs');
const path = require('path');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

if (process.argv.length < 3) {
  console.error('Usage: node scripts/restoreReferenceData.js <backupFile>');
  process.exit(1);
}

const backupFile = process.argv[2];
if (!fs.existsSync(backupFile)) {
  console.error('Backup file not found:', backupFile);
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

async function restoreAllReferenceData() {
  for (const [category, data] of Object.entries(backup)) {
    if (!data || typeof data !== 'object') continue;
    await set(ref(db, category), data);
    console.log('Restored', category, 'with', Object.keys(data).length, 'records');
  }
  console.log('Reference data restoration complete.');
}

restoreAllReferenceData();
