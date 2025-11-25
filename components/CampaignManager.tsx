import React, { useState, useEffect, useContext } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { logAudit } from '../services/auditService';
import { db } from '../services/firebase';
import { Campaign, DiscountType, Zone } from '../types';
import { useAuth } from '../contexts/AuthContext';

const initialNewCampaignState: Partial<Campaign> = {
  name: '',
  description: '',
  serviceIds: [],
  discountType: DiscountType.Percentage,
  discountValue: 0,
  startDate: '',
  endDate: '',
  countryId: '',
  cityId: '',
  hasQualifyingCriteria: 'N',
  qualifyingServiceId: '',
};

const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string, name: string }[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<{ id: string, name: string, country: string }[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>(initialNewCampaignState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const { currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Services
    const serviceRef = ref(db, 'referenceServiceTypes');
    const unsubService = onValue(serviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ id, name: item.name }));
        setServiceTypes(arr);
      } else {
        setServiceTypes([]);
      }
    });
    // Countries
    const countryRef = ref(db, 'referenceCountries');
    const unsubCountry = onValue(countryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => item.name);
        setCountries(arr.sort((a, b) => a.localeCompare(b)));
      } else {
        setCountries([]);
      }
    });
    // Cities
    const cityRef = ref(db, 'referenceCities');
    const unsubCity = onValue(cityRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ id, name: item.name, country: item.country }));
        setCities(arr);
      } else {
        setCities([]);
      }
    });
    // Zones
    const zonesRef = ref(db, 'referenceZones');
    const unsubZones = onValue(zonesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
        setZones(arr);
      } else {
        setZones([]);
      }
    });
    // Campaigns
    const campaignsRef = ref(db, 'campaigns');
    const unsubCampaigns = onValue(campaignsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.entries(data).map(([id, item]: [string, any]) => ({ ...item, id }));
        setCampaigns(arr);
      } else {
        setCampaigns([]);
      }
    });
    return () => {
      unsubService();
      unsubCountry();
      unsubCity();
      unsubZones();
      unsubCampaigns();
    };
  }, []);

  // Placeholder handler functions
  const handleOpenModalForAdd = () => {
    setEditingCampaign(null);
    setNewCampaign(initialNewCampaignState);
    setIsModalOpen(true);
  };
  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement save logic here
    setIsModalOpen(false);
  };
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Campaign Management</h1>
      <div>
        <div className="flex justify-end mb-4">
          <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Add Campaign</button>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          {campaigns.length === 0 ? (
            <div className="text-gray-500">No campaigns found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Description</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Pricing Zone</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Services</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Qualifying Services</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Discount</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Period</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {campaigns.map(campaign => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">{campaign.name}</td>
                      <td className="px-6 py-4 whitespace-pre-line break-words max-w-xs align-top">{campaign.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campaign.countryId || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{(cities.find(city => city.id === campaign.cityId)?.name) || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campaign.zoneId ? (zones.find(zone => zone.id === campaign.zoneId)?.name || '-') : '-'}</td>
                      <td className="px-6 py-4 whitespace-pre-line align-top">{
                        Array.isArray(campaign.serviceIds)
                          ? (
                              <ul className="list-none m-0 p-0">
                                {campaign.serviceIds.map(id => (
                                  <li key={id}>{serviceTypes.find(s => s.id === id)?.name || id}</li>
                                ))}
                              </ul>
                            )
                          : '-'
                      }</td>
                      <td className="px-6 py-4 whitespace-pre-line align-top">{
                        Array.isArray(campaign.qualifyingServiceIds)
                          ? (
                              <ul className="list-none m-0 p-0">
                                {campaign.qualifyingServiceIds.map(id => (
                                  <li key={id}>{serviceTypes.find(s => s.id === id)?.name || id}</li>
                                ))}
                              </ul>
                            )
                          : '-'
                      }</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campaign.discountValue} {campaign.discountType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campaign.startDate} - {campaign.endDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setNewCampaign(campaign);
                            setIsModalOpen(true);
                          }}
                        >Edit</button>
                        <button
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this campaign?')) {
                              const campaignRef = ref(db, `campaigns/${campaign.id}`);
                              await remove(campaignRef);
                              setCampaigns(prev => prev.filter(c => c.id !== campaign.id));
                              await logAudit({
                                userId: currentUser?.id || currentUser?.email || 'admin',
                                userName: currentUser?.name || 'Admin',
                                userEmail: currentUser?.email || 'admin',
                                action: 'delete',
                                entityType: 'campaign',
                                entityId: campaign.id,
                                entityName: campaign.name
                              });
                            }
                          }}
                        >Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingCampaign ? 'Edit Campaign' : 'Add New Campaign'}</h2>
              <form onSubmit={handleSaveCampaign}>
                {/* ...existing code for form fields... */}
                <div className="mt-8 flex justify-end space-x-4">
                  <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingCampaign ? 'Save Changes' : 'Save Campaign'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignManager;