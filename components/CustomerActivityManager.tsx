import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, update, remove, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import { CustomerActivity, Service, Customer } from '../types';
import { useAuth } from '../contexts/AuthContext';

const CustomerActivityManager: React.FC = () => {
    const [zones, setZones] = useState([]);
    const [countries, setCountries] = useState<{id: string, name: string}[]>([]);
    const [cities, setCities] = useState<{id: string, name: string, country: string}[]>([]);
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customerId: '', serviceId: '', value: '', pricingBasis: 'Distance (km)', country: '', city: '', zone: '' });
  const [editingActivity, setEditingActivity] = useState<CustomerActivity | null>(null);

  // Fetch customers and available services
  const fetchData = useCallback(async () => {
                    // Fetch cities from reference data
                    const citiesRef = ref(db, 'referenceCities');
                    const citiesSnap = await get(citiesRef);
                    let citiesList = [];
                    if (citiesSnap.exists()) {
                      const data = citiesSnap.val();
                      citiesList = Object.entries(data).map(([id, c]: [string, any]) => ({ id, name: c.name, country: c.country || '' }));
                    }
                    setCities(citiesList);
          // Fetch zones from reference data
          const zonesRef = ref(db, 'referenceZones');
          const zonesSnap = await get(zonesRef);
          let zonesList = [];
          if (zonesSnap.exists()) {
            const data = zonesSnap.val();
            zonesList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          }
          setZones(zonesList);

          // Fetch countries from reference data
          const countriesRef = ref(db, 'referenceCountries');
          const countriesSnap = await get(countriesRef);
          let countriesList = [];
          if (countriesSnap.exists()) {
            const data = countriesSnap.val();
            countriesList = Object.entries(data).map(([id, c]: [string, any]) => ({ id, name: c.name }));
          }
          setCountries(countriesList);
    setIsLoading(true);
    try {
      const customersRef = ref(db, 'customers');
      const customersSnap = await get(customersRef);
      let customersList: Customer[] = [];
      if (customersSnap.exists()) {
        const data = customersSnap.val();
        customersList = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name || '',
          email: data[key].email || '',
          createdAt: data[key].createdAt || '',
        }));
      }
      setCustomers(customersList);

      const servicesRef = ref(db, 'services');
      const servicesSnap = await get(servicesRef);
      let servicesList: Service[] = [];
      if (servicesSnap.exists()) {
        const data = servicesSnap.val();
        servicesList = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter((service: Service) => service.status === 'Available');
      }
      setServices(servicesList);

      const activitiesRef = ref(db, 'customerActivities');
      const activitiesSnap = await get(activitiesRef);
      let activitiesList: CustomerActivity[] = [];
      if (activitiesSnap.exists()) {
        const data = activitiesSnap.val();
        activitiesList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      }
      setActivities(activitiesList);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Could not fetch activity data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'customerId') {
      const selectedCustomer = customers.find(c => c.id === value);
      setFormData(prev => ({
        ...prev,
        customerId: value,
        country: selectedCustomer?.country || '',
        city: selectedCustomer?.city || '',
        zone: selectedCustomer?.zone || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleOpenModalForAdd = () => {
    setEditingActivity(null);
    setFormData({ customerId: '', serviceId: '', value: '', pricingBasis: 'Distance (km)', country: '', city: '', zone: '' });
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (activity: CustomerActivity) => {
    setEditingActivity(activity);
    const customer = customers.find(c => c.id === activity.customerId);
    setFormData({
      customerId: activity.customerId,
      serviceId: activity.serviceId,
      value: activity.pricingBasis === 'Time (hour)' ? String(activity.timeUsed ?? '') : String(activity.distanceTravelled ?? ''),
      pricingBasis: activity.pricingBasis,
      country: customer?.country ?? '',
      city: customer?.city ?? '',
      zone: customer?.zone ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.serviceId || !formData.value) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const selectedService = services.find(s => s.id === formData.serviceId);
      if (!selectedService) {
        alert('Selected service not found.');
        return;
      }
      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      const activityData: any = {
        customerId: formData.customerId,
        serviceId: formData.serviceId,
        serviceType: selectedService.type,
        country: selectedCustomer?.country || '',
        city: selectedCustomer?.city || '',
        zone: selectedCustomer?.zone || '',
        pricingBasis: formData.pricingBasis,
      };
      if (formData.pricingBasis === 'Time (hour)') {
        activityData.timeUsed = parseFloat(formData.value) || 0;
      } else {
        activityData.distanceTravelled = parseFloat(formData.value) || 0;
      }
      if (editingActivity) {
        const activityRef = ref(db, `customerActivities/${editingActivity.id}`);
        await update(activityRef, activityData);
      } else {
        const activitiesListRef = ref(db, 'customerActivities');
        const newActivityRef = push(activitiesListRef);
        await set(newActivityRef, activityData);
      }
      setIsModalOpen(false);
      setEditingActivity(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Failed to save activity.');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (window.confirm('Are you sure you want to delete this activity?')) {
      try {
        await remove(ref(db, `customerActivities/${activityId}`));
        await fetchData();
      } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Failed to delete activity.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Customer Activity Management</h1>
        <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          Add Activity
        </button>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Service</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Zone</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">{`Distance/Time Used`}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Pricing Basis</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-500">Loading activities...</td></tr>
              ) : activities.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-500">No activities found.</td></tr>
              ) : (
                activities.map((activity) => {
                  const customer = customers.find(c => c.id === activity.customerId);
                  const service = services.find(s => s.id === activity.serviceId);
                  return (
                    <tr key={activity.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{customer ? customer.name : 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{service ? service.name : 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{activity.serviceType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{activity.country}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{activity.city}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{activity.zone ?? ''}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{activity.pricingBasis === 'Time (hour)' ? activity.timeUsed : activity.distanceTravelled}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{activity.pricingBasis}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        <button className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2" onClick={() => handleOpenModalForEdit(activity)}>Edit</button>
                        <button className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" onClick={() => handleDeleteActivity(activity.id)}>Delete</button>
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
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingActivity ? 'Edit Activity' : 'Add New Activity'}</h2>
            <form onSubmit={handleSaveActivity}>
              <div className="mb-4">
                <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select name="customerId" id="customerId" value={formData.customerId} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select id="country" name="country" value={formData.country} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Country</option>
                  {countries.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select id="city" name="city" value={formData.city} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select City</option>
                  {formData.country
                    ? cities.filter(c => c.country === formData.country || (formData.country === 'Germany' && !c.country)).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    : cities.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select name="serviceId" id="serviceId" value={formData.serviceId} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required>
                  <option value="">Select Service</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="pricingBasis" className="block text-sm font-medium text-gray-700 mb-1">Pricing Basis</label>
                <select name="pricingBasis" id="pricingBasis" value={formData.pricingBasis} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required>
                  <option value="Distance (km)">Distance (Km)</option>
                  <option value="Time (hour)">Time (Hrs)</option>
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="value" className="block text-sm font-medium text-gray-700 mb-1">{formData.pricingBasis === 'Time (hour)' ? 'Time Used (hours)' : 'Distance Travelled (km)'}</label>
                <input type="number" id="value" name="value" value={formData.value} onChange={handleInputChange} step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div className="mb-4">
                <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select id="zone" name="zone" value={formData.zone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Zone</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.name}>{z.name} ({z.country}, {z.location})</option>
                  ))}
                </select>
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingActivity ? 'Save Changes' : 'Add Activity'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerActivityManager;
