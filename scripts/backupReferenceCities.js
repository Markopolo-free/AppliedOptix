// scripts/backupReferenceCities.js
// Run with: node scripts/backupReferenceCities.js
// This script backs up the referenceCities node from Firebase to a timestamped JSON file in the backups/ directory.

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import firebaseConfig from '../firebaseConfig.node.cjs';
import fs from 'fs';
import path from 'path';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function backupReferenceCities() {
  try {
    const citiesRef = ref(db, 'referenceCities');
    const snapshot = await get(citiesRef);
    if (!snapshot.exists()) {
      console.error('No referenceCities data found.');
      process.exit(1);
    }
    const data = snapshot.val();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve('./backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    const backupPath = path.join(backupDir, `referenceCities-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Backup successful: ${backupPath}`);
  } catch (err) {
    console.error('Error backing up referenceCities:', err);
    process.exit(1);
  }
}

backupReferenceCities();
