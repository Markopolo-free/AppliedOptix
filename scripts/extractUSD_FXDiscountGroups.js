// Script to extract FX Discount Groups with currency USD from Firebase
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { writeFileSync } from 'fs';

const { default: firebaseConfig } = await import('../firebaseConfig.node.cjs');

console.log('Initializing Firebase...');
initializeApp(firebaseConfig);
const db = getDatabase();

async function main() {
  try {
    console.log('Fetching fxDiscountOptions from Firebase...');
    const fxSnap = await get(ref(db, 'fxDiscountOptions'));
    if (!fxSnap.exists()) {
      console.log('No fxDiscountOptions found. Writing empty file.');
      writeFileSync('scripts/USD_FXDiscountGroups.json', JSON.stringify([], null, 2));
      return;
    }
    const fxGroups = Object.entries(fxSnap.val()).map(([id, g]) => ({ id, ...g }));
    const usdGroups = fxGroups.filter(g => g.currency === 'USD');
    console.log(`Found ${usdGroups.length} FX discount groups with currency USD.`);
    usdGroups.forEach((g, idx) => {
      console.log(`USD Group #${idx + 1}:`, JSON.stringify(g, null, 2));
    });
    writeFileSync('scripts/USD_FXDiscountGroups.json', JSON.stringify(usdGroups, null, 2));
    console.log('Wrote USD FX discount groups to scripts/USD_FXDiscountGroups.json');
  } catch (err) {
    console.error('Error during extraction:', err);
    writeFileSync('scripts/USD_FXDiscountGroups.json', JSON.stringify({ error: err.message }, null, 2));
  }
}

main();
