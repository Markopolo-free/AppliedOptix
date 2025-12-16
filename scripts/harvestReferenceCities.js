// scripts/harvestReferenceCities.js
// Run with: node scripts/harvestReferenceCities.js
// This script fetches the referenceCities node from Firebase and exports JSON/CSV snapshots.

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Use Admin SDK with credential rotation via env vars
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.MGM_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'scripts/prod-credentials.json');
if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`Service account file not found: ${serviceAccountPath}. Set GOOGLE_APPLICATION_CREDENTIALS or MGM_SERVICE_ACCOUNT_PATH.`);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
import firebaseConfig from './firebaseConfig.node.cjs';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL,
});
const db = admin.database();

async function main() {
  try {
    const dbRef = db.ref('referenceCities');
    const snapshot = await dbRef.get();
    if (!snapshot.exists()) {
      console.log('No data found at referenceCities');
      return;
    }
    const data = snapshot.val();
    const loadedItems = Object.entries(data).map(([id, value]) => ({ id, ...value }));

    // Ensure export directory exists
    const exportDir = path.resolve(process.cwd(), 'scripts', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date();
    const stamp =
      String(timestamp.getFullYear()) +
      String(timestamp.getMonth() + 1).padStart(2, '0') +
      String(timestamp.getDate()).padStart(2, '0') + '-' +
      String(timestamp.getHours()).padStart(2, '0') +
      String(timestamp.getMinutes()).padStart(2, '0') +
      String(timestamp.getSeconds()).padStart(2, '0');

    const jsonPath = path.join(exportDir, `referenceCities.${stamp}.json`);
    const csvPath = path.join(exportDir, `referenceCities.${stamp}.csv`);

    // Write JSON
    fs.writeFileSync(jsonPath, JSON.stringify(loadedItems, null, 2), 'utf-8');

    // Build CSV (id,name,country,population,dateAdded,addedBy,lat,lng)
    const headers = ['id', 'name', 'country', 'population', 'dateAdded', 'addedBy', 'lat', 'lng'];
    const toCsvValue = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csvLines = [headers.join(',')].concat(
      loadedItems.map((row) =>
        headers
          .map((h) => toCsvValue(row[h]))
          .join(',')
      )
    );
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');

    // Simple summary
    const countryCounts = {};
    const missingName = [];
    for (const row of loadedItems) {
      const country = row.country || 'UNKNOWN';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      if (!row.name) missingName.push(row.id);
    }

    console.log(`Exported ${loadedItems.length} cities.`);
    console.log('Countries breakdown:', countryCounts);
    if (missingName.length) {
      console.warn(`Records missing name: ${missingName.length}`, missingName.slice(0, 10), missingName.length > 10 ? '... (truncated)' : '');
    }
    console.log('JSON:', jsonPath);
    console.log('CSV :', csvPath);
  } catch (err) {
    console.error('Error reading referenceCities:', err);
  }
}

main();
