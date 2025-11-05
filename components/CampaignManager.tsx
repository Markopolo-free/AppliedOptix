import React, { useState, useCallback, useEffect } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { Campaign, DiscountType, Service, ServiceStatus } from '../types';
import { generateCampaignIdea } from '../services/geminiService';
import { SparklesIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

// Mock Data for AI idea generation (can be replaced with live data later)
// Fix: Updated `type` to be a string literal to align with the removal of the ServiceType enum.
const mockServices: Service[] = [
  { id: 'svc_1', name: 'Berlin City eCars', type: 'Electric Car', location: 'Berlin', description: 'Convenient electric car sharing.', price: 15, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_2', name: 'Munich eScooters', type: 'eScooter', location: 'Munich', description: 'Fun and fast e-scooters.', price: 0.25, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_3', name: 'Hamburg eBikes', type: 'eBike', location: 'Hamburg', description: 'Explore the city on two wheels.', price: 10, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_4', name: 'Berlin Buses', type: 'Bus', location: 'Berlin', description: 'Public transport buses.', price: 3, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_5', name: 'Munich S-Bahn', type: 'Train', location: 'Munich', description: 'Suburban train network.', price: 3.3, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
];

const initialNewCampaignState = {
  name: '',
  description: '',
  serviceIds: [] as string[],
  discountType: DiscountType.Percentage,
    discountValue: '',
    startDate: '',
    endDate: '',
  cityId: '',
  // Qualifying Criteria (form state as strings)
  hasQualifyingCriteria: 'N' as 'Y' | 'N',
  qualifyingServiceId: '',
  criteriaType: 'distance' as 'distance' | 'rides',
  minDistanceKm: '',
  minRides: '',
  qualifyStartDate: '',
  qualifyEndDate: '',
  rewardAvailableFrom: '',
};

const CampaignManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState(initialNewCampaignState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);


  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
        const campaignsRef = ref(db, 'campaigns');
        const snapshot = await get(campaignsRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const list: Campaign[] = Object.keys(data).map(key => ({
                id: key,
                ...data[key],
                serviceIds: data[key].serviceIds || [],
                lastModifiedAt: new Date(data[key].lastModifiedAt).toISOString(),
            }));
            // Sort by expiry status: active first, expired last. Within each group, keep recent first by lastModifiedAt
            const isExpired = (c: Campaign) => {
              if (!c.endDate) return false;
              const now = new Date();
              return new Date(c.endDate).getTime() < now.getTime();
            };
            list.sort((a, b) => {
              const aExpired = isExpired(a);
              const bExpired = isExpired(b);
              if (aExpired !== bExpired) return aExpired ? 1 : -1; // expired to bottom
              return new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime();
            });
            setCampaigns(list);
        } else {
            setCampaigns([]);
        }
    } catch(error) {
        console.error("Error fetching campaigns:", error);
        alert("Could not fetch campaigns. See console for details.");
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Load services for qualifying criteria selection
  useEffect(() => {
    const loadServices = async () => {
      try {
        const servicesRef = ref(db, 'services');
        const snap = await get(servicesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list: Service[] = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
          setServices(list);
        } else {
          setServices([]);
        }
      } catch (err) {
        console.error('Error loading services for criteria:', err);
      }
    };
    loadServices();
  }, []);

  // Load cities from reference data
  useEffect(() => {
    const loadCities = async () => {
      try {
        const citiesRef = ref(db, 'referenceCities');
        const snap = await get(citiesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.keys(data).map((key) => ({ id: key, name: data[key].name }));
          setCities(list.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setCities([]);
        }
      } catch (err) {
        console.error('Error loading cities:', err);
      }
    };
    loadCities();
  }, []);


  const handleOpenModalForAdd = () => {
      setEditingCampaign(null);
      setNewCampaign(initialNewCampaignState);
      setIsModalOpen(true);
  };
  
  const handleOpenModalForEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setNewCampaign({
        name: campaign.name,
        description: campaign.description,
        serviceIds: campaign.serviceIds,
        discountType: campaign.discountType,
        discountValue: String(campaign.discountValue),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
    cityId: campaign.cityId || '',
    hasQualifyingCriteria: campaign.hasQualifyingCriteria || 'N',
    qualifyingServiceId: campaign.qualifyingServiceId || '',
    criteriaType: (campaign.criteriaType as 'distance' | 'rides') || 'distance',
    minDistanceKm: campaign.minDistanceKm != null ? String(campaign.minDistanceKm) : '',
    minRides: campaign.minRides != null ? String(campaign.minRides) : '',
    qualifyStartDate: campaign.qualifyStartDate || '',
    qualifyEndDate: campaign.qualifyEndDate || '',
    rewardAvailableFrom: campaign.rewardAvailableFrom || '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCampaign(prev => ({ ...prev, [name]: value }));
  };

  const handleServiceIdsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => (o as HTMLOptionElement).value);
    setNewCampaign(prev => ({ ...prev, serviceIds: selected }));
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine criteria type automatically from selected service type (if available)
    let derivedCriteriaType: 'distance' | 'rides' = newCampaign.criteriaType;
    if (newCampaign.qualifyingServiceId) {
      const svc = services.find(s => s.id === newCampaign.qualifyingServiceId);
      if (svc) {
        if (svc.type.toLowerCase().includes('train')) derivedCriteriaType = 'rides';
        if (svc.type.toLowerCase().includes('scooter')) derivedCriteriaType = 'distance';
      }
    }

    const hasQC = newCampaign.hasQualifyingCriteria === 'Y';
    const campaignData = {
      name: newCampaign.name,
      description: newCampaign.description,
  serviceIds: newCampaign.serviceIds,
      discountType: newCampaign.discountType,
      discountValue: parseFloat(newCampaign.discountValue) || 0,
      startDate: newCampaign.startDate,
      endDate: newCampaign.endDate,
      cityId: newCampaign.cityId || undefined,
      hasQualifyingCriteria: hasQC ? 'Y' : 'N',
      qualifyingServiceId: hasQC ? (newCampaign.qualifyingServiceId || '') : '',
      criteriaType: hasQC ? derivedCriteriaType : undefined,
      minDistanceKm: hasQC && derivedCriteriaType === 'distance' ? (parseFloat(newCampaign.minDistanceKm) || 0) : undefined,
      minRides: hasQC && derivedCriteriaType === 'rides' ? (parseInt(newCampaign.minRides) || 0) : undefined,
      qualifyStartDate: hasQC ? (newCampaign.qualifyStartDate || '') : undefined,
      qualifyEndDate: hasQC ? (newCampaign.qualifyEndDate || '') : undefined,
      rewardAvailableFrom: hasQC ? (newCampaign.rewardAvailableFrom || '') : undefined,
      lastModifiedBy: currentUser?.email || 'system',
      lastModifiedAt: serverTimestamp(),
    };

    // Clean undefined for Firebase update; and null-out QC fields when QC is off to clear old values
    const payload: any = Object.fromEntries(Object.entries(campaignData).filter(([_, v]) => v !== undefined));
    if (!hasQC) {
      payload.qualifyingServiceId = null;
      payload.criteriaType = null;
      payload.minDistanceKm = null;
      payload.minRides = null;
      payload.qualifyStartDate = null;
      payload.qualifyEndDate = null;
      payload.rewardAvailableFrom = null;
    }

    // Basic validation when QC is enabled
    if (hasQC) {
      if (!campaignData.qualifyingServiceId) {
        alert('Please select a qualifying service.');
        return;
      }
      if (derivedCriteriaType === 'distance' && (!newCampaign.minDistanceKm || parseFloat(newCampaign.minDistanceKm) <= 0)) {
        alert('Please enter a valid minimum distance in km.');
        return;
      }
      if (derivedCriteriaType === 'rides' && (!newCampaign.minRides || parseInt(newCampaign.minRides) <= 0)) {
        alert('Please enter a valid minimum number of rides.');
        return;
      }
      if (!newCampaign.qualifyStartDate || !newCampaign.qualifyEndDate) {
        alert('Please select qualification start and end dates.');
        return;
      }
    }

    try {
        if (editingCampaign) {
            const campaignRef = ref(db, `campaigns/${editingCampaign.id}`);
            await update(campaignRef, payload);

            // Log audit for update
      if (currentUser) {
  const changes = calculateChanges(editingCampaign, payload);
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'update',
                    entityType: 'campaign',
                    entityId: editingCampaign.id,
                    entityName: campaignData.name,
                    changes,
                });
            }
        } else {
            const campaignsListRef = ref(db, 'campaigns');
            const newCampaignRef = push(campaignsListRef);
            await set(newCampaignRef, payload);

            // Log audit for create
            if (currentUser) {
                await logAudit({
                    userId: currentUser.email,
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    action: 'create',
                    entityType: 'campaign',
                    entityId: newCampaignRef.key || '',
                    entityName: payload.name,
                });
            }
        }
        setIsModalOpen(false);
        setEditingCampaign(null);
        await fetchCampaigns();
    } catch (error) {
        console.error("Error saving campaign:", error);
        alert("Failed to save campaign. See console for details.");
    }
  };
  
  const handleDeleteCampaign = async (campaignId: string) => {
      if (window.confirm('Are you sure you want to delete this campaign?')) {
          try {
              // Get campaign details before deletion for audit log
              const campaignToDelete = campaigns.find(c => c.id === campaignId);
              
              await remove(ref(db, `campaigns/${campaignId}`));
              
              // Log audit for delete
              if (currentUser && campaignToDelete) {
                  await logAudit({
                      userId: currentUser.email,
                      userName: currentUser.name,
                      userEmail: currentUser.email,
                      action: 'delete',
                      entityType: 'campaign',
                      entityId: campaignId,
                      entityName: campaignToDelete.name,
                  });
              }
              
              await fetchCampaigns();
          } catch(error) {
              console.error('Error deleting campaign:', error);
              alert('Failed to delete campaign.');
          }
      }
  };

  const handleGenerateIdea = useCallback(async () => {
    setIsGenerating(true);
    try {
        const randomServices = mockServices.slice(0, Math.floor(Math.random() * 2) + 1);
        const location = randomServices[0]?.location || "Berlin";

        const idea = await generateCampaignIdea(randomServices, location);
        
        setEditingCampaign(null);
        setNewCampaign(prev => ({
            ...initialNewCampaignState,
            name: idea.name,
            description: idea.description,
        }));
        setIsModalOpen(true);

    } catch (error) {
        console.error("Failed to generate campaign idea:", error);
        alert("Sorry, we couldn't generate an idea at this time.");
    } finally {
        setIsGenerating(false);
    }
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Campaign Management</h1>
        <div className="flex items-center space-x-2">
            <button 
              onClick={handleGenerateIdea}
              disabled={isGenerating}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-300">
                <SparklesIcon className="w-5 h-5 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Idea with AI'}
            </button>
            <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Add Campaign
            </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Campaign Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Qualifying</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading campaigns from Realtime Database...</td></tr>
              ) : campaigns.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-500">No campaigns found in database.</td></tr>
              ) : (
                campaigns.map((campaign) => {
                  const isExpired = campaign.endDate ? (new Date(campaign.endDate).getTime() < new Date().getTime()) : false;
                  return (
                  <tr key={campaign.id}>
                    <td className="px-6 py-4">
                      <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                        {campaign.name}
                        {isExpired && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-200">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} w-64 truncate`}>{campaign.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {campaign.cityId ? (cities.find(c => c.id === campaign.cityId)?.name || '—') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {campaign.discountType === DiscountType.Fixed ? `€${campaign.discountValue.toFixed(2)}` : `${campaign.discountValue}%`}
                      </div>
                      <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'}`}>{campaign.discountType}</div>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                    {campaign.hasQualifyingCriteria === 'Y' ? (
                      <div>
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {(() => {
                            const svc = services.find(s => s.id === campaign.qualifyingServiceId);
                            const label = svc ? `${svc.name} (${svc.type})` : campaign.qualifyingServiceId || 'Service';
                            if (campaign.criteriaType === 'distance') {
                              return `${label} · ${campaign.minDistanceKm} km`;
                            }
                            if (campaign.criteriaType === 'rides') {
                              return `${label} · ${campaign.minRides} rides`;
                            }
                            return label;
                          })()}
                        </div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-xs`}>
                          {campaign.qualifyStartDate ? new Date(campaign.qualifyStartDate).toLocaleDateString() : '—'}
                          {' - '}
                          {campaign.qualifyEndDate ? new Date(campaign.qualifyEndDate).toLocaleDateString() : '—'}
                          {campaign.rewardAvailableFrom ? (
                            <span className="ml-1">• Reward from {new Date(campaign.rewardAvailableFrom).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isExpired ? 'text-yellow-600' : 'text-gray-500'}`}>
                      <div>{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : 'N/A'} -</div>
                      <div>{campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(campaign.lastModifiedAt).toLocaleString()}
                      <div className="text-xs text-gray-400">by {campaign.lastModifiedBy}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                      <button onClick={() => handleOpenModalForEdit(campaign)} className="text-primary-600 hover:text-primary-900">Edit</button>
                      <button onClick={() => handleDeleteCampaign(campaign.id)} className="ml-4 text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingCampaign ? 'Edit Campaign' : 'Add New Campaign'}</h2>
                <form onSubmit={handleSaveCampaign}>
                    <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Campaign Name</label>
                            <input type="text" name="name" id="name" value={newCampaign.name} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                         <div className="sm:col-span-2">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea name="description" id="description" value={newCampaign.description} onChange={handleInputChange} rows={3} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required></textarea>
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="serviceIds" className="block text-sm font-medium text-gray-700">Services</label>
                            <select multiple id="serviceIds" name="serviceIds" value={newCampaign.serviceIds} onChange={handleServiceIdsChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 h-32">
                              {services.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Tip: Hold Ctrl (Cmd on Mac) to select multiple services.</p>
                            {newCampaign.serviceIds && newCampaign.serviceIds.length > 0 && (
                              <div className="mt-2 text-sm text-gray-700">
                                <div className="flex items-center gap-3">
                                  <span>Selected ({newCampaign.serviceIds.length}):</span>
                                  <button
                                    type="button"
                                    onClick={() => setNewCampaign(prev => ({ ...prev, serviceIds: [] }))}
                                    className="text-xs text-primary-600 hover:underline"
                                  >
                                    Clear
                                  </button>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {services
                                    .filter(s => newCampaign.serviceIds.includes(s.id))
                                    .map(s => (
                                      <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                                        {s.name} ({s.type})
                                      </span>
                                    ))}
                                </div>
                              </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">Discount Type</label>
                            <select id="discountType" name="discountType" value={newCampaign.discountType} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                {Object.values(DiscountType).map(dt => <option key={dt} value={dt}>{dt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Discount Value</label>
                            <input type="number" name="discountValue" id="discountValue" value={newCampaign.discountValue} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" name="startDate" id="startDate" value={newCampaign.startDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                         <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" name="endDate" id="endDate" value={newCampaign.endDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="cityId" className="block text-sm font-medium text-gray-700">City (Optional)</label>
                            <select id="cityId" name="cityId" value={newCampaign.cityId} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                <option value="">None</option>
                                {cities.map(city => (
                                    <option key={city.id} value={city.id}>{city.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Qualifying Criteria Section */}
                        <div className="sm:col-span-2 mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">Qualifying Criteria</label>
                            <select
                              name="hasQualifyingCriteria"
                              value={newCampaign.hasQualifyingCriteria}
                              onChange={handleInputChange}
                              className="mt-1 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="N">No</option>
                              <option value="Y">Yes</option>
                            </select>
                          </div>

                          {newCampaign.hasQualifyingCriteria === 'Y' && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <label htmlFor="qualifyingServiceId" className="block text-sm font-medium text-gray-700">Qualifying Service</label>
                                <select
                                  id="qualifyingServiceId"
                                  name="qualifyingServiceId"
                                  value={newCampaign.qualifyingServiceId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const svc = services.find(s => s.id === val);
                                    setNewCampaign(prev => ({
                                      ...prev,
                                      qualifyingServiceId: val,
                                      criteriaType: svc ? (svc.type.toLowerCase().includes('train') ? 'rides' : (svc.type.toLowerCase().includes('scooter') ? 'distance' : prev.criteriaType)) : prev.criteriaType
                                    }));
                                  }}
                                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="">Select a service</option>
                                  {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                  ))}
                                </select>
                              </div>

                              {newCampaign.criteriaType === 'distance' && (
                                <div>
                                  <label htmlFor="minDistanceKm" className="block text-sm font-medium text-gray-700">Minimum Distance (km)</label>
                                  <input
                                    type="number"
                                    id="minDistanceKm"
                                    name="minDistanceKm"
                                    value={newCampaign.minDistanceKm}
                                    onChange={handleInputChange}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="e.g. 10"
                                    min={0}
                                  />
                                </div>
                              )}

                              {newCampaign.criteriaType === 'rides' && (
                                <div>
                                  <label htmlFor="minRides" className="block text-sm font-medium text-gray-700">Minimum Number of Rides</label>
                                  <input
                                    type="number"
                                    id="minRides"
                                    name="minRides"
                                    value={newCampaign.minRides}
                                    onChange={handleInputChange}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="e.g. 5"
                                    min={0}
                                  />
                                </div>
                              )}

                              <div>
                                <label htmlFor="qualifyStartDate" className="block text-sm font-medium text-gray-700">Qualify Start</label>
                                <input type="date" id="qualifyStartDate" name="qualifyStartDate" value={newCampaign.qualifyStartDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                              </div>
                              <div>
                                <label htmlFor="qualifyEndDate" className="block text-sm font-medium text-gray-700">Qualify End</label>
                                <input type="date" id="qualifyEndDate" name="qualifyEndDate" value={newCampaign.qualifyEndDate} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                              </div>
                              <div className="sm:col-span-2">
                                <label htmlFor="rewardAvailableFrom" className="block text-sm font-medium text-gray-700">Reward Available From</label>
                                <input type="date" id="rewardAvailableFrom" name="rewardAvailableFrom" value={newCampaign.rewardAvailableFrom} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                                <p className="text-xs text-gray-500 mt-1">Tip: Often the reward becomes available after the qualification period ends.</p>
                              </div>
                            </div>
                          )}
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
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