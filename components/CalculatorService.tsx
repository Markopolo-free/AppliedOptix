

import React, { useState, useEffect } from 'react';
import { getDatabase, ref as dbRef, onValue } from 'firebase/database';
import { CustomerActivity, Service, PricingRule, Campaign, LoyaltyProgram, Bundle, FXDiscountOption, FXCampaign } from '../types';

// Temporary stub to prevent crash if missing
export async function calculatePricing(
  activity: CustomerActivity,
  services: Service[],
  pricingRules: PricingRule[],
  campaigns: Campaign[],
  loyaltyPrograms: LoyaltyProgram[],
  bundles: Bundle[],
  fxDiscountOptions: FXDiscountOption[],
  fxCampaigns: FXCampaign[]
) {
  let breakdown: string[] = [];
  let ruleDetails: any = {};
  if (!activity || !activity.serviceId) {
    return {
      defaultPrice: 0,
      finalPrice: 0,
      reason: 'No activity or service selected.',
      breakdown,
      ruleDetails
    };
  }
  // 1. Find the service
  const service = services.find(s => s.id === activity.serviceId);
  if (!service) {
    return {
      defaultPrice: 0,
      finalPrice: 0,
      reason: 'Service not found.',
      breakdown,
      ruleDetails
    };
  }
  ruleDetails.service = service;
  // 2. Calculate base price
  let usage = 0;
  if (activity.pricingBasis === 'Time (hour)') {
    usage = activity.timeUsed || 0;
    breakdown.push(`Usage: ${usage} hours`);
  } else {
    usage = activity.distanceTravelled || 0;
    breakdown.push(`Usage: ${usage} km`);
  }
  let defaultPrice = service.price * usage;
  breakdown.push(`Base price: €${service.price} x ${usage} = €${defaultPrice.toFixed(2)}`);
  // 3. Apply pricing rule (if any)
  let pricingRule = pricingRules.find(r =>
    (r.serviceIds?.includes(service.id) || r.serviceTypeEntries?.some(e => e.serviceTypeName === service.type)) &&
    r.basis === activity.pricingBasis
  );
  if (pricingRule) {
    ruleDetails.pricingRule = pricingRule;
    defaultPrice = pricingRule.rate * usage;
    breakdown.push(`Pricing rule applied: €${pricingRule.rate} x ${usage} = €${defaultPrice.toFixed(2)}`);
  }
  // 4. Apply campaign (if any)
  let campaign = campaigns.find(c =>
    c.serviceIds?.includes(service.id) &&
    (!c.countryId || c.countryId === service.country) &&
    (!c.cityId || c.cityId === service.location)
  );
  let campaignDiscount = 0;
  if (campaign) {
    ruleDetails.campaign = campaign;
    if (campaign.discountType === 'Percentage') {
      campaignDiscount = defaultPrice * (campaign.discountValue / 100);
      breakdown.push(`Campaign discount: ${campaign.discountValue}% = -€${campaignDiscount.toFixed(2)}`);
    } else {
      campaignDiscount = campaign.discountValue;
      breakdown.push(`Campaign discount: -€${campaignDiscount.toFixed(2)}`);
    }
  }
  // 4b. Apply ALL matching FX Campaigns
  let fxCampaignsMatched = fxCampaigns.filter(fx => {
    // Match on country, city, currency, and product (serviceItem)
    const countryMatch = !fx.countryId || fx.countryId === service.country;
    const cityMatch = !fx.cityId || fx.cityId === service.location;
    const currencyMatch = !fx.currency || fx.currency === service.currency;
    const productMatch = !fx.serviceItem || fx.serviceItem === service.name;
    // Date range check
    const now = new Date();
    const start = fx.startDate ? new Date(fx.startDate) : null;
    const end = fx.endDate ? new Date(fx.endDate) : null;
    const dateMatch = (!start || now >= start) && (!end || now <= end);
    return countryMatch && cityMatch && currencyMatch && productMatch && dateMatch;
  });
  let fxCampaignDiscount = 0;
  if (fxCampaignsMatched.length > 0) {
    ruleDetails.fxCampaigns = fxCampaignsMatched;
    fxCampaignsMatched.forEach(fxCampaign => {
      // Parse discountAmount string (e.g., "0.5% cashback", "$1 for every $100 spent")
      let pctMatch = fxCampaign.discountAmount.match(/([\d.]+)\s*%/);
      let valMatch = fxCampaign.discountAmount.match(/([\d.]+)/);
      if (pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const amt = defaultPrice * (pct / 100);
        fxCampaignDiscount += amt;
        breakdown.push(`FX Campaign: ${fxCampaign.name} - ${pct}% = -€${amt.toFixed(2)}`);
      } else if (valMatch) {
        const val = parseFloat(valMatch[1]);
        fxCampaignDiscount += val;
        breakdown.push(`FX Campaign: ${fxCampaign.name} - -€${val.toFixed(2)}`);
      } else {
        breakdown.push(`FX Campaign: ${fxCampaign.name} - Could not parse amount (${fxCampaign.discountAmount})`);
      }
    });
  }
  // 4c. Apply ALL matching FX Discount Groups
  let fxDiscounts = fxDiscountOptions.filter(opt => {
    // Match on product (service.id), currency, and date
    const productMatch = opt.product === service.id;
    const currencyMatch = opt.currency === service.currency;
    const now = new Date();
    const start = opt.startDate ? new Date(opt.startDate) : null;
    const end = opt.endDate ? new Date(opt.endDate) : null;
    const dateMatch = (!start || now >= start) && (!end || now <= end);
    if (!productMatch) {
      breakdown.push(`[DEBUG] FX Discount Group '${opt.name}' not matched: product '${opt.product}' !== service.id '${service.id}'`);
    }
    if (!currencyMatch) {
      breakdown.push(`[DEBUG] FX Discount Group '${opt.name}' not matched: currency '${opt.currency}' !== service.currency '${service.currency}'`);
    }
    if (!dateMatch) {
      breakdown.push(`[DEBUG] FX Discount Group '${opt.name}' not matched: date not in range (${opt.startDate} - ${opt.endDate})`);
    }
    if (productMatch && currencyMatch && dateMatch) {
      breakdown.push(`[DEBUG] FX Discount Group '${opt.name}' matched.`);
    }
    return productMatch && currencyMatch && dateMatch;
  });
  let fxDiscountAmount = 0;
  if (fxDiscounts.length > 0) {
    ruleDetails.fxDiscounts = fxDiscounts;
    fxDiscounts.forEach(fxDiscount => {
      if (fxDiscount.discountAmountType === 'percentage') {
        const amt = defaultPrice * (fxDiscount.discountAmount / 100);
        fxDiscountAmount += amt;
        breakdown.push(`FX Discount Group: ${fxDiscount.name} - ${fxDiscount.discountAmount}% = -€${amt.toFixed(2)}`);
      } else if (fxDiscount.discountAmountType === 'value') {
        fxDiscountAmount += fxDiscount.discountAmount;
        breakdown.push(`FX Discount Group: ${fxDiscount.name} - -€${fxDiscount.discountAmount.toFixed(2)}`);
      } else if (fxDiscount.discountAmountType === 'pips') {
        breakdown.push(`FX Discount Group: ${fxDiscount.name} - ${fxDiscount.discountAmount} pips (not applied to price)`);
      } else {
        breakdown.push(`FX Discount Group: ${fxDiscount.name} - Unknown discount type (${fxDiscount.discountAmountType})`);
      }
    });
  }
  // 5. Apply bundle (if any)
  let bundle = bundles.find(b => b.serviceIds?.includes(service.id));
  let bundleDiscount = 0;
  if (bundle) {
    ruleDetails.bundle = bundle;
    if (bundle.discountType === 'Percentage') {
      bundleDiscount = defaultPrice * (bundle.discountValue / 100);
      breakdown.push(`Bundle discount: ${bundle.discountValue}% = -€${bundleDiscount.toFixed(2)}`);
    } else {
      bundleDiscount = bundle.discountValue;
      breakdown.push(`Bundle discount: -€${bundleDiscount.toFixed(2)}`);
    }
  }
  // 6. Apply loyalty program (if any)
  let loyalty = loyaltyPrograms.find(l => l.cityName === activity.city);
  if (loyalty) {
    ruleDetails.loyalty = loyalty;
    breakdown.push(`Loyalty program: ${loyalty.name} (Points per Euro: ${loyalty.pointsPerEuro})`);
  }
  // 7. Final price
  let finalPrice = defaultPrice - campaignDiscount - bundleDiscount - fxCampaignDiscount - fxDiscountAmount;
  if (finalPrice < 0) finalPrice = 0;
  let reason = 'Calculation complete.';
  if (campaign) reason += ' Campaign applied.';
  if (fxCampaignsMatched.length > 0) reason += ' FX Campaign applied.';
  if (fxDiscounts && fxDiscounts.length > 0) reason += ' FX Discount Group applied.';
  if (bundle) reason += ' Bundle applied.';
  if (loyalty) reason += ' Loyalty program available.';
  return {
    defaultPrice,
    finalPrice,
    reason,
    breakdown,
    ruleDetails
  };
}

