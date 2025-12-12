// Script: compareReferenceDataToUsage.js
// Downloads reference data and menu usage, compares, and exports to Excel

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const firebaseConfig = require('../firebaseConfig.node.cjs');

initializeApp(firebaseConfig);
const db = getDatabase();

async function fetchTable(table) {
  const snapshot = await get(ref(db, table));
  return snapshot.exists() ? snapshot.val() : {};
}

async function main() {
  // Reference tables
  const referenceTables = [
    'referenceServiceTypes',
    'referenceCompanyTypes',
    'referenceCountries',
    'referenceCities',
  ];
  const referenceData = {};
  for (const table of referenceTables) {
    referenceData[table] = await fetchTable(table);
  }

  // Service records
  const services = await fetchTable('services');
  // Company records
  const companies = await fetchTable('companies');

  // Prepare comparison
  const serviceRows = [];
  Object.entries(services).forEach(([id, svc]) => {
    serviceRows.push({
      id,
      name: svc.name,
      type: svc.type,
      country: svc.country,
      city: svc.location || '',
      validType: Object.values(referenceData['referenceServiceTypes']).some(r => r.name === svc.type),
      validCountry: Object.values(referenceData['referenceCountries']).some(r => r.name === svc.country),
      validCity: Object.values(referenceData['referenceCities']).some(r => r.name === svc.location),
    });
  });

  const companyRows = [];
  Object.entries(companies).forEach(([id, comp]) => {
    companyRows.push({
      id,
      name: comp.name,
      companyType: comp.companyType,
      country: comp.country,
      city: comp.city,
      validType: Object.values(referenceData['referenceCompanyTypes']).some(r => r.name === comp.companyType),
      validCountry: Object.values(referenceData['referenceCountries']).some(r => r.name === comp.country),
      validCity: Object.values(referenceData['referenceCities']).some(r => r.name === comp.city),
    });
  });

  // Export to Excel
  const wb = xlsx.utils.book_new();
  wb.SheetNames.push('Services');
  wb.Sheets['Services'] = xlsx.utils.json_to_sheet(serviceRows);
  wb.SheetNames.push('Companies');
  wb.Sheets['Companies'] = xlsx.utils.json_to_sheet(companyRows);

  const outPath = path.join(__dirname, 'ReferenceDataComparison.xlsx');
  xlsx.writeFile(wb, outPath);
  console.log('Comparison exported to', outPath);
}

main().catch(err => {
  console.error('Error:', err);
});
