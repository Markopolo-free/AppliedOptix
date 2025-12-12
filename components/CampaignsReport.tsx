import React, { useEffect, useState } from 'react';
import { getDatabase, ref as dbRef, onValue } from 'firebase/database';
import { Campaign, DiscountType } from '../types';

const CampaignsReport: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    const db = getDatabase();
    setLoading(true);
    // Fetch campaigns
    const campaignsRef = dbRef(db, 'campaigns');
    onValue(campaignsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setCampaigns(list);
      setLoading(false);
    }, { onlyOnce: true });
    // Fetch service types (referenceServiceTypes)
    const serviceRef = dbRef(db, 'referenceServiceTypes');
    onValue(serviceRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ id, name: item.name }));
      setServiceTypes(arr);
    }, { onlyOnce: true });
    // Fetch cities
    const citiesRef = dbRef(db, 'referenceCities');
    onValue(citiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setCities(list);
    }, { onlyOnce: true });
  }, []);

  const now = Date.now();
  const activeCampaigns = campaigns.filter(camp => {
    const start = camp.startDate ? new Date(camp.startDate).getTime() : -Infinity;
    const end = camp.endDate ? new Date(camp.endDate).getTime() : Infinity;
    return now >= start && now <= end;
  });


  function getServiceDescriptions(serviceIds: string[] | string) {
    if (!serviceIds) return '-';
    // Handle if serviceIds is a string (single id)
    const ids = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    return ids
      .map(id => {
        const svc = serviceTypes.find(s => String(s.id) === String(id));
        return svc ? svc.name : id;
      })
      .join(', ');
  }

  function getCityDescription(cityId: string, countryId?: string) {
    if (!cityId) return '-';
    // If countryId is available, filter by country as well (like CampaignManager)
    let city = null;
    if (countryId) {
      city = cities.find(c => String(c.id) === String(cityId) && c.country === countryId);
    }
    if (!city) {
      city = cities.find(c => String(c.id) === String(cityId));
    }
    return city ? city.name : cityId;
  }

  // Debug output removed (allServiceIds, allCampaignServiceIds)

  return (
    <div className="p-8 bg-white rounded shadow-md max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Campaigns In Play</h1>
      {loading ? (
        <div>Loading...</div>
      ) : activeCampaigns.length === 0 ? (
        <div className="text-gray-600">No active campaigns at this time.</div>
      ) : (
        <table className="min-w-full text-sm border border-gray-300 rounded">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-3 py-2 text-left">Campaign Name</th>
              <th className="px-3 py-2 text-left">Start Date</th>
              <th className="px-3 py-2 text-left">End Date</th>
              <th className="px-3 py-2 text-left">Country</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">Service(s)</th>
              <th className="px-3 py-2 text-left">Discount</th>
              <th className="px-3 py-2 text-left">Discount Type</th>
            </tr>
          </thead>
          <tbody>
            {activeCampaigns.map(camp => (
              <tr key={camp.id}>
                <td className="px-3 py-2">{camp.name}</td>
                <td className="px-3 py-2">{camp.startDate ? new Date(camp.startDate).toLocaleDateString() : '-'}</td>
                <td className="px-3 py-2">{camp.endDate ? new Date(camp.endDate).toLocaleDateString() : '-'}</td>
                <td className="px-3 py-2">{camp.countryId || '-'}</td>
                <td className="px-3 py-2">{getCityDescription(camp.cityId, camp.countryId)}</td>
                <td className="px-3 py-2">{getServiceDescriptions(camp.serviceIds || [])}</td>
                <td className="px-3 py-2">{camp.discountValue}</td>
                <td className="px-3 py-2">{camp.discountType || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CampaignsReport;
