// Script to remove duplicate keys in referenceCompanyTypes from Firebase
// Usage: node removeCompanyTypeDuplicates.js

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');

// TODO: Replace with your Firebase config
const firebaseConfig = require('../firebaseConfig');
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function removeDuplicates() {
  const refPath = 'referenceCompanyTypes';
  const snapshot = await get(ref(db, refPath));
  if (!snapshot.exists()) {
    console.log('No company types found.');
    return;
  }
  const data = snapshot.val();
  const seenNames = new Set();
  const duplicateIds = [];
  for (const id in data) {
    const item = data[id];
    const name = item.name?.trim().toLowerCase();
    if (name && seenNames.has(name)) {
      duplicateIds.push(id);
    } else if (name) {
      seenNames.add(name);
    }
  }
  if (duplicateIds.length === 0) {
    console.log('No duplicates found in Company Types.');
    return;
  }
  for (const id of duplicateIds) {
    await remove(ref(db, `${refPath}/${id}`));
    console.log(`Removed duplicate Company Type with id: ${id}`);
  }
  console.log('Duplicate removal complete.');
}

removeDuplicates();
