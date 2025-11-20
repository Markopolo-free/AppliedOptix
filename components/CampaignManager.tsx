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

  // Fetch reference data for services, countries, cities
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

  const handleOpenModalForAdd = () => {
    setEditingCampaign(null);
    setNewCampaign(initialNewCampaignState);
    setIsModalOpen(true);
  };

  // Single function to close modal and reset state
  const closeModal = () => {
    setIsModalOpen(false);
    setNewCampaign(initialNewCampaignState);
    setEditingCampaign(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, multiple, options } = e.target as any;
    if (multiple && options) {
      // Multi-select for services
      const selected = Array.from(options).filter((o: any) => o.selected).map((o: any) => o.value);
      setNewCampaign(prev => ({ ...prev, [name]: selected }));
    } else {
      if (name === 'countryId') {
        // Reset cityId when country changes
        setNewCampaign(prev => ({ ...prev, countryId: value, cityId: '' }));
      } else {
        setNewCampaign(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name || !newCampaign.description) {
      alert('Please fill in all required fields.');
      return;
    }
    if (editingCampaign && editingCampaign.id) {
      // Update existing campaign in Firebase
      const campaignRef = ref(db, `campaigns/${editingCampaign.id}`);
      const updatedCampaign = { ...editingCampaign, ...newCampaign };
      await update(campaignRef, updatedCampaign);
      setCampaigns(prev => prev.map(c => c.id === editingCampaign.id ? updatedCampaign as Campaign : c));
      // Audit log for update
      await logAudit({
        userId: currentUser?.id || currentUser?.email || 'admin',
        userName: currentUser?.name || 'Admin',
        userEmail: currentUser?.email || 'admin',
        action: 'update',
        entityType: 'campaign',
        entityId: editingCampaign.id,
        entityName: updatedCampaign.name,
        changes: Object.keys(newCampaign).map(key => ({
          field: key,
          oldValue: editingCampaign[key],
          newValue: newCampaign[key]
        })).concat(
          [{
            field: 'pricingZoneId',
            oldValue: editingCampaign.pricingZoneId,
            newValue: newCampaign.pricingZoneId
          }]
        )
      });
    } else {
      // Add new campaign to Firebase
      const campaignsRef = ref(db, 'campaigns');
      const newCampaignData = { ...newCampaign };
      const newRef = await push(campaignsRef, newCampaignData);
      setCampaigns(prev => [...prev, { ...newCampaignData, id: newRef.key } as Campaign]);
      // Audit log for create
      await logAudit({
        userId: currentUser?.id || currentUser?.email || 'admin',
        userName: currentUser?.name || 'Admin',
        userEmail: currentUser?.email || 'admin',
        action: 'create',
        entityType: 'campaign',
        entityId: newRef.key || '',
        entityName: newCampaignData.name,
        changes: [
          {
            field: 'pricingZoneId',
            oldValue: null,
            newValue: newCampaignData.pricingZoneId || null
          }
        ]
      });
    }
    closeModal();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Campaign Management</h1>
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
                    <td className="px-6 py-4 whitespace-nowrap">{
                      (cities.find(city => city.id === campaign.cityId)?.name) || '-'
                    }</td>
                    <td className="px-6 py-4 whitespace-nowrap">{
                      (zones.find(zone => zone.id === campaign.pricingZoneId)?.name) || '-'
                    }</td>
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
                      Array.isArray(campaign.qualifyingServices)
                        ? (
                            <ul className="list-none m-0 p-0">
                              {campaign.qualifyingServices.map(qs => (
                                <li key={qs.id || qs.serviceId}>{serviceTypes.find(s => s.id === qs.serviceId)?.name || qs.serviceId}</li>
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
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <input type="text" name="name" id="name" value={newCampaign.name || ''} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div className="mb-4">
                <label htmlFor="serviceIds" className="block text-sm font-medium text-gray-700">Services</label>
                <select
                  name="serviceIds"
                  id="serviceIds"
                  multiple
                  value={newCampaign.serviceIds || []}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                  size={6}
                >
                  {serviceTypes.map(service => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
                <small className="text-gray-500">Hold Ctrl (Windows) or Cmd (Mac) to select multiple.</small>
              </div>
              <div className="mb-4">
                <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">Discount Type</label>
                <select
                  name="discountType"
                  id="discountType"
                  value={newCampaign.discountType || DiscountType.Percentage}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value={DiscountType.Percentage}>Percentage</option>
                  <option value={DiscountType.Fixed}>Fixed Amount</option>
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Discount Value</label>
                <input
                  type="number"
                  name="discountValue"
                  id="discountValue"
                  value={newCampaign.discountValue || 0}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                  min={0}
                  step={0.01}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="countryId" className="block text-sm font-medium text-gray-700">Country</label>
                <select
                  name="countryId"
                  id="countryId"
                  value={newCampaign.countryId || ''}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">Select a country</option>
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="pricingZoneId" className="block text-sm font-medium text-gray-700">Pricing Zone</label>
                <select
                  name="pricingZoneId"
                  id="pricingZoneId"
                  value={newCampaign.pricingZoneId || ''}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">Select a pricing zone</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="cityId" className="block text-sm font-medium text-gray-700">City</label>
                <select
                  name="cityId"
                  id="cityId"
                  value={newCampaign.cityId || ''}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">Select a city</option>
                  {cities
                    .filter(city => city.country === newCampaign.countryId || (newCampaign.countryId === 'Germany' && !city.country))
                    .map(city => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea name="description" id="description" value={newCampaign.description || ''} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required></textarea>
              </div>
              <div className="mb-4">
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                <input type="date" name="startDate" id="startDate" value={newCampaign.startDate || ''} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div className="mb-4">
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                <input type="date" name="endDate" id="endDate" value={newCampaign.endDate || ''} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              {/* Legacy qualifying criteria fields */}
              <div className="mb-4">
                <label htmlFor="hasQualifyingCriteria" className="block text-sm font-medium text-gray-700">Has Qualifying Criteria?</label>
                <select name="hasQualifyingCriteria" id="hasQualifyingCriteria" value={newCampaign.hasQualifyingCriteria || 'N'} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              {newCampaign.hasQualifyingCriteria === 'Y' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Qualifying Services</label>
                  {(newCampaign.qualifyingServices || []).map((qs, idx) => (
                    <React.Fragment key={qs.id}>
                      <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700">Service</label>
                          <select
                            value={qs.serviceId || ''}
                            onChange={e => {
                              const updated = [...(newCampaign.qualifyingServices || [])];
                              updated[idx].serviceId = e.target.value;
                              setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                            }}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                          >
                            <option value="">Select service</option>
                            {serviceTypes.map(service => (
                              <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700">Start Date</label>
                          <input type="date" value={qs.startDate || ''} onChange={e => {
                            const updated = [...(newCampaign.qualifyingServices || [])];
                            updated[idx].startDate = e.target.value;
                            setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                          }} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700">End Date</label>
                          <input type="date" value={qs.endDate || ''} onChange={e => {
                            const updated = [...(newCampaign.qualifyingServices || [])];
                            updated[idx].endDate = e.target.value;
                            setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                          }} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700">Criteria Type</label>
                          <select value={qs.criteriaType || 'distance'} onChange={e => {
                            const updated = [...(newCampaign.qualifyingServices || [])];
                            updated[idx].criteriaType = e.target.value;
                            setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                          }} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                            <option value="distance">Distance</option>
                            <option value="rides">Rides</option>
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-700">Criteria Value</label>
                          <input type="number" value={qs.criteriaValue || ''} onChange={e => {
                            const updated = [...(newCampaign.qualifyingServices || [])];
                            updated[idx].criteriaValue = e.target.value;
                            setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                          }} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="flex justify-end mt-2">
                          <button type="button" className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" onClick={() => {
                            const updated = [...(newCampaign.qualifyingServices || [])];
                            updated.splice(idx, 1);
                            setNewCampaign(prev => ({ ...prev, qualifyingServices: updated }));
                          }}>Remove</button>
                        </div>
                      </div>
                      {/* Logical operator dropdown after each except last */}
                      {idx < (newCampaign.qualifyingServices || []).length - 1 && (
                        <div key={qs.id + '-op'} className="mb-4 flex items-center justify-center">
                          <label className="mr-2 text-sm font-medium text-gray-700">Logical Operator</label>
                          <select
                            value={newCampaign.qualifyingOperators?.[idx] || 'AND'}
                            onChange={e => {
                              const updated = [...(newCampaign.qualifyingOperators || [])];
                              updated[idx] = e.target.value;
                              setNewCampaign(prev => ({ ...prev, qualifyingOperators: updated }));
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  <div className="mb-4 flex justify-end">
                    <button type="button" className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200" onClick={() => {
                      setNewCampaign(prev => ({
                        ...prev,
                        qualifyingServices: [
                          ...(prev.qualifyingServices || []),
                          { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), serviceId: '', startDate: '', endDate: '', criteriaType: 'distance', criteriaValue: '' }
                        ],
                        qualifyingOperators: [...(prev.qualifyingOperators || [])]
                      }));
                    }}>Add Qualifying Service</button>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label htmlFor="rewardAvailableFrom" className="block text-sm font-medium text-gray-700">Reward Available From</label>
                <input type="date" name="rewardAvailableFrom" id="rewardAvailableFrom" value={newCampaign.rewardAvailableFrom || ''} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingCampaign ? 'Save Changes' : 'Save Campaign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManager;