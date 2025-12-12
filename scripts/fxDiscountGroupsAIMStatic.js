// Static script to show which FX Discount Groups should be applied to AIM calculation for each currency pair
// Reads from static example data and writes results to a file for review in the editor

const fs = require('fs');

// Example data for margin records
const marginRecords = [
  { id: '1', currencyPair: 'USD_EUR', product: 'FX_SPOT' },
  { id: '2', currencyPair: 'GBP_USD', product: 'FX_FORWARD' }
];

// Example data for discount groups
const discountGroups = [
  { id: 'dg1', name: 'USD FX Discount Group', currency: 'USD', serviceIds: ['FX_SPOT', 'FX_FORWARD'], discountType: '%', discountValue: '5' },
  { id: 'dg2', name: 'GBP FX Discount Group', currency: 'GBP', serviceIds: ['FX_FORWARD'], discountType: '%', discountValue: '3' }
];

const results = marginRecords.map(r => {
  const [base, quote] = r.currencyPair.split('_');
  const applicableGroups = discountGroups.filter(g => g.currency === base && g.serviceIds && g.serviceIds.includes(r.product));
  return {
    currencyPair: r.currencyPair,
    product: r.product,
    applicableDiscountGroups: applicableGroups.map(g => ({ name: g.name, currency: g.currency, discount: g.discountValue + g.discountType }))
  };
});

fs.writeFileSync('scripts/fxDiscountGroupsAIMResults.json', JSON.stringify(results, null, 2));
