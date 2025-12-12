// Script to show which FX Discount Groups should be applied to AIM calculation for each currency pair
// Reads margin records and discount groups, outputs which discount group applies to each record

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const { default: firebaseConfig } = await import('../firebaseConfig.node.cjs');

initializeApp(firebaseConfig);
const db = getDatabase();

async function main() {
  const marginSnap = await get(ref(db, 'fxMarginRecords'));
  const discountSnap = await get(ref(db, 'fxDiscountOptions'));
  if (!marginSnap.exists() || !discountSnap.exists()) {
    console.log('No margin records or FX discount groups found.');
    return;
  }
  const marginRecords = Object.entries(marginSnap.val()).map(([id, r]) => ({ id, ...r }));
  const discountGroups = Object.entries(discountSnap.val()).map(([id, g]) => ({ id, ...g }));

  discountGroups
    .filter(g => g.currency === 'USD' || g.currency === 'GBP')
    .forEach(g => {
      console.log(`FX Discount Group: ${g.name}`);
      console.log(`  Currency: ${g.currency}`);
      console.log(`  Discount: ${g.discountAmount}${g.discountAmountType}`);
      if (g.serviceItem) {
        console.log(`  Product: ${g.serviceItem}`);
      }
      console.log('');
    });
}

main();
