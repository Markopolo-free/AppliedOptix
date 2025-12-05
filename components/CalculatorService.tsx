

import React, { useState, useEffect } from 'react';
// import { ref, get } from 'firebase/database';
// import { db } from '../services/firebase';
import { CustomerActivity, Service, PricingRule, Campaign, LoyaltyProgram, Bundle } from '../types';
import { calculatePricing } from './CalculatorService';

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
      // Fetch from Firebase as before (for non-country/city data)
      // ...existing code for services, pricingRules, campaigns, loyaltyPrograms, bundles, activities, customers...
      // Fetch countries from micro-service
      const countriesRes = await fetch('http://localhost:4000/countries');
      const countriesData = await countriesRes.json();
      setCountries(countriesData);
      // If a country is selected, fetch cities for that country
      if (selectedCountry) {
        const citiesRes = await fetch(`http://localhost:4000/cities?country=${encodeURIComponent(selectedCountry)}`);
        const citiesData = await citiesRes.json();
        setCities(citiesData);
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

  // Fetch cities when selectedCountry changes
  useEffect(() => {
    if (!selectedCountry) {
      setCities([]);
      return;
    }
    (async () => {
      const citiesRes = await fetch(`http://localhost:4000/cities?country=${encodeURIComponent(selectedCountry)}`);
      const citiesData = await citiesRes.json();
      setCities(citiesData);
    })();
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
        bundles
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
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <select name="city" value={activity.city || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" disabled={!selectedCountry}>
              <option value="">{!selectedCountry ? 'Select country first...' : 'Select city...'}</option>
              {cities.map(city => (
                <option key={`${city}-${selectedCountry}`} value={city}>{city}</option>
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
                return (
                  <option key={a.id} value={a.id}>
                    {customer ? customer.name : 'Unknown Customer'} - {a.serviceType} in {a.city} ({a.distanceTravelled} km)
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
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
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
                <h3 className="font-semibold mb-1">Rule Values Used:</h3>
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

      {/* Customer Campaign Report - moved to separate section */}
      {result && activityId && (
        <div className="mt-8 p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Customer Campaign Report</h3>
          <table className="min-w-full text-sm border border-gray-300 rounded">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">Campaign Name</th>
                <th className="px-3 py-2 text-left">Points Awarded</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.filter(camp => {
                // Only show campaigns that impacted the selected activity (price calculator result)
                if (!activity || !result || !result.ruleDetails?.campaign) return false;
                // Match by campaign id from price calculator result
                return camp.id === result.ruleDetails.campaign.id;
              }).map(camp => {
                let points = camp.discountValue;
                if (result.ruleDetails?.loyalty && typeof result.ruleDetails.loyalty.pointsPerEuro === 'number' && typeof result.finalPrice === 'number') {
                  points = Math.round(result.finalPrice * result.ruleDetails.loyalty.pointsPerEuro);
                }
                return (
                  <tr key={camp.id}>
                    <td className="px-3 py-2">{camp.name}</td>
                    <td className="px-3 py-2">{points}</td>
                    <td className="px-3 py-2">{camp.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CalculatorService;
export { CalculatorService };
