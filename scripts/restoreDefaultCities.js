// scripts/restoreDefaultCities.js
// Run with: node scripts/restoreDefaultCities.js
// This script restores the default German cities to the referenceCities node in Firebase.

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push } from 'firebase/database';
import firebaseConfig from '../firebaseConfig.node.cjs';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const defaultCities = [
  { name: 'Berlin', population: 3850000 },
  { name: 'Hamburg', population: 1900000 },
  { name: 'Munich', population: 1600000 },
  { name: 'Cologne', population: 1100000 },
  { name: 'Frankfurt', population: 773000 },
  { name: 'Stuttgart', population: 633000 },
  { name: 'Düsseldorf', population: 629000 },
  { name: 'Leipzig', population: 628000 },
  { name: 'Dortmund', population: 612000 },
  { name: 'Essen', population: 587000 },
  { name: 'Bremen', population: 577000 },
  { name: 'Dresden', population: 563000 },
  { name: 'Hanover', population: 545000 },
  { name: 'Nuremberg', population: 544000 },
  { name: 'Duisburg', population: 504000 }
];

async function main() {
  try {
    const citiesRef = ref(db, 'referenceCities');
    for (const city of defaultCities) {
      await push(citiesRef, {
        ...city,
        dateAdded: new Date().toISOString(),
        addedBy: 'System'
      });
    }
    console.log('Default cities restored to referenceCities.');
  } catch (err) {
    console.error('Error restoring cities:', err);
  }
}

main();
