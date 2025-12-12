// Script to extract all unique country names from all menu items/components that store country data, and load them into referenceCountries in Firebase, avoiding duplicates.
// Usage: node scripts/seedReferenceCountriesFromData.js

const { getDatabase, ref, get, push } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const firebaseConfig = require('../firebaseConfig.node.cjs');

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// All reference data paths that may contain country info
const paths = [
  'referenceCities',
  'fxCampaigns',
  'services',
  'zones',
  // Add more if needed
];

async function collectUniqueCountries() {
  const countrySet = new Set();
  for (const path of paths) {
    const snap = await get(ref(db, path));
    if (!snap.exists()) continue;
    const data = snap.val();
    for (const key of Object.keys(data)) {
      const item = data[key];
      if (item.country && typeof item.country === 'string' && item.country.trim()) {
        countrySet.add(item.country.trim());
      }
      // For fxCampaigns, also check countryId
      if (item.countryId && typeof item.countryId === 'string' && item.countryId.trim()) {
        countrySet.add(item.countryId.trim());
      }
    }
  }
  return Array.from(countrySet).sort();
}

async function seedReferenceCountries() {
  const countries = await collectUniqueCountries();
  if (countries.length === 0) {
    console.log('No countries found in data.');
    return;
  }
  // Get existing referenceCountries
  const refCountries = ref(db, 'referenceCountries');
  const snap = await get(refCountries);
  const existing = snap.exists() ? Object.values(snap.val()).map((c) => c.name) : [];
  let added = 0;
  for (const name of countries) {
    if (!existing.includes(name)) {
      await push(refCountries, {
        name,
        dateAdded: new Date().toISOString(),
        addedBy: 'seedReferenceCountriesFromData.js',
      });
      added++;
    }
  }
  console.log(`Seeded ${added} new countries. Total unique found: ${countries.length}`);
}

seedReferenceCountries();
