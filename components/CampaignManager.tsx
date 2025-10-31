import React, { useState, useCallback, useEffect } from 'react';
import { ref, get, push, set, serverTimestamp, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { Campaign, DiscountType, Service, ServiceStatus } from '../types';
import { generateCampaignIdea } from '../services/geminiService';
import { SparklesIcon } from './icons';

// Mock Data for AI idea generation (can be replaced with live data later)
// Fix: Updated `type` to be a string literal to align with the removal of the ServiceType enum.
const mockServices: Service[] = [
  { id: 'svc_1', name: 'Berlin City eCars', type: 'Electric Car', location: 'Berlin', description: 'Convenient electric car sharing.', price: 15, currency: 'EUR', status: ServiceStatus.Available, lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_2', name: 'Munich eScooters', type: 'eScooter', location: 'Munich', description: 'Fun and fast e-scooters.', price: 0.25, currency: 'EUR', status: ServiceStatus.Available, lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_3', name: 'Hamburg eBikes', type: 'eBike', location: 'Hamburg', description: 'Explore the city on two wheels.', price: 10, currency: 'EUR', status: ServiceStatus.Available, lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_4', name: 'Berlin Buses', type: 'Bus', location: 'Berlin', description: 'Public transport buses.', price: 3, currency: 'EUR', status: ServiceStatus.Available, lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
  { id: 'svc_5', name: 'Munich S-Bahn', type: 'Train', location: 'Munich', description: 'Suburban train network.', price: 3.3, currency: 'EUR', status: ServiceStatus.Available, lastModifiedBy: 'system', lastModifiedAt: new Date().toISOString() },
];

const initialNewCampaignState = {
    name: '',
    description: '',
    serviceIds: '',
    discountType: DiscountType.Percentage,
    discountValue: '',
    startDate: '',
    endDate: '',
};

const CampaignManager: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState(initialNewCampaignState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);


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
            list.sort((a, b) => new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime());
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
        serviceIds: campaign.serviceIds.join(', '),
        discountType: campaign.discountType,
        discountValue: String(campaign.discountValue),
        startDate: campaign.startDate,
        endDate: campaign.endDate,
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewCampaign(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const campaignData = {
      name: newCampaign.name,
      description: newCampaign.description,
      serviceIds: newCampaign.serviceIds.split(',').map(s => s.trim()).filter(Boolean),
      discountType: newCampaign.discountType,
      discountValue: parseFloat(newCampaign.discountValue) || 0,
      startDate: newCampaign.startDate,
      endDate: newCampaign.endDate,
      lastModifiedBy: 'usr_admin',
      lastModifiedAt: serverTimestamp(),
    };

    try {
        if (editingCampaign) {
            const campaignRef = ref(db, `campaigns/${editingCampaign.id}`);
            await update(campaignRef, campaignData);
        } else {
            const campaignsListRef = ref(db, 'campaigns');
            const newCampaignRef = push(campaignsListRef);
            await set(newCampaignRef, campaignData);
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
              await remove(ref(db, `campaigns/${campaignId}`));
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
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading campaigns from Realtime Database...</td></tr>
              ) : campaigns.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-500">No campaigns found in database.</td></tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{campaign.name}</div>
                      <div className="text-gray-500 w-64 truncate">{campaign.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                          {campaign.discountType === DiscountType.Fixed ? `€${campaign.discountValue.toFixed(2)}` : `${campaign.discountValue}%`}
                      </div>
                      <div className="text-gray-500">{campaign.discountType}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
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
                ))
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
                            <label htmlFor="serviceIds" className="block text-sm font-medium text-gray-700">Service IDs (comma-separated)</label>
                            <input type="text" name="serviceIds" id="serviceIds" value={newCampaign.serviceIds} onChange={handleInputChange} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="e.g. svc_1, svc_3" />
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