// Script to test AIM calculation logic for USD currency pairs using FX Discount Groups
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const { default: firebaseConfig } = await import('../firebaseConfig.node.cjs');
console.log('Initializing Firebase...');
initializeApp(firebaseConfig);
const db = getDatabase();

async function main() {
  try {
    // Fetch FX Discount Groups
    console.log('Fetching FX Discount Groups...');
    const fxSnap = await get(ref(db, 'fxDiscountOptions'));
    console.log('FX Discount Groups fetch complete.');
    if (!fxSnap.exists()) {
      console.log('No FX Discount Groups found in Firebase.');
    } else {
      console.log('Raw FX Discount Groups data:', JSON.stringify(fxSnap.val(), null, 2));
    }
    const fxGroups = fxSnap.exists() ? Object.entries(fxSnap.val()).map(([id, g]) => ({ id, ...g })) : [];
    // Fetch FX Margin Records
    console.log('Fetching FX Margin Records...');
    const marginSnap = await get(ref(db, 'fxMarginRecords'));
    console.log('FX Margin Records fetch complete.');
    const marginRecords = marginSnap.exists() ? Object.entries(marginSnap.val()).map(([id, r]) => ({ id, ...r })) : [];

    // Filter margin records for currency pairs starting with USD
    const usdMarginRecords = marginRecords.filter(r => r.currencyPair && r.currencyPair.startsWith('USD'));

    // Debug: Print all FX Discount Groups for USD
    console.log('\nAll FX Discount Groups for USD:');
    fxGroups.filter(g => g.currency === 'USD').forEach(g => {
      console.log(`  Name: ${g.name}, Currency: ${g.currency}, Product: ${g.product}, Discount: ${g.discountAmount || g.discountValue}, Type: ${g.discountAmountType || g.discountType}`);
    });

    // Debug: Print all USD margin records
    console.log('\nAll USD Margin Records:');
    usdMarginRecords.forEach((record, idx) => {
      console.log(`  #${idx + 1}: Currency Pair: ${record.currencyPair}, Product: ${record.product}, Core Margin: ${record.coreMargin}`);
    });
    console.log(`Found ${usdMarginRecords.length} FX Margin records with currency pair starting USD.`);
    usdMarginRecords.forEach((record, idx) => {
      const [base, quote] = record.currencyPair.split('_');
      let coreMarginVal = parseFloat(record.coreMargin ? record.coreMargin.replace('%','') : '0');
      let aimVal = coreMarginVal;
      let breakdown = [];
      // Find matching FX Discount Groups (currency and product must match)
      const matchingGroups = fxGroups.filter(g => g.currency === base && g.product === record.product);
      matchingGroups.forEach(g => {
        const discountType = g.discountAmountType || g.discountType || '';
        const discountValue = g.discountAmount || g.discountValue || 0;
        if (discountType.toLowerCase().includes('percent')) {
          const discount = parseFloat(discountValue);
          if (!isNaN(discount)) {
            aimVal = aimVal * (1 - discount / 100);
            breakdown.push(`${g.name}: -${discount}%`);
          }
        } else if (discountType.toLowerCase().includes('value')) {
          const discount = parseFloat(discountValue);
          if (!isNaN(discount)) {
            aimVal = aimVal - discount;
            breakdown.push(`${g.name}: -${discount}`);
          }
        }
      });
      console.log(`\nRecord #${idx + 1}:`);
      console.log(`  Currency Pair: ${record.currencyPair}`);
      console.log(`  Product: ${record.product}`);
      console.log(`  Core Margin: ${coreMarginVal}`);
      console.log(`  AIM: ${aimVal.toFixed(4)}`);
      console.log(`  Breakdown: ${breakdown.join(', ') || 'No discounts applied'}`);
      // Show matching FX Discount Groups for this record
      if (matchingGroups.length > 0) {
        console.log('  Matching FX Discount Groups:');
        matchingGroups.forEach(g => {
          console.log(`    - Name: ${g.name}, Currency: ${g.currency}, Discount: ${g.discountAmount || g.discountValue}, Type: ${g.discountAmountType || g.discountType}`);
        });
      } else {
        console.log('  No matching FX Discount Groups.');
      }
    });

  } catch (err) {
    console.error('Error during AIM calculation test:', err);
  }
}

main();
