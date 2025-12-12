// scripts/harvestReferenceCities.js
// Run with: node scripts/harvestReferenceCities.js
// This script fetches the referenceCities node from Firebase using the same method as the FE.

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  try {
    const dbRef = ref(db, 'referenceCities');
    const snapshot = await get(dbRef);
    if (!snapshot.exists()) {
      console.log('No data found at referenceCities');
      return;
    }
    const data = snapshot.val();
    const loadedItems = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    console.log('Loaded city raw data:', data);
    console.log('Loaded city items:', loadedItems);
  } catch (err) {
    console.error('Error reading referenceCities:', err);
  }
}

main();
