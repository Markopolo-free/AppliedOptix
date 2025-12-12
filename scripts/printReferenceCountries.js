// Print all countries in referenceCountries from Firebase
// Usage: node scripts/printReferenceCountries.js

const { getDatabase, ref, get } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function printCountries() {
  const snapshot = await get(ref(db, 'referenceCountries'));
  if (!snapshot.exists()) {
    console.log('No countries found in referenceCountries.');
    return;
  }
  const data = snapshot.val();
  const countries = Object.values(data).map((c) => c.name || '[NO NAME]');
  console.log('Countries in referenceCountries:', countries);
}

printCountries();
