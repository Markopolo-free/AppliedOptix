// Script to extract FX Discount Groups with currency USD and show discount logic
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
      writeFileSync('scripts/USD_FXDiscountGroupsWithLogic.json', JSON.stringify([], null, 2));
      return;
    }
    const fxGroups = Object.entries(fxSnap.val()).map(([id, g]) => ({ id, ...g }));
    const usdGroups = fxGroups.filter(g => g.currency === 'USD');
    console.log(`Found ${usdGroups.length} FX discount groups with currency USD.`);
    usdGroups.forEach((g, idx) => {
      const discountType = g.discountAmountType || g.discountType || '';
      const discountValue = g.discountAmount || g.discountValue || 0;
      let logic = '';
      if (discountType.toLowerCase().includes('percent')) {
        logic = `core margin minus ${discountValue}%`;
      } else if (discountType.toLowerCase().includes('pip')) {
        logic = `core margin minus ${discountValue} pips`;
      } else if (discountType.toLowerCase().includes('value')) {
        logic = `core margin minus ${discountValue}`;
      } else {
        logic = `core margin minus ${discountValue} (${discountType})`;
      }
      console.log(`USD Group #${idx + 1}: Name: ${g.name}, Discount: ${discountValue}, Type: ${discountType}, Logic: ${logic}`);
    });
    writeFileSync('scripts/USD_FXDiscountGroupsWithLogic.json', JSON.stringify(usdGroups, null, 2));
    console.log('Wrote USD FX discount groups to scripts/USD_FXDiscountGroupsWithLogic.json');
  } catch (err) {
    console.error('Error during extraction:', err);
    writeFileSync('scripts/USD_FXDiscountGroupsWithLogic.json', JSON.stringify({ error: err.message }, null, 2));
  }
}

main();
