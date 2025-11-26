

import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';
import { CustomerActivity, Service, PricingRule, Campaign, LoyaltyProgram, Bundle } from '../types';
import { calculatePricing } from './CalculatorService';

const CalculatorService: React.FC = () => {
  // Live data states
  const [services, setServices] = useState<Service[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  const [activityId, setActivityId] = useState<string>('');
  const [activity, setActivity] = useState<Partial<CustomerActivity>>({});

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch all required data from Firebase on mount and before calculation
  const fetchAll = async () => {
    setLoadingData(true);
    try {
      const [servicesSnap, rulesSnap, campaignsSnap, loyaltySnap, bundlesSnap, activitiesSnap, customersSnap] = await Promise.all([
        get(ref(db, 'services')),
        get(ref(db, 'pricingRules')),
        get(ref(db, 'campaigns')),
        get(ref(db, 'loyaltyPrograms')),
        get(ref(db, 'bundles')),
        get(ref(db, 'customerActivities')),
        get(ref(db, 'customers')),
      ]);
      setServices(servicesSnap.exists() ? Object.keys(servicesSnap.val()).map(id => ({ id, ...servicesSnap.val()[id] })) : []);
      setPricingRules(rulesSnap.exists() ? Object.keys(rulesSnap.val()).map(id => ({ id, ...rulesSnap.val()[id] })) : []);
      setCampaigns(campaignsSnap.exists() ? Object.keys(campaignsSnap.val()).map(id => ({ id, ...campaignsSnap.val()[id] })) : []);
      setLoyaltyPrograms(loyaltySnap.exists() ? Object.keys(loyaltySnap.val()).map(id => ({ id, ...loyaltySnap.val()[id] })) : []);
      setBundles(bundlesSnap.exists() ? Object.keys(bundlesSnap.val()).map(id => ({ id, ...bundlesSnap.val()[id] })) : []);
      setActivities(activitiesSnap.exists() ? Object.keys(activitiesSnap.val()).map(id => ({ id, ...activitiesSnap.val()[id] })) : []);
      setCustomers(customersSnap.exists() ? Object.keys(customersSnap.val()).map(id => ({ id, ...customersSnap.val()[id] })) : []);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);


  // When activityId changes, update activity state
  useEffect(() => {
    if (!activityId) return;
    const found = activities.find(a => a.id === activityId);
    if (found) setActivity(found);
  }, [activityId, activities]);

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
      {loadingData ? (
        <div className="text-gray-500">Loading data...</div>
      ) : (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCalculate(); }}>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input name="city" value={activity.city || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Distance Travelled (km)</label>
                <input name="distanceTravelled" type="number" value={activity.distanceTravelled || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
              </div>
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" disabled={loading}>{loading ? 'Calculating...' : 'Calculate Price'}</button>
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
              {/* Customer Campaign Report */}
              <div className="mt-8">
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
                      // Check if this campaign is triggered by the selected activity/customer
                      // For demo: triggered if activity.serviceId is in campaign.serviceIds
                      return activity && camp.serviceIds.includes(activity.serviceId || '');
                    }).map(camp => {
                      // For demo: points awarded = campaign.discountValue, status = campaign.status
                      return (
                        <tr key={camp.id}>
                          <td className="px-3 py-2">{camp.name}</td>
                          <td className="px-3 py-2">{camp.discountValue}</td>
                          <td className="px-3 py-2">{camp.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-red-600">Calculation failed or incomplete data. Please check your input and try again.</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default CalculatorService;
export { CalculatorService };
