// Script to restore Weather Condition items from console log
// Usage: node restoreWeatherConditions.js <input.json>

const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

// TODO: Fill in your Firebase config here
const firebaseConfig = require('../firebaseConfig.node.cjs');

initializeApp(firebaseConfig);
const db = getDatabase();

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node restoreWeatherConditions.js <input.json>');
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

async function restore() {
  for (const item of items) {
    // Generate a unique key for each item
    const key = Math.random().toString(36).substr(2, 12);
    const newItem = { ...item, id: key };
    await set(ref(db, `referenceWeatherConditions/${key}`), newItem);
    console.log('Restored:', newItem.name);
  }
  console.log('Restore complete.');
}

restore();
