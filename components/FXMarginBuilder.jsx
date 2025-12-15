import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push } from 'firebase/database';
import { logAudit } from '../services/auditService';
import { useAuth } from '../contexts/AuthContext';

const FXMarginBuilder = () => {
  const { currentUser } = useAuth();
  // State for row margin values in the table
  const [rowMargins, setRowMargins] = useState({});
  // State for FX pricings and discount groups (missing, causes ReferenceError)
  const [fxPricings, setFxPricings] = useState([]);
  const [discountGroups, setDiscountGroups] = useState([]);
  // Approve handler for FX price tier
  const handleApprove = async (marginId) => {
    const db = getDatabase();
    const marginRef = ref(db, `fxMarginRecords/${marginId}`);
    await push(marginRef, { status: 'Approved', approver: currentUser?.email, approvedAt: new Date().toISOString() });
    // Optionally, log audit here
    alert('FX price tier approved!');
  };

  // Fetch FX Pricings from Firebase
  useEffect(() => {
    const db = getDatabase();
    const fxPricingsRef = ref(db, 'fxPricings');
    const unsub = onValue(fxPricingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFxPricings(Object.values(data));
      } else {
        setFxPricings([]);
      }
    });
    return () => unsub();
  }, []);

  // Fetch Discount Groups from Firebase
  useEffect(() => {
    const db = getDatabase();
    const discountGroupsRef = ref(db, 'fxDiscountOptions');
    const unsub = onValue(discountGroupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDiscountGroups(Object.values(data));
      } else {
        setDiscountGroups([]);
      }
    });
    return () => unsub();
  }, []);
  // State for margin records (missing, causes ReferenceError)
  const [marginRecords, setMarginRecords] = useState([]);
  // Dropdown state
  const [currencies, setCurrencies] = useState([]);
  const [fxSegments, setFxSegments] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [discountAmountTypes, setDiscountAmountTypes] = useState([]);

  // Form state
  const [form, setForm] = useState({
    currencyPair: '',
    priceTier: '',
    product: '',
    discountAmountType: '',
    coreMargin: ''
  });

  useEffect(() => {
    const db = getDatabase();
    const refDiscountTypes = ref(db, 'referenceDiscountAmountTypes');
    onValue(refDiscountTypes, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const types = Object.values(data).map((item) => item.value).filter(Boolean);
        setDiscountAmountTypes(types);
      } else {
        setDiscountAmountTypes([]);
      }
    });
    const marginRef = ref(db, 'fxMarginRecords');
    onValue(marginRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMarginRecords(Object.entries(data).map(([id, r]) => ({ id, ...r })));
      } else {
        setMarginRecords([]);
      }
    });
  }, []);

  // (Moved below all useState declarations)

  const handleAdd = async () => {
    const db = getDatabase();
    const marginRef = ref(db, 'fxMarginRecords');
    // Calculate AIM (All-In-Margin) based on form/coreMargin and discountGroups
    let aim = 0;
    let aimBreakdown = [];
    const [base, quote] = form.currencyPair.split('_');
    let coreMarginVal = parseFloat(form.coreMargin ? form.coreMargin.replace('%','') : '0');
    let aimVal = coreMarginVal;
    const matchingGroups = discountGroups.filter(g => {
      return g.currency === base && g.product === form.product;
    });
    matchingGroups.forEach(g => {
      if ((g.discountType === '%' || g.discountAmountType === 'percentage') && g.discountValue) {
        const discount = parseFloat(g.discountValue);
        if (!isNaN(discount)) {
          aimVal = aimVal * (1 - discount / 100);
          aimBreakdown.push({
            type: 'Discount Group',
            name: g.name,
            discountType: g.discountType,
            amount: discount,
            channel: g.channel || '',
            segment: g.segment || '',
            totalRelationshipBalance: g.totalRelationshipBalance || '',
            overrideValue: g.overrideValue || ''
          });
        }
      }
    });
    aim = aimVal;
    const record = {
      ...form,
      aim,
      aimBreakdown,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };
    push(marginRef, record);
    await logAudit({
      userId: 'system',
      userName: 'system',
      userEmail: 'system',
      action: 'create',
      entityType: 'fxmargin',
      entityId: '',
      entityName: `${form.currencyPair} ${form.priceTier} ${form.product}`
    });
  };

  useEffect(() => {
    const db = getDatabase();
    const currenciesRef = ref(db, 'referenceCurrencies');
    onValue(currenciesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrencies(Object.entries(data).map(([id, c]) => ({ id, name: c.code || c.name })));
      }
    });
    const fxSegmentsRef = ref(db, 'referenceFXSegments');
    onValue(fxSegmentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFxSegments(Object.entries(data).map(([id, s]) => ({ id, name: s.name })));
      }
    });
    const serviceTypesRef = ref(db, 'referenceServiceTypes');
    onValue(serviceTypesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setServiceTypes(Object.entries(data).map(([id, s]) => ({ id, name: s.name })));
      }
    });
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const currencyPairs = [];
  for (let i = 0; i < currencies.length; i++) {
    for (let j = 0; j < currencies.length; j++) {
      if (i !== j) {
        currencyPairs.push({
          id: `${currencies[i].name}_${currencies[j].name}`,
          name: `${currencies[i].name}/${currencies[j].name}`
        });
      }
    }
  }

  let priceTiers = [];
  if (form.currencyPair) {
    const [base, quote] = form.currencyPair.split('_');
    const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
    if (pricing && pricing.tiers) {
      priceTiers = pricing.tiers.map((tier, idx) => `Tier ${idx + 1}: ${tier.minValue} - ${tier.maxValue}`);
    }
  }

  let coreMargins = [];
  if (form.currencyPair && form.priceTier) {
    const [base, quote] = form.currencyPair.split('_');
    const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
    if (pricing && pricing.tiers) {
      const tierMatch = form.priceTier.match(/Tier (\d+):/);
      if (tierMatch) {
        const idx = parseInt(tierMatch[1], 10) - 1;
        if (pricing.tiers[idx]) {
          coreMargins = [pricing.tiers[idx].marginPercentage.toString() + '%'];
        }
      }
    }
  }

  return (
    <div className="p-6 bg-white rounded shadow max-w-5xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">FX Margin Builder</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Core FX Margin</h2>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4 justify-center text-center" style={{ justifyItems: 'center' }} onSubmit={e => { e.preventDefault(); handleAdd(); }}>
          <div>
            <label className="block mb-1 font-medium">Currency Pair</label>
            <select className="w-full border rounded px-2 py-1" name="currencyPair" value={form.currencyPair} onChange={handleFormChange}>
              <option value="">Select</option>
              {currencyPairs.map(pair => (
                <option key={pair.id} value={pair.id}>{pair.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Price Tier</label>
            <select className="w-full border rounded px-2 py-1" name="priceTier" value={form.priceTier} onChange={handleFormChange}>
              <option value="">Select</option>
              {priceTiers.map(tier => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Product</label>
            <select className="w-full border rounded px-2 py-1" name="product" value={form.product} onChange={handleFormChange}>
              <option value="">Select</option>
              {serviceTypes.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Discount Amount Type</label>
            <select className="w-full border rounded px-2 py-1" name="discountAmountType" value={form.discountAmountType} onChange={handleFormChange}>
              <option value="">Select</option>
              {discountAmountTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Core Margin</label>
            <select className="w-full border rounded px-2 py-1" name="coreMargin" value={form.coreMargin} onChange={handleFormChange}>
              <option value="">Select</option>
              {coreMargins.map(margin => (
                <option key={margin} value={margin}>{margin}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 mt-4 md:mt-0">
            <button type="submit" className="bg-primary-600 text-white px-4 py-1 rounded">Save</button>
            <button type="button" className="bg-yellow-500 text-white px-4 py-1 rounded">Amend</button>
            <button type="button" className="bg-red-500 text-white px-4 py-1 rounded">Delete</button>
            <button type="button" className="bg-gray-400 text-white px-4 py-1 rounded">Cancel</button>
          </div>
        </form>
      </div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Currency Pairs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b text-center">Currency Pair</th>
                <th className="px-4 py-2 border-b text-center">Tier</th>
                <th className="px-4 py-2 border-b text-center">Product</th>
                <th className="px-4 py-2 border-b text-center">Core Margin</th>
                <th className="px-4 py-2 border-b text-center">All-In-Margin (AIM)</th>
              </tr>
            </thead>
            <tbody>
              {currencyPairs
                .map(pair => {
                  const [base, quote] = pair.id.split('_');
                  const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
                  if (!pricing) return null;
                  const marginRecord = marginRecords.find(r => r.currencyPair === pair.id);
                  let tierIdx = null;
                  let priceTier = marginRecord ? marginRecord.priceTier : '';
                  let product = marginRecord ? marginRecord.product : '';
                  let coreMargin = marginRecord ? marginRecord.coreMargin : '';
                  let rowId = marginRecord ? marginRecord.id : pair.id;
                  return (
                    <tr key={rowId}>
                      <td className="px-4 py-2 border-b text-center">{pair.name}</td>
                      <td className="px-4 py-2 border-b text-center">{priceTier}</td>
                      <td className="px-4 py-2 border-b text-center">
                        <select
                          className="w-full border rounded px-2 py-1"
                          value={product}
                          onChange={async (e) => {
                            const newProduct = e.target.value;
                            // Update in DB
                            if (marginRecord && marginRecord.id) {
                              const db = getDatabase();
                              const marginRef = ref(db, `fxMarginRecords/${marginRecord.id}`);
                              await import('firebase/database').then(({ update }) =>
                                update(marginRef, { product: newProduct })
                              );
                            }
                          }}
                        >
                          <option value="">Select</option>
                          {serviceTypes.map(st => (
                            <option key={st.id} value={st.id}>{st.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        <input
                          type="number"
                          value={rowMargins[rowId] !== undefined ? rowMargins[rowId] : (coreMargin ? coreMargin.replace('%','') : '')}
                          min="0"
                          step="0.01"
                          className="border rounded px-2 py-1 w-20"
                          onChange={e => setRowMargins(prev => ({ ...prev, [rowId]: e.target.value }))}
                        />
                      </td>
                      <td className="px-4 py-2 border-b text-center">
                        {(() => {
                          let coreMarginVal = parseFloat(rowMargins[rowId] !== undefined ? rowMargins[rowId] : (coreMargin ? coreMargin.replace('%','') : '0'));
                          let aimVal = coreMarginVal;
                          let breakdown = [];
                          const matchingGroups = discountGroups.filter(g => {
                            return g.currency === base && g.product === product;
                          });
                          matchingGroups.forEach(g => {
                            const discountType = g.discountAmountType || g.discountType || '';
                            const discountValue = g.discountAmount || g.discountValue || 0;
                            if (discountType.toLowerCase().includes('percent')) {
                              const discount = parseFloat(discountValue);
                              if (!isNaN(discount)) {
                                aimVal = aimVal * (1 - discount / 100);
                                breakdown.push({
                                  type: 'Discount Group',
                                  name: g.name,
                                  discountType: discountType,
                                  amount: discount,
                                  channel: g.channel || '',
                                  segment: g.segment || '',
                                  totalRelationshipBalance: g.totalRelationshipBalance || '',
                                  overrideValue: g.overrideValue || ''
                                });
                              }
                            } else if (discountType.toLowerCase().includes('value')) {
                              const discount = parseFloat(discountValue);
                              if (!isNaN(discount)) {
                                aimVal = aimVal - discount;
                                breakdown.push({
                                  type: 'Discount Group',
                                  name: g.name,
                                  discountType: discountType,
                                  amount: discount,
                                  channel: g.channel || '',
                                  segment: g.segment || '',
                                  totalRelationshipBalance: g.totalRelationshipBalance || '',
                                  overrideValue: g.overrideValue || ''
                                });
                              }
                            }
                          });
                          return aimVal.toFixed(2);
                        })()}
                      </td>
                      {currentUser.role === 'Approver' && marginRecord && (
                        <td className="px-4 py-2 border-b text-center">
                          <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => handleApprove(marginRecord.id)}>
                            Approve
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">AIM Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b">Amount</th>
                <th className="px-4 py-2 border-b">Channel</th>
                <th className="px-4 py-2 border-b">Segment</th>
                <th className="px-4 py-2 border-b">Total Relationship Balance</th>
                <th className="px-4 py-2 border-b">Override Value</th>
              </tr>
            </thead>
            <tbody>
              {marginRecords.map(r => (
                r.aimBreakdown && r.aimBreakdown.length > 0 ? r.aimBreakdown.map((b, idx) => (
                  <tr key={r.id + '-' + idx}>
                    <td className="px-4 py-2 border-b">{r.currencyPair}</td>
                    <td className="px-4 py-2 border-b">{r.priceTier}</td>
                    <td className="px-4 py-2 border-b">{r.product}</td>
                    <td className="px-4 py-2 border-b">{b.type}</td>
                    <td className="px-4 py-2 border-b">{b.name}</td>
                    <td className="px-4 py-2 border-b">{b.discountType}</td>
                    <td className="px-4 py-2 border-b">{b.amount}</td>
                    <td className="px-4 py-2 border-b">{b.channel}</td>
                    <td className="px-4 py-2 border-b">{b.segment}</td>
                    <td className="px-4 py-2 border-b">{b.totalRelationshipBalance}</td>
                    <td className="px-4 py-2 border-b">{b.overrideValue}</td>
                  </tr>
                )) : null
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ...existing code...
export default FXMarginBuilder;
