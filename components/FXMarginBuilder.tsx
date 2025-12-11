import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, update, remove, serverTimestamp } from 'firebase/database';
import { logAudit } from '../services/auditService';


const FXMarginBuilder: React.FC = () => {
  // State for editing a row in the Currency Pairs table
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editRowMargin, setEditRowMargin] = useState<string>('');

  // Dropdown state
  const [currencies, setCurrencies] = useState<{ id: string; name: string }[]>([]);
  const [fxSegments, setFxSegments] = useState<{ id: string; name: string }[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  const [discountAmountTypes, setDiscountAmountTypes] = useState<string[]>([]);

  // Form state
  const [form, setForm] = useState({
    currencyPair: '',
    priceTier: '',
    product: '',
    discountAmountType: '',
    coreMargin: ''
  });

  // FX Pricing state for dynamic tiers
    // Fetch Discount Amount Types from reference data
    useEffect(() => {
    const db = getDatabase();
    const refDiscountTypes = ref(db, 'referenceDiscountAmountTypes');
    onValue(refDiscountTypes, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const types = Object.values(data).map((item: any) => item.value).filter(Boolean);
        setDiscountAmountTypes(types);
      } else {
        setDiscountAmountTypes([]);
      }
    });
  }, []);
  const [fxPricings, setFxPricings] = useState<any[]>([]);
  // Fetch FX Pricings for dynamic price tiers
  useEffect(() => {
    const db = getDatabase();
    const fxPricingsRef = ref(db, 'fxPricings');
    onValue(fxPricingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFxPricings(Object.entries(data).map(([id, fx]: [string, any]) => ({ id, ...fx })));
      } else {
        setFxPricings([]);
      }
    });
  }, []);

  // Margin records state
  const [marginRecords, setMarginRecords] = useState<any[]>([]);
  // FX Campaigns and Discount Groups
  const [fxCampaigns, setFxCampaigns] = useState<any[]>([]);
  const [discountGroups, setDiscountGroups] = useState<any[]>([]);
  // AIM breakdown state
  const [aimBreakdown, setAimBreakdown] = useState<any[]>([]);
  const [aim, setAim] = useState<number>(0);
  // Audit log state
  const [auditLog, setAuditLog] = useState<any[]>([]);
  // Fetch FX Campaigns and Discount Groups
  useEffect(() => {
    const db = getDatabase();
    // FX Campaigns
    const fxCampaignsRef = ref(db, 'fxCampaigns');
    onValue(fxCampaignsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFxCampaigns(Object.entries(data).map(([id, c]: [string, any]) => ({ id, ...c })));
      }
    });
    // Discount Groups
    const discountGroupsRef = ref(db, 'userDiscountGroups');
    onValue(discountGroupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDiscountGroups(Object.entries(data).map(([id, g]: [string, any]) => ({ id, ...g })));
              <div className="flex items-end gap-2 mt-4 md:mt-0">
                <button type="submit" className="bg-primary-600 text-white px-4 py-1 rounded">Save</button>
    // Margin records (for table)
    const marginRef = ref(db, 'fxMarginRecords');
    onValue(marginRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMarginRecords(Object.entries(data).map(([id, r]: [string, any]) => ({ id, ...r })));
      } else {
        setMarginRecords([]);
      }
    });
    // Audit log
    const auditRef = ref(db, 'auditLogs');
    onValue(auditRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAuditLog(Object.entries(data).map(([id, l]: [string, any]) => ({ id, ...l })).reverse());
      }
    });
  }, []);

  // Calculate AIM and breakdown when form changes
  useEffect(() => {
    if (!form.currencyPair) {
      setAim(0);
      setAimBreakdown([]);
      return;
    }
    // Parse base/quote from currencyPair
    const [base, quote] = form.currencyPair.split('_');
    // Find matching campaigns and discount groups
    const campaignDiscounts = fxCampaigns.filter(c => c.currency === base || c.currency === quote);
    const groupDiscounts = discountGroups.filter(g => g.serviceIds && g.serviceIds.includes(form.product));
    // Sum up all discounts (as numbers if possible)
    let total = 0;
    const breakdown: any[] = [];
    campaignDiscounts.forEach(c => {
      const amt = parseFloat(c.discountAmount);
      if (!isNaN(amt)) {
        total += amt;
        breakdown.push({
          type: 'Campaign',
          name: c.name,
          discountType: c.discountType,
          amount: amt,
          channel: c.channel || '',
          segment: c.segment || '',
          totalRelationshipBalance: c.totalRelationshipBalance || '',
          overrideValue: c.overrideValue || ''
        });
      }
    });
    groupDiscounts.forEach(g => {
      const amt = parseFloat(g.discountValue);
      if (!isNaN(amt)) {
        total += amt;
        breakdown.push({
          type: 'Discount Group',
          name: g.name,
          discountType: g.discountType,
          amount: amt,
          channel: '',
          segment: '',
          totalRelationshipBalance: '',
          overrideValue: ''
        });
      }
    });
    setAim(total);
    setAimBreakdown(breakdown);
  }, [form, fxCampaigns, discountGroups]);

  // CRUD handlers
  const handleAdd = async () => {
    const db = getDatabase();
    const marginRef = ref(db, 'fxMarginRecords');
    const record = {
      ...form,
      aim,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };
    const newRef = push(marginRef, record);
    await logAudit({
      userId: 'system',
      userName: 'system',
      userEmail: 'system',
      action: 'create',
      entityType: 'fxmargin',
      entityId: newRef.key,
      entityName: `${form.currencyPair} ${form.priceTier} ${form.product}`
    });
  };

  // (Amend, Delete, Cancel can be implemented similarly)


  useEffect(() => {
    const db = getDatabase();
    // Currencies
    const currenciesRef = ref(db, 'referenceCurrencies');
    onValue(currenciesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrencies(Object.entries(data).map(([id, c]: [string, any]) => ({ id, name: c.code || c.name })));
      }
    });
    // FX Segments
    const fxSegmentsRef = ref(db, 'referenceFXSegments');
    onValue(fxSegmentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFxSegments(Object.entries(data).map(([id, s]: [string, any]) => ({ id, name: s.name })));
      }
    });
    // Service Types (as proxy for products)
    const serviceTypesRef = ref(db, 'referenceServiceTypes');
    onValue(serviceTypesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setServiceTypes(Object.entries(data).map(([id, s]: [string, any]) => ({ id, name: s.name })));
      }
    });
  }, []);

  // Handle form changes
  const handleFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Build currency pairs from currencies
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

  // Price tiers sourced from FX Pricing Management
  let priceTiers: string[] = [];
  if (form.currencyPair) {
    // Parse base/quote from currencyPair
    const [base, quote] = form.currencyPair.split('_');
    // Find matching FX pricing record
    const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
    if (pricing && pricing.tiers) {
      priceTiers = pricing.tiers.map((tier: any, idx: number) => `Tier ${idx + 1}: ${tier.minValue} - ${tier.maxValue}`);
    }
  }
  // Remove marginTierTypes

  // Core margins sourced from FX Pricing Management for the selected price tier
  // Editable core margin state
  const [editCoreMargin, setEditCoreMargin] = useState<string>('');
  let coreMarginTierIdx: number | null = null;
  let selectedPricing: any = null;
  if (form.currencyPair && form.priceTier) {
    const [base, quote] = form.currencyPair.split('_');
    selectedPricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
    if (selectedPricing && selectedPricing.tiers) {
      const tierMatch = form.priceTier.match(/Tier (\d+):/);
      if (tierMatch) {
        const idx = parseInt(tierMatch[1], 10) - 1;
        coreMarginTierIdx = idx;
      }
    }
  }

  // Set editCoreMargin when currencyPair or priceTier changes
  useEffect(() => {
    if (form.currencyPair && form.priceTier) {
      const [base, quote] = form.currencyPair.split('_');
      const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
      if (pricing && pricing.tiers) {
        const tierMatch = form.priceTier.match(/Tier (\d+):/);
        if (tierMatch) {
          const idx = parseInt(tierMatch[1], 10) - 1;
          if (pricing.tiers[idx]) {
            setEditCoreMargin(pricing.tiers[idx].marginPercentage.toString());
            return;
          }
        }
      }
    }
    setEditCoreMargin('');
  }, [form.currencyPair, form.priceTier, fxPricings]);

  return (
    <div className="p-6 bg-white rounded shadow max-w-5xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6">FX Margin Builder</h1>

      {/* Core FX Margin Form */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Core FX Margin</h2>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="block mb-1 font-medium">Core Margin (%)</label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={editCoreMargin}
              onChange={e => setEditCoreMargin(e.target.value)}
              disabled={!form.currencyPair || !form.priceTier}
              min="0"
              step="0.01"
            />
            {coreMarginTierIdx !== null && selectedPricing && (
              <button
                type="button"
                className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  const db = getDatabase();
                  const pricingRef = ref(db, `fxPricings/${selectedPricing.id}`);
                  const updatedTiers = [...selectedPricing.tiers];
                  updatedTiers[coreMarginTierIdx] = {
                    ...updatedTiers[coreMarginTierIdx],
                    marginPercentage: parseFloat(editCoreMargin)
                  };
                  await update(pricingRef, { tiers: updatedTiers });
                  alert('Core margin updated!');
                }}
              >
                Save Core Margin
              </button>
            )}
          </div>
          <div className="flex items-end gap-2 mt-4 md:mt-0">
            <button type="button" className="bg-primary-600 text-white px-4 py-1 rounded">Add</button>
            <button type="button" className="bg-yellow-500 text-white px-4 py-1 rounded">Amend</button>
            <button type="button" className="bg-red-500 text-white px-4 py-1 rounded">Delete</button>
            <button type="button" className="bg-gray-400 text-white px-4 py-1 rounded">Cancel</button>
          </div>
        </form>
      </div>

      {/* Currency Pair Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Currency Pairs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b">Currency Pair</th>
                <th className="px-4 py-2 border-b">Tier</th>
                <th className="px-4 py-2 border-b">Product</th>
                <th className="px-4 py-2 border-b">Core Margin</th>
                <th className="px-4 py-2 border-b">All-In-Margin (AIM)</th>
              </tr>
            </thead>
            <tbody>
              {marginRecords.length === 0 ? (
                <tr>
                  <td className="px-4 py-2 border-b text-gray-400" colSpan={6}>No data yet</td>
                </tr>
              ) : (
                marginRecords.map(r => {
                  const [base, quote] = r.currencyPair.split('_');
                  const pricing = fxPricings.find(p => p.baseCurrency === base && p.quoteCurrency === quote);
                  let tierIdx = null;
                  if (pricing && r.priceTier) {
                    const tierMatch = r.priceTier.match(/Tier (\d+):/);
                    if (tierMatch) tierIdx = parseInt(tierMatch[1], 10) - 1;
                  }
                  // Controlled input state per row
                  const [rowMargin, setRowMargin] = useState(r.coreMargin ? r.coreMargin.replace('%','') : '');
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-2 border-b">{r.currencyPair}</td>
                      <td className="px-4 py-2 border-b">{r.priceTier}</td>
                      <td className="px-4 py-2 border-b">{r.product}</td>
                      <td className="px-4 py-2 border-b">
                        <input
                          type="number"
                          value={rowMargin}
                          min="0"
                          step="0.01"
                          className="border rounded px-2 py-1 w-20"
                          onChange={e => setRowMargin(e.target.value)}
                          onBlur={async (e) => {
                            const newMargin = e.target.value;
                            if (pricing && tierIdx !== null && newMargin !== r.coreMargin?.replace('%','')) {
                              const db = getDatabase();
                              const pricingRef = ref(db, `fxPricings/${pricing.id}`);
                              const updatedTiers = [...pricing.tiers];
                              updatedTiers[tierIdx] = {
                                ...updatedTiers[tierIdx],
                                marginPercentage: parseFloat(newMargin)
                              };
                              await update(pricingRef, { tiers: updatedTiers });
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-2 border-b">{r.aim}</td>
                    </tr>
                  );
                })
              )}
            
            </tbody>
          </table>
        </div>
      </div>

      {/* AIM Breakdown */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">AIM Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b">Type</th>
                <th className="px-4 py-2 border-b">Name</th>
                <th className="px-4 py-2 border-b">Discount Type</th>
                <th className="px-4 py-2 border-b">Amount</th>
                <th className="px-4 py-2 border-b">Channel</th>
                <th className="px-4 py-2 border-b">Segment</th>
                <th className="px-4 py-2 border-b">Total Relationship Balance</th>
                <th className="px-4 py-2 border-b">Override Value</th>
              </tr>
            </thead>
            <tbody>
              {aimBreakdown.length === 0 ? (
                <tr>
                  <td className="px-4 py-2 border-b text-gray-400" colSpan={8}>No breakdown data</td>
                </tr>
              ) : (
                aimBreakdown.map((b, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 border-b">{b.type}</td>
                    <td className="px-4 py-2 border-b">{b.name}</td>
                    <td className="px-4 py-2 border-b">{b.discountType}</td>
                    <td className="px-4 py-2 border-b">{b.amount}</td>
                    <td className="px-4 py-2 border-b">{b.channel}</td>
                    <td className="px-4 py-2 border-b">{b.segment}</td>
                    <td className="px-4 py-2 border-b">{b.totalRelationshipBalance}</td>
                    <td className="px-4 py-2 border-b">{b.overrideValue}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 font-bold">AIM Total: {aim}</div>
      </div>
      {/* Audit Records removed: audit log is now only on the main Audit Log page */}
    </div>
  );
};

export default FXMarginBuilder;
