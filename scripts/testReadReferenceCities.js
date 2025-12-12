// testReadReferenceCities.js
// Run with: node testReadReferenceCities.js

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  try {
    const snap = await get(ref(db, 'referenceCities'));
    if (!snap.exists()) {
      console.log('No data found at referenceCities');
      return;
    }
    const data = snap.val();
    console.log('referenceCities data:', data);
  } catch (err) {
    console.error('Error reading referenceCities:', err);
  }
}

main();
