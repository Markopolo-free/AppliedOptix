// This script will backup all reference data categories from Firebase to a single JSON file for full restoration if needed.
// Usage: node scripts/backupReferenceData.js

const { getDatabase, ref, get } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const fs = require('fs');
const path = require('path');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const categories = [
  'referenceCountries',
  'referenceCurrencies',
  'referenceFXSegments',
  'referenceServiceTypes',
  'referenceZoneTypes',
  'referenceCompanyTypes',
  'referenceZones',
  'referenceCities',
  'referenceWeatherConditions',
  'loyaltyTriggerEvents',
  'referenceDiscountAmountTypes',
  'referenceBadges',
];

async function backupAllReferenceData() {
  const backup = {};
  for (const category of categories) {
    const snapshot = await get(ref(db, category));
    backup[category] = snapshot.exists() ? snapshot.val() : {};
  }
  const outDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outFile = path.join(
    outDir,
    `referenceData-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  console.log('Reference data backup complete:', outFile);
}

backupAllReferenceData();
