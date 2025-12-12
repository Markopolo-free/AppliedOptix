// This script reads userDiscountGroups from Firebase and writes only USD and GBP groups to a JSON file for review in the editor.
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { writeFileSync } from 'fs';

const { default: firebaseConfig } = await import('../firebaseConfig.node.cjs');

console.log('Initializing Firebase...');
initializeApp(firebaseConfig);
const db = getDatabase();

async function main() {
  try {
    console.log('Fetching userDiscountGroups from Firebase...');
    const discountSnap = await get(ref(db, 'userDiscountGroups'));
    if (!discountSnap.exists()) {
      console.log('No userDiscountGroups found. Writing empty file.');
      writeFileSync('scripts/USD_GBP_DiscountGroups.json', JSON.stringify([], null, 2));
      return;
    }
    const discountGroups = Object.entries(discountSnap.val()).map(([id, g]) => ({ id, ...g }));
    console.log(`Found ${discountGroups.length} discount groups.`);
    // Log all unique currency values
    const allCurrencies = Array.from(new Set(discountGroups.map(g => g.currency)));
    console.log('Currencies found in discount groups:', allCurrencies);
    // Log full data for each group
    discountGroups.forEach((g, idx) => {
      console.log(`Group #${idx + 1}:`, JSON.stringify(g, null, 2));
    });
    // Write all discount groups to file for inspection
    writeFileSync('scripts/ALL_DiscountGroups.json', JSON.stringify(discountGroups, null, 2));
    console.log('Wrote all discount groups to scripts/ALL_DiscountGroups.json');
  } catch (err) {
    console.error('Error during extraction:', err);
    writeFileSync('scripts/USD_GBP_DiscountGroups.json', JSON.stringify({ error: err.message }, null, 2));
  }
}

main();
