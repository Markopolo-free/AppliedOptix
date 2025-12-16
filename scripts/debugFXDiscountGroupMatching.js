// Script to debug FX Discount Group matching logic for Pricing Calculator
// Usage: node scripts/debugFXDiscountGroupMatching.js

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const path = require('path');
const fs = require('fs');

// Load Firebase config
const firebaseConfig = require(path.resolve(__dirname, '../firebaseConfig.node.cjs'));
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  // Simulate a Pricing Calculator scenario for eScooter in Germany, Berlin
  const serviceName = 'eScooter'; // Adjust as needed
  const serviceCurrency = 'EUR'; // Adjust as needed
  const country = 'Germany';
  const city = 'Berlin';
  const now = new Date();

  // Fetch FX Discount Groups
  const fxDiscountOptionsSnap = await get(ref(db, 'fxDiscountOptions'));
  const fxDiscountOptions = fxDiscountOptionsSnap.exists() ? Object.values(fxDiscountOptionsSnap.val()) : [];

  // Show all FX Discount Groups
  console.log('All FX Discount Groups:');
  fxDiscountOptions.forEach(opt => {
    console.log(`- ${opt.name} | Product: ${opt.product} | Currency: ${opt.currency} | Start: ${opt.startDate} | End: ${opt.endDate}`);
  });

  // Find matches using the same logic as Pricing Calculator
  const matches = fxDiscountOptions.filter(opt => {
    const productMatch = (opt.product || '').trim().toLowerCase() === serviceName.trim().toLowerCase();
    const currencyMatch = (opt.currency || '').trim().toUpperCase() === serviceCurrency.trim().toUpperCase();
    const start = opt.startDate ? new Date(opt.startDate) : null;
    const end = opt.endDate ? new Date(opt.endDate) : null;
    const dateMatch = (!start || now >= start) && (!end || now <= end);
    return productMatch && currencyMatch && dateMatch;
  });

  console.log('\nMatching FX Discount Groups for Pricing Calculator:');
  if (matches.length === 0) {
    console.log('No matches found.');
  } else {
    matches.forEach(opt => {
      console.log(`- ${opt.name} | Product: ${opt.product} | Currency: ${opt.currency} | Start: ${opt.startDate} | End: ${opt.endDate}`);
    });
  }
}

main().catch(err => {
  console.error('Error running debug script:', err);
  process.exit(1);
});
