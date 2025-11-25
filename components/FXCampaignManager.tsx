import React, { useState, useCallback, useEffect } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { FXCampaign } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Helper to generate campaign number (format: FXCAMP-YYYYMMDD-XXXX)
const generateCampaignNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `FXCAMP-${year}${month}${day}-${random}`;
};

const discountTypes = ['Cashback', 'Discount', 'Bonus Points', 'Fee Waiver'] as const;

const initialNewCampaignState = {
  name: '',
  description: '',
  countryId: '',
  cityId: '',
  currency: '',
  serviceItem: '',
  discountType: 'Cashback' as const,
  discountAmount: '',
  qualifyingEvent: '',
  startDate: getTodayString(),
  endDate: '',
  qualifyStartDate: getTodayString(),
  qualifyEndDate: '',
  rewardAvailableFrom: '',
};

const FXCampaignManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<FXCampaign[]>([]);
  const [currencies, setCurrencies] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<Array<{ id: string; name: string; country: string }>>([]);
  const [filteredCities, setFilteredCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState(initialNewCampaignState);
  const [editingCampaign, setEditingCampaign] = useState<FXCampaign | null>(null);

  // Fetch currencies from reference data
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const currenciesRef = ref(db, 'referenceCurrencies');
        const snap = await get(currenciesRef);
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.keys(data).map((key) => ({
            id: key,
            code: data[key].code,
            name: data[key].name,
          }));
          setCurrencies(list.sort((a, b) => a.code.localeCompare(b.code)));
        } else {
          setCurrencies([]);
        }
      } catch (err) {
        console.error('Error loading currencies:', err);
      }
    };
    loadCurrencies();
  }, []);

  // Fetch countries from reference data
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const countriesRef = ref(db, 'referenceCountries');
        const snapshot = await get(countriesRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const countryList = Object.keys(data).map((key) => data[key].name);
          setCountries(countryList.sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };
    fetchCountries();
  }, []);

  // Fetch cities from reference data
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const citiesRef = ref(db, 'referenceCities');
        const snapshot = await get(citiesRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const cityList = Object.keys(data).map((key) => ({
            id: key,
            name: data[key].name,
            country: data[key].country || '', // Some cities may have empty country (legacy)
          }));
          setCities(cityList);
        }
      } catch (error) {
        console.error('Error fetching cities:', error);
      }
    };
    fetchCities();
  }, []);

  // Filter cities based on selected country
  useEffect(() => {
    if (newCampaign.countryId) {
      // Filter cities for the selected country, including legacy cities with empty country for Germany
      const filtered = cities
        .filter((city) => 
          city.country === newCampaign.countryId || 
          (newCampaign.countryId === 'Germany' && city.country === '')
        )
        .map((city) => city.name)
        .sort((a, b) => a.localeCompare(b));
      setFilteredCities(filtered);
    } else {
      setFilteredCities([]);
    }
  }, [newCampaign.countryId, cities]);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const campaignsRef = ref(db, 'fxCampaigns');
      const snapshot = await get(campaignsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: FXCampaign[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
          lastModifiedAt: new Date(data[key].lastModifiedAt).toISOString(),
        }));
        
        // Sort by campaign start date (most recent first)
        const isExpired = (c: FXCampaign) => {
          if (!c.endDate) return false;
          return new Date(c.endDate).getTime() < new Date().getTime();
        };
        list.sort((a, b) => {
          const aExpired = isExpired(a);
          const bExpired = isExpired(b);
          // First sort by expiry status: active first, expired last
          if (aExpired !== bExpired) return aExpired ? 1 : -1;
          // Then sort by start date (most recent first)
          const aStartDate = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bStartDate = b.startDate ? new Date(b.startDate).getTime() : 0;
          return bStartDate - aStartDate;
        });
        setCampaigns(list);
      } else {
        setCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching FX campaigns:', error);
      alert('Could not fetch FX campaigns. See console for details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleOpenModalForAdd = () => {
    setEditingCampaign(null);
    setNewCampaign(initialNewCampaignState);
    setFilteredCities([]); // Clear filtered cities when opening modal
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (campaign: FXCampaign) => {
    setEditingCampaign(campaign);
    setNewCampaign({
      name: campaign.name,
      description: campaign.description,
      countryId: campaign.countryId || '',
      cityId: campaign.cityId || '',
      currency: campaign.currency,
      serviceItem: campaign.serviceItem,
      discountType: campaign.discountType as any,
      discountAmount: campaign.discountAmount,
      qualifyingEvent: campaign.qualifyingEvent,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      qualifyStartDate: campaign.qualifyStartDate,
      qualifyEndDate: campaign.qualifyEndDate,
      rewardAvailableFrom: campaign.rewardAvailableFrom,
    });
    
    // Pre-filter cities if country is set
    if (campaign.countryId) {
      const filtered = cities
        .filter((city) => 
          city.country === campaign.countryId || 
          (campaign.countryId === 'Germany' && city.country === '')
        )
        .map((city) => city.name)
        .sort((a, b) => a.localeCompare(b));
      setFilteredCities(filtered);
    } else {
      setFilteredCities([]);
    }
    
    setIsModalOpen(true);
  };

  const handleCloneCampaign = (campaign: FXCampaign) => {
    setEditingCampaign(null); // Set to null so it creates a new campaign
    setNewCampaign({
      name: `${campaign.name} (Copy)`,
      description: campaign.description,
      countryId: campaign.countryId || '',
      cityId: campaign.cityId || '',
      currency: campaign.currency,
      serviceItem: campaign.serviceItem,
      discountType: 'Cashback',
      discountAmount: campaign.discountAmount,
      qualifyingEvent: campaign.qualifyingEvent,
      startDate: getTodayString(), // Reset to today
      endDate: '',
      qualifyStartDate: getTodayString(), // Reset to today
      qualifyEndDate: '',
      rewardAvailableFrom: '',
    });
    
    // Pre-filter cities if country is set
    if (campaign.countryId) {
      const filtered = cities
        .filter((city) => 
          city.country === campaign.countryId || 
          (campaign.countryId === 'Germany' && city.country === '')
        )
        .map((city) => city.name)
        .sort((a, b) => a.localeCompare(b));
      setFilteredCities(filtered);
    } else {
      setFilteredCities([]);
    }
    
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCampaign((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    const campaignData = {
      campaignNumber: editingCampaign?.campaignNumber || generateCampaignNumber(),
      name: newCampaign.name,
      description: newCampaign.description,
      countryId: newCampaign.countryId || undefined,
      cityId: newCampaign.cityId || undefined,
      currency: newCampaign.currency,
      serviceItem: newCampaign.serviceItem,
      discountType: newCampaign.discountType,
      discountAmount: newCampaign.discountAmount,
      qualifyingEvent: newCampaign.qualifyingEvent,
      startDate: newCampaign.startDate,
      endDate: newCampaign.endDate,
      qualifyStartDate: newCampaign.qualifyStartDate,
      qualifyEndDate: newCampaign.qualifyEndDate,
      rewardAvailableFrom: newCampaign.rewardAvailableFrom,
      lastModifiedBy: currentUser?.email || 'system',
      lastModifiedAt: serverTimestamp(),
    };

    try {
      if (editingCampaign) {
        const campaignRef = ref(db, `fxCampaigns/${editingCampaign.id}`);
        await update(campaignRef, campaignData);

        // Log audit for update
        if (currentUser) {
          const changes = calculateChanges(editingCampaign, campaignData);
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'update',
            entityType: 'fxcampaign',
            entityId: editingCampaign.id,
            entityName: campaignData.name,
            changes,
          });
        }
      } else {
        const campaignsListRef = ref(db, 'fxCampaigns');
        const newCampaignRef = push(campaignsListRef);
        await set(newCampaignRef, campaignData);

        // Log audit for create
        if (currentUser) {
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'create',
            entityType: 'fxcampaign',
            entityId: newCampaignRef.key || '',
            entityName: campaignData.name,
          });
        }
      }
      setIsModalOpen(false);
      setEditingCampaign(null);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error saving FX campaign:', error);
      alert('Failed to save FX campaign. See console for details.');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (window.confirm('Are you sure you want to delete this FX campaign?')) {
      try {
        // Get campaign details before deletion for audit log
        const campaignToDelete = campaigns.find((c) => c.id === campaignId);

        await remove(ref(db, `fxCampaigns/${campaignId}`));

        // Log audit for delete
        if (currentUser && campaignToDelete) {
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'delete',
            entityType: 'fxcampaign',
            entityId: campaignId,
            entityName: campaignToDelete.name,
          });
        }

        await fetchCampaigns();
      } catch (error) {
        console.error('Error deleting FX campaign:', error);
        alert('Failed to delete FX campaign.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">FX Campaign Management</h1>
        <button
          onClick={handleOpenModalForAdd}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add FX Campaign
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Campaign Number</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Campaign Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Currency</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Qualifying Event</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Period</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-500">
                    Loading FX campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-500">
                    No FX campaigns found.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const isExpired = campaign.endDate ? new Date(campaign.endDate).getTime() < new Date().getTime() : false;
                  return (
                    <tr 
                      key={campaign.id}
                      className={isExpired ? 'bg-yellow-50' : 'bg-white'}
                      style={isExpired ? { backgroundColor: '#fefce8' } : {}}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-mono text-sm ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {campaign.campaignNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {campaign.name}
                          {isExpired && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-200">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-sm`}>{campaign.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${isExpired ? 'text-yellow-600' : 'text-gray-700'}`}>{campaign.countryId || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${isExpired ? 'text-yellow-600' : 'text-gray-700'}`}>{campaign.cityId || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>{campaign.currency}</div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-xs`}>{campaign.serviceItem}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>{campaign.discountAmount}</div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-xs`}>{campaign.discountType}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`${isExpired ? 'text-yellow-600' : 'text-gray-700'}`}>{campaign.qualifyingEvent}</div>
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
                        <button
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                          onClick={() => handleOpenModalForEdit(campaign)}
                        >Edit</button>
                        <button
                          className="px-2 py-1 bg-blue-400 text-white rounded hover:bg-blue-500 mr-2"
                          onClick={() => handleCloneCampaign(campaign)}
                          title="Clone this campaign"
                        >Clone</button>
                        <button
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {editingCampaign ? 'Edit FX Campaign' : 'Add New FX Campaign'}
            </h2>
            <form onSubmit={handleSaveCampaign}>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={newCampaign.name}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    value={newCampaign.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="countryId" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <select
                    id="countryId"
                    name="countryId"
                    value={newCampaign.countryId}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select country...</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cityId" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <select
                    id="cityId"
                    name="cityId"
                    value={newCampaign.cityId}
                    onChange={handleInputChange}
                    disabled={!newCampaign.countryId}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select city...</option>
                    {filteredCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={newCampaign.currency}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select currency...</option>
                    {currencies.map((curr) => (
                      <option key={curr.id} value={curr.code}>
                        {curr.code} - {curr.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="serviceItem" className="block text-sm font-medium text-gray-700">
                    Service Item
                  </label>
                  <input
                    type="text"
                    name="serviceItem"
                    id="serviceItem"
                    value={newCampaign.serviceItem}
                    onChange={handleInputChange}
                    placeholder="e.g., International Transfer"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">
                    Discount Type
                  </label>
                  <select
                    id="discountType"
                    name="discountType"
                    value={newCampaign.discountType}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    {discountTypes.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="discountAmount" className="block text-sm font-medium text-gray-700">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    name="discountAmount"
                    id="discountAmount"
                    value={newCampaign.discountAmount}
                    onChange={handleInputChange}
                    placeholder="e.g., 1.00"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter numeric value (e.g., 1 for $1 cashback per $100)</p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="qualifyingEvent" className="block text-sm font-medium text-gray-700">
                    Qualifying Event
                  </label>
                  <input
                    type="text"
                    name="qualifyingEvent"
                    id="qualifyingEvent"
                    value={newCampaign.qualifyingEvent}
                    onChange={handleInputChange}
                    placeholder="e.g., Debit Card used overseas"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Campaign Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    id="startDate"
                    value={newCampaign.startDate}
                    onChange={handleInputChange}
                    min={editingCampaign ? undefined : getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    Campaign End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    id="endDate"
                    value={newCampaign.endDate}
                    onChange={handleInputChange}
                    min={editingCampaign ? undefined : (newCampaign.startDate || getTodayString())}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="qualifyStartDate" className="block text-sm font-medium text-gray-700">
                    Qualifying Period Start
                  </label>
                  <input
                    type="date"
                    name="qualifyStartDate"
                    id="qualifyStartDate"
                    value={newCampaign.qualifyStartDate}
                    onChange={handleInputChange}
                    min={editingCampaign ? undefined : getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="qualifyEndDate" className="block text-sm font-medium text-gray-700">
                    Qualifying Period End
                  </label>
                  <input
                    type="date"
                    name="qualifyEndDate"
                    id="qualifyEndDate"
                    value={newCampaign.qualifyEndDate}
                    onChange={handleInputChange}
                    min={editingCampaign ? undefined : (newCampaign.qualifyStartDate || getTodayString())}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="rewardAvailableFrom" className="block text-sm font-medium text-gray-700">
                    Reward Available From
                  </label>
                  <input
                    type="date"
                    name="rewardAvailableFrom"
                    id="rewardAvailableFrom"
                    value={newCampaign.rewardAvailableFrom}
                    onChange={handleInputChange}
                    min={editingCampaign ? undefined : getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Often the reward becomes available after the qualification period ends.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingCampaign ? 'Save Changes' : 'Save Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FXCampaignManager;
