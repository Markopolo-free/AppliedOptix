import React, { useState, useCallback, useEffect } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { Campaign, DiscountType, Service, ServiceStatus, ServiceQualifyingCriteria } from '../types';
import { generateCampaignIdea } from '../services/geminiService';
import { SparklesIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

// Mock Data for AI idea generation (can be replaced with live data later)
// Fix: Updated `type` to be a string literal to align with the removal of the ServiceType enum.
const mockServices: Service[] = [
  { id: 'svc_1', name: 'Berlin City eCars', type: 'Electric Car', country: 'Germany', location: 'Berlin', description: 'Convenient electric car sharing.', price: 15, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_2', name: 'Munich eScooters', type: 'eScooter', country: 'Germany', location: 'Munich', description: 'Fun and fast e-scooters.', price: 0.25, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_3', name: 'Hamburg eBikes', type: 'eBike', country: 'Germany', location: 'Hamburg', description: 'Explore the city on two wheels.', price: 10, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_4', name: 'Berlin Buses', type: 'Bus', country: 'Germany', location: 'Berlin', description: 'Public transport buses.', price: 3, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_5', name: 'Munich S-Bahn', type: 'Train', country: 'Germany', location: 'Munich', description: 'Suburban train network.', price: 3.3, currency: 'EUR', status: ServiceStatus.Available, effectiveDate: new Date().toISOString(), lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
];

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const initialNewCampaignState = {
  name: '',
  description: '',
  serviceIds: [] as string[],
  discountType: DiscountType.Percentage,
    discountValue: '',
    startDate: getTodayString(),
    endDate: '',
  countryId: '',
  cityId: '',
  // Qualifying Criteria (form state)
  hasQualifyingCriteria: 'N' as 'Y' | 'N',
  qualifyingCriteria: [] as ServiceQualifyingCriteria[],
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
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);
  const [filteredCities, setFilteredCities] = useState<{ id: string; name: string }[]>([]);


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

  // Load countries from reference data
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const countriesRef = ref(db, 'referenceCountries');
        const snap = await get(countriesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.values(data).map((country: any) => country.name);
          setCountries(list.sort((a: string, b: string) => a.localeCompare(b)));
        } else {
          setCountries([]);
        }
      } catch (err) {
        console.error('Error loading countries:', err);
      }
    };
    loadCountries();
  }, []);

  // Load cities from reference data
  useEffect(() => {
    const loadCities = async () => {
      try {
        const citiesRef = ref(db, 'referenceCities');
        const snap = await get(citiesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.keys(data).map((key) => ({ 
            id: key, 
            name: data[key].name,
            country: data[key].country || ''
          }));
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

  // Filter cities by selected country
  useEffect(() => {
    if (!newCampaign.countryId) {
      setFilteredCities([]);
      return;
    }
    const filtered = cities
      .filter(city => {
        // Match by exact country
        if (city.country === newCampaign.countryId) return true;
        // Legacy support: Include cities with empty country if selecting Germany
        if (!city.country && newCampaign.countryId === 'Germany') return true;
        return false;
      })
      .map(city => ({ id: city.id, name: city.name }));
    setFilteredCities(filtered);
  }, [newCampaign.countryId, cities]);


  const handleOpenModalForAdd = () => {
      setEditingCampaign(null);
      setNewCampaign(initialNewCampaignState);
      setFilteredCities([]);
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
    countryId: campaign.countryId || '',
    cityId: campaign.cityId || '',
    hasQualifyingCriteria: campaign.hasQualifyingCriteria || 'N',
    // Load per-service criteria or convert legacy format
    qualifyingCriteria: campaign.qualifyingCriteria || (() => {
      // Convert legacy format to new format
      const legacyIds = campaign.qualifyingServiceIds || (campaign.qualifyingServiceId ? [campaign.qualifyingServiceId] : []);
      return legacyIds.map(serviceId => ({
        serviceId,
        criteriaType: (campaign.criteriaType || 'distance') as 'distance' | 'rides',
        minDistanceKm: campaign.minDistanceKm,
        minRides: campaign.minRides,
        qualifyStartDate: campaign.qualifyStartDate || '',
        qualifyEndDate: campaign.qualifyEndDate || '',
      }));
    })(),
    rewardAvailableFrom: campaign.rewardAvailableFrom || '',
    });
    // Pre-filter cities for the campaign's country
    if (campaign.countryId) {
      const filtered = cities
        .filter(city => {
          if (city.country === campaign.countryId) return true;
          if (!city.country && campaign.countryId === 'Germany') return true;
          return false;
        })
        .map(city => ({ id: city.id, name: city.name }));
      setFilteredCities(filtered);
    }
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

    const hasQC = newCampaign.hasQualifyingCriteria === 'Y';
    const campaignData = {
      name: newCampaign.name,
      description: newCampaign.description,
  serviceIds: newCampaign.serviceIds,
      discountType: newCampaign.discountType,
      discountValue: parseFloat(newCampaign.discountValue) || 0,
      startDate: newCampaign.startDate,
      endDate: newCampaign.endDate,
      countryId: newCampaign.countryId || undefined,
      cityId: newCampaign.cityId || undefined,
      hasQualifyingCriteria: hasQC ? 'Y' : 'N',
      qualifyingCriteria: hasQC ? newCampaign.qualifyingCriteria : undefined,
      rewardAvailableFrom: hasQC ? (newCampaign.rewardAvailableFrom || '') : undefined,
      lastModifiedBy: currentUser?.email || 'system',
      lastModifiedAt: serverTimestamp(),
    };

    // Clean undefined for Firebase update; and null-out QC fields when QC is off to clear old values
    const payload: any = Object.fromEntries(Object.entries(campaignData).filter(([_, v]) => v !== undefined));
    
    // Clean undefined values from qualifyingCriteria array
    if (hasQC && payload.qualifyingCriteria) {
      payload.qualifyingCriteria = payload.qualifyingCriteria.map((criteria: ServiceQualifyingCriteria) => {
        const cleaned: any = { ...criteria };
        // Remove undefined properties based on criteria type
        if (criteria.criteriaType === 'distance') {
          delete cleaned.minRides;
        } else if (criteria.criteriaType === 'rides') {
          delete cleaned.minDistanceKm;
        }
        return cleaned;
      });
    }
    
    if (!hasQC) {
      payload.qualifyingCriteria = null;
      payload.rewardAvailableFrom = null;
    }

    // Basic validation when QC is enabled
    if (hasQC) {
      if (!campaignData.qualifyingCriteria || campaignData.qualifyingCriteria.length === 0) {
        alert('Please add at least one qualifying service with criteria.');
        return;
      }
      // Validate each service's criteria
      for (const criteria of campaignData.qualifyingCriteria) {
        if (criteria.criteriaType === 'distance' && (!criteria.minDistanceKm || criteria.minDistanceKm <= 0)) {
          alert(`Please enter a valid minimum distance for service.`);
          return;
        }
        if (criteria.criteriaType === 'rides' && (!criteria.minRides || criteria.minRides <= 0)) {
          alert(`Please enter a valid minimum number of rides for service.`);
          return;
        }
        if (!criteria.qualifyStartDate || !criteria.qualifyEndDate) {
          alert(`Please select start and end dates for all qualifying services.`);
          return;
        }
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
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Campaign Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Qualifying</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Period</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-500">Loading campaigns from Realtime Database...</td></tr>
              ) : campaigns.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-500">No campaigns found in database.</td></tr>
              ) : (
                campaigns.map((campaign) => {
                  const isExpired = campaign.endDate ? (new Date(campaign.endDate).getTime() < new Date().getTime()) : false;
                  return (
                  <tr 
                    key={campaign.id}
                    className={isExpired ? 'bg-yellow-50' : 'bg-white'}
                    style={isExpired ? { backgroundColor: '#fefce8' } : {}}
                  >
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
                      {campaign.countryId || '—'}
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
                            // Support new per-service criteria and legacy formats
                            if (campaign.qualifyingCriteria && campaign.qualifyingCriteria.length > 0) {
                              return campaign.qualifyingCriteria.map((criteria, idx) => {
                                const svc = services.find(s => s.id === criteria.serviceId);
                                const serviceName = svc ? `${svc.name} (${svc.type})` : criteria.serviceId;
                                const metric = criteria.criteriaType === 'distance' 
                                  ? `${criteria.minDistanceKm} km` 
                                  : `${criteria.minRides} rides`;
                                const dates = `${new Date(criteria.qualifyStartDate).toLocaleDateString()} - ${new Date(criteria.qualifyEndDate).toLocaleDateString()}`;
                                return (
                                  <div key={idx} className="mb-1">
                                    {serviceName} · {metric}
                                    <div className="text-xs text-gray-500">{dates}</div>
                                  </div>
                                );
                              });
                            }
                            // Legacy format support
                            const serviceIds = campaign.qualifyingServiceIds || (campaign.qualifyingServiceId ? [campaign.qualifyingServiceId] : []);
                            if (serviceIds.length === 0) return 'No service';
                            
                            const serviceLabels = serviceIds.map(sid => {
                              const svc = services.find(s => s.id === sid);
                              return svc ? `${svc.name} (${svc.type})` : sid;
                            }).join(', ');
                            
                            if (campaign.criteriaType === 'distance') {
                              return `${serviceLabels} · ${campaign.minDistanceKm} km`;
                            }
                            if (campaign.criteriaType === 'rides') {
                              return `${serviceLabels} · ${campaign.minRides} rides`;
                            }
                            return serviceLabels;
                          })()}
                        </div>
                        {campaign.rewardAvailableFrom && (
                          <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-xs mt-1`}>
                            Reward from {new Date(campaign.rewardAvailableFrom).toLocaleDateString()}
                          </div>
                        )}
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
                            <input type="date" name="startDate" id="startDate" value={newCampaign.startDate} onChange={handleInputChange} min={editingCampaign ? undefined : getTodayString()} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                         <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" name="endDate" id="endDate" value={newCampaign.endDate} onChange={handleInputChange} min={newCampaign.startDate || getTodayString()} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
                        </div>
                        <div>
                            <label htmlFor="countryId" className="block text-sm font-medium text-gray-700">Country (Optional)</label>
                            <select id="countryId" name="countryId" value={newCampaign.countryId} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                                <option value="">None</option>
                                {countries.map(country => (
                                    <option key={country} value={country}>{country}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="cityId" className="block text-sm font-medium text-gray-700">City (Optional)</label>
                            <select 
                                id="cityId" 
                                name="cityId" 
                                value={newCampaign.cityId} 
                                onChange={handleInputChange} 
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                disabled={!newCampaign.countryId || filteredCities.length === 0}
                            >
                                <option value="">{!newCampaign.countryId ? 'Select country first...' : 'None'}</option>
                                {filteredCities.map(city => (
                                    <option key={city.id} value={city.id}>{city.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Qualifying Criteria Section */}
                        <div className="sm:col-span-2 mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between bg-yellow-300 p-3 rounded-lg">
                            <label className="block text-sm font-bold text-gray-900">Qualifying Criteria</label>
                            <select
                              name="hasQualifyingCriteria"
                              value={newCampaign.hasQualifyingCriteria}
                              onChange={handleInputChange}
                              className="mt-1 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-semibold"
                            >
                              <option value="N">No</option>
                              <option value="Y">Yes</option>
                            </select>
                          </div>

                          {newCampaign.hasQualifyingCriteria === 'Y' && (
                            <div className="mt-3 space-y-4">
                              {/* Add new qualifying service */}
                              <div className="flex gap-2">
                                <select
                                  className="flex-1 px-3 py-2 border-2 border-yellow-400 bg-yellow-50 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 font-semibold text-gray-900"
                                  onChange={(e) => {
                                    const serviceId = e.target.value;
                                    if (!serviceId) return;
                                    // Check if already added
                                    if (newCampaign.qualifyingCriteria.some(c => c.serviceId === serviceId)) {
                                      alert('This service is already added');
                                      return;
                                    }
                                    const svc = services.find(s => s.id === serviceId);
                                    const criteriaType = svc?.type.toLowerCase().includes('train') ? 'rides' : 'distance';
                                    setNewCampaign(prev => ({
                                      ...prev,
                                      qualifyingCriteria: [
                                        ...prev.qualifyingCriteria,
                                        {
                                          serviceId,
                                          criteriaType,
                                          minDistanceKm: criteriaType === 'distance' ? 0 : undefined,
                                          minRides: criteriaType === 'rides' ? 0 : undefined,
                                          qualifyStartDate: getTodayString(),
                                          qualifyEndDate: '',
                                        }
                                      ]
                                    }));
                                    e.target.value = '';
                                  }}
                                >
                                  <option value="" className="font-bold">➕ Add Qualifying Service</option>
                                  {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                                  ))}
                                </select>
                              </div>

                              {/* Display added services */}
                              {newCampaign.qualifyingCriteria.map((criteria, index) => {
                                const svc = services.find(s => s.id === criteria.serviceId);
                                return (
                                  <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="font-medium text-gray-900">
                                        {svc ? `${svc.name} (${svc.type})` : criteria.serviceId}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewCampaign(prev => ({
                                            ...prev,
                                            qualifyingCriteria: prev.qualifyingCriteria.filter((_, i) => i !== index)
                                          }));
                                        }}
                                        className="text-red-600 hover:text-red-900 text-sm"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700">Criteria Type</label>
                                        <select
                                          value={criteria.criteriaType}
                                          onChange={(e) => {
                                            const newType = e.target.value as 'distance' | 'rides';
                                            setNewCampaign(prev => ({
                                              ...prev,
                                              qualifyingCriteria: prev.qualifyingCriteria.map((c, i) => 
                                                i === index ? {
                                                  ...c,
                                                  criteriaType: newType,
                                                  minDistanceKm: newType === 'distance' ? (c.minDistanceKm || 0) : undefined,
                                                  minRides: newType === 'rides' ? (c.minRides || 0) : undefined,
                                                } : c
                                              )
                                            }));
                                          }}
                                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        >
                                          <option value="distance">Distance (km)</option>
                                          <option value="rides">Rides</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                          {criteria.criteriaType === 'distance' ? 'Minimum Distance (km)' : 'Minimum Rides'}
                                        </label>
                                        <input
                                          type="number"
                                          value={criteria.criteriaType === 'distance' ? (criteria.minDistanceKm || '') : (criteria.minRides || '')}
                                          onChange={(e) => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setNewCampaign(prev => ({
                                              ...prev,
                                              qualifyingCriteria: prev.qualifyingCriteria.map((c, i) => 
                                                i === index ? {
                                                  ...c,
                                                  [criteria.criteriaType === 'distance' ? 'minDistanceKm' : 'minRides']: value
                                                } : c
                                              )
                                            }));
                                          }}
                                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                          min={0}
                                          step={criteria.criteriaType === 'distance' ? '0.1' : '1'}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700">Qualify Start Date</label>
                                        <input
                                          type="date"
                                          value={criteria.qualifyStartDate}
                                          onChange={(e) => {
                                            setNewCampaign(prev => ({
                                              ...prev,
                                              qualifyingCriteria: prev.qualifyingCriteria.map((c, i) => 
                                                i === index ? { ...c, qualifyStartDate: e.target.value } : c
                                              )
                                            }));
                                          }}
                                          min={getTodayString()}
                                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700">Qualify End Date</label>
                                        <input
                                          type="date"
                                          value={criteria.qualifyEndDate}
                                          onChange={(e) => {
                                            setNewCampaign(prev => ({
                                              ...prev,
                                              qualifyingCriteria: prev.qualifyingCriteria.map((c, i) => 
                                                i === index ? { ...c, qualifyEndDate: e.target.value } : c
                                              )
                                            }));
                                          }}
                                          min={criteria.qualifyStartDate || getTodayString()}
                                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

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