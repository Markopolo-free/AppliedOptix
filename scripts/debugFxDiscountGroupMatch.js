// Script to debug FX Discount Group matching for Pricing Calculator scenario
// Usage: node scripts/debugFxDiscountGroupMatch.js

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const config = require('../firebaseConfig.node.cjs');

// Set your test scenario here:
const TEST_SERVICE_NAME = 'eScooter'; // Adjust as needed
const TEST_SERVICE_CURRENCY = 'EUR'; // Adjust as needed
const TEST_COUNTRY = 'Germany';
const TEST_CITY = 'Berlin';

async function main() {
  initializeApp(config);
  const db = getDatabase();
  const fxDiscountOptionsRef = ref(db, 'fxDiscountOptions');
  const servicesRef = ref(db, 'services');

  // Fetch all FX Discount Groups
  const fxSnap = await get(fxDiscountOptionsRef);
  const fxDiscountOptions = fxSnap.exists() ? Object.values(fxSnap.val()) : [];

  // Fetch all services
  const servicesSnap = await get(servicesRef);
  const services = servicesSnap.exists() ? Object.values(servicesSnap.val()) : [];

  // Find the test service
  const service = services.find(s => s.name.toLowerCase().trim() === TEST_SERVICE_NAME.toLowerCase().trim() && s.currency === TEST_SERVICE_CURRENCY && s.country === TEST_COUNTRY && s.location === TEST_CITY);
  if (!service) {
    console.log('Test service not found:', TEST_SERVICE_NAME, TEST_SERVICE_CURRENCY, TEST_COUNTRY, TEST_CITY);
    return;
  }
  console.log('Test service:', service);

  // Run the same matching logic as Pricing Calculator
  const now = new Date();
  const matches = fxDiscountOptions.filter(opt => {
    const productMatch = opt.product && opt.product.toLowerCase().trim() === service.name.toLowerCase().trim();
    const currencyMatch = opt.currency && opt.currency.toUpperCase().trim() === service.currency.toUpperCase().trim();
    const start = opt.startDate ? new Date(opt.startDate) : null;
    const end = opt.endDate ? new Date(opt.endDate) : null;
    const dateMatch = (!start || now >= start) && (!end || now <= end);
    return productMatch && currencyMatch && dateMatch;
  });

  console.log(`\nMatching FX Discount Groups for service '${service.name}' in ${service.country}, ${service.location}, currency ${service.currency}:`);
  if (matches.length === 0) {
    console.log('No matches found.');
  } else {
    matches.forEach(opt => {
      console.log(`- ${opt.name} | Product: ${opt.product} | Currency: ${opt.currency} | Type: ${opt.discountAmountType} | Amount: ${opt.discountAmount}`);
    });
  }
}

main().catch(console.error);