import { View } from '../types';

interface CalculatorServiceProps {
  setCurrentView?: (view: View) => void;
}

const CalculatorService: React.FC<CalculatorServiceProps> = ({ setCurrentView }) => {
  // If you use a context for sidebar view, import and use it here
  // Live data states
  const [services, setServices] = useState<Service[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [fxDiscountOptions, setFxDiscountOptions] = useState<FXDiscountOption[]>([]);
  const [fxCampaigns, setFxCampaigns] = useState<FXCampaign[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  const [activityId, setActivityId] = useState<string>('');
  const [activity, setActivity] = useState<Partial<CustomerActivity>>({});

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch all required data from Firebase on mount and before calculation
  const fetchAll = async () => {
    setLoadingData(true);
    try {
      const db = getDatabase();

      // Fetch customer activities
      const activitiesRef = dbRef(db, 'customerActivities');
      await new Promise<void>((resolve) => {
        onValue(activitiesRef, (snapshot) => {
          const data = snapshot.val() || {};
          const activitiesList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setActivities(activitiesList);
          resolve();
        }, { onlyOnce: true });
      });

      // Fetch customers
      const customersRef = dbRef(db, 'customers');
      await new Promise<void>((resolve) => {
        onValue(customersRef, (snapshot) => {
          const data = snapshot.val() || {};
          const customersList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setCustomers(customersList);
          resolve();
        }, { onlyOnce: true });
      });

      // Fetch services from Firebase
      const servicesRef = dbRef(db, 'services');
      await new Promise<void>((resolve) => {
        onValue(servicesRef, (snapshot) => {
          const data = snapshot.val() || {};
          const servicesList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setServices(servicesList);
          resolve();
        }, { onlyOnce: true });
      });

      // Fetch FX Discount Options
      const fxDiscountOptionsRef = dbRef(db, 'fxDiscountOptions');
      await new Promise<void>((resolve) => {
        onValue(fxDiscountOptionsRef, (snapshot) => {
          const data = snapshot.val() || {};
          const list: FXDiscountOption[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setFxDiscountOptions(list);
          resolve();
        }, { onlyOnce: true });
      });

      // Fetch FX Campaigns
      const fxCampaignsRef = dbRef(db, 'fxCampaigns');
      await new Promise<void>((resolve) => {
        onValue(fxCampaignsRef, (snapshot) => {
          const data = snapshot.val() || {};
          const list: FXCampaign[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          setFxCampaigns(list);
          resolve();
        }, { onlyOnce: true });
      });

      // Fetch countries from Firebase reference data
      const countriesRef = dbRef(db, 'referenceCountries');
      await new Promise<void>((resolve) => {
        onValue(countriesRef, (snapshot) => {
          const data = snapshot.val() || {};
          const countryNames = Object.values(data).map((item: any) => item.name).filter(Boolean);
          setCountries(countryNames);
          resolve();
        }, { onlyOnce: true });
      });

      // If a country is selected, fetch cities for that country from Firebase
      if (selectedCountry) {
        const citiesRef = dbRef(db, 'referenceCities');
        await new Promise<void>((resolve) => {
          onValue(citiesRef, (snapshot) => {
            const data = snapshot.val() || {};
            const cityNames = Object.values(data)
              .filter((item: any) => item.country === selectedCountry)
              .map((item: any) => item.name)
              .filter(Boolean);
            setCities(cityNames);
            resolve();
          }, { onlyOnce: true });
        });
      } else {
        setCities([]);
      }
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);


  // When activityId changes, update activity state
  useEffect(() => {
    if (!activityId) return;
    const found = activities.find(a => a.id === activityId);
    if (found) setActivity(found);
  }, [activityId, activities]);

  // Fetch cities when selectedCountry changes (from Firebase)
  useEffect(() => {
    if (!selectedCountry) {
      setCities([]);
      return;
    }
    const db = getDatabase();
    const citiesRef = dbRef(db, 'referenceCities');
    const unsubscribe = onValue(citiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const cityNames = Object.values(data)
        .filter((item: any) => item.country === selectedCountry)
        .map((item: any) => item.name)
        .filter(Boolean);
      setCities(cityNames);
    });
    return () => unsubscribe();
  }, [selectedCountry]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setActivity(prev => ({ ...prev, [name]: name === 'distanceTravelled' ? Number(value) : value }));
  };


  const handleCalculate = async () => {
    setLoading(true);
    await fetchAll(); // Always fetch latest data before calculation
    try {
      const report = await calculatePricing(
        activity as CustomerActivity,
        services,
        pricingRules,
        campaigns,
        loyaltyPrograms,
        bundles,
        fxDiscountOptions,
        fxCampaigns
      );
      setResult(report);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white rounded shadow-md max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Pricing Calculator</h1>
      <div className="flex items-center mb-4">
        {result ? (
          <button
            className="mr-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setCurrentView ? setCurrentView('simulation') : window.location.reload()}
          >
            &lt; Back
          </button>
        ) : null}
        {activityId && (
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            disabled={loading}
            onClick={handleCalculate}
          >
            {loading ? 'Calculating...' : 'Calculate Price'}
          </button>
        )}
      </div>
      {loadingData ? (
        <div className="text-gray-500">Loading data...</div>
      ) : (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCalculate(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select name="country" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="w-full border px-3 py-2 rounded">
              <option value="">Select country...</option>
              {countries.map((country, idx) => (
                <option key={`${country}-${idx}`} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <select name="city" value={activity.city || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" disabled={!selectedCountry}>
              <option value="">{!selectedCountry ? 'Select country first...' : 'Select city...'}</option>
              {cities.map((city, idx) => (
                <option key={`${city}-${selectedCountry}-${idx}`} value={city}>{city}</option>
              ))}
            </select>
          </div>
          {/* ...existing activity selection and other fields... */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Activity</label>
            <select name="activityId" value={activityId} onChange={e => setActivityId(e.target.value)} className="w-full border px-3 py-2 rounded">
              <option value="">Select activity...</option>
              {activities.map(a => {
                const customer = customers.find(c => c.id === a.customerId);
                const svc = services.find(s => s.id === a.serviceId);
                const typeLabel = svc?.type || a.serviceType || 'Unknown service type';
                return (
                  <option key={a.id} value={a.id}>
                    {customer ? customer.name : 'Unknown Customer'} - {typeLabel} in {a.city} ({a.distanceTravelled} km)
                  </option>
                );
              })}
            </select>
          </div>
          {activityId && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select name="serviceId" value={activity.serviceId} onChange={handleChange} className="w-full border px-3 py-2 rounded">
                  <option value="">Select service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.type ? `${s.type} — ${s.name}` : s.name} ({s.location})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Distance Travelled (km)</label>
                <input name="distanceTravelled" type="number" value={activity.distanceTravelled || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
              </div>
            </>
          )}
        </form>
      )}
      {result ? (
        <div className="mt-8 p-4 bg-gray-50 rounded shadow">
          <h2 className="text-lg font-bold mb-2 text-gray-800">Pricing Report</h2>
          {typeof result.defaultPrice === 'number' && typeof result.finalPrice === 'number' ? (
            <>
              <div className="mb-1"><strong>Default Price:</strong> €{result.defaultPrice.toFixed(2)}</div>
              <div className="mb-1"><strong>Final Price:</strong> €{result.finalPrice.toFixed(2)}</div>
              <div className="mb-1"><strong>City:</strong> {activity.city || 'Unknown'}</div>
              <div className="mb-1"><strong>Reason:</strong> {result.reason}</div>
              <div className="mt-4">
                <h3 className="font-semibold mb-1">Calculation Breakdown:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {result.breakdown && result.breakdown.length > 0 ? (
                    result.breakdown.map((step: string, idx: number) => (
                      <li key={idx}>{step}</li>
                    ))
                  ) : (
                    <li>No breakdown available.</li>
                  )}
                </ul>
                <h3 className="font-semibold mt-4 mb-1">Rule Values Used:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  {result.ruleDetails?.service && (
                    <li><strong>Service:</strong> {result.ruleDetails.service.name} (Base price: €{result.ruleDetails.service.price})</li>
                  )}
                  {result.ruleDetails?.pricingRule && (
                    <li><strong>Pricing Rule:</strong> {result.ruleDetails.pricingRule.description} (Rate: €{result.ruleDetails.pricingRule.rate})</li>
                  )}
                  {result.ruleDetails?.campaign && (
                    <li><strong>Campaign:</strong> {result.ruleDetails.campaign.name} (Discount: €{result.ruleDetails.campaign.discountValue})</li>
                  )}
                  {result.ruleDetails?.loyalty && (
                    <li><strong>Loyalty Program:</strong> {result.ruleDetails.loyalty.name} (Points per Euro: {result.ruleDetails.loyalty.pointsPerEuro})</li>
                  )}
                  {result.ruleDetails?.bundle && (
                    <li><strong>Bundle:</strong> {result.ruleDetails.bundle.name} (Discount: €{result.ruleDetails.bundle.discountValue})</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <div className="text-red-600">Calculation failed or incomplete data. Please check your input and try again.</div>
          )}
        </div>
      ) : null}

      {/* Customer Campaign Report - always show impacting campaign */}
      {result && activityId && result.ruleDetails?.campaign && (
        <div className="mt-8 p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Customer Campaign Report</h3>
          <table className="min-w-full text-sm border border-gray-300 rounded">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">Campaign Name</th>
                <th className="px-3 py-2 text-left">Discount Value</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2">{result.ruleDetails.campaign.name}</td>
                <td className="px-3 py-2">{result.ruleDetails.campaign.discountValue}</td>
                <td className="px-3 py-2">{result.ruleDetails.campaign.status || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CalculatorService;
export { CalculatorService };
