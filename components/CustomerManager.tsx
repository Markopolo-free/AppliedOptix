import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, push, set, update, remove, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import { Customer } from '../types';
import { logAudit, calculateChanges } from '../services/auditService';
import { useAuth } from '../contexts/AuthContext';

const CustomerManager: React.FC = () => {
    const [countries, setCountries] = useState<{id: string, name: string}[]>([]);
    const [cities, setCities] = useState<{id: string, name: string, country: string}[]>([]);
    const [userGroups, setUserGroups] = useState<string[]>([]);
    const [zones, setZones] = useState<{id: string, name: string}[]>([]);
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', country: '', city: '', userGroup: '', zone: '' });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const customersRef = ref(db, 'customers');
      const snapshot = await get(customersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const customersList: Customer[] = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name || '',
          email: data[key].email || '',
          country: data[key].country || '',
          city: data[key].city || '',
          userGroup: data[key].userGroup || '',
          zone: data[key].zone || '',
          createdAt: data[key].createdAt || '',
          lastModifiedBy: data[key].lastModifiedBy,
          lastModifiedAt: data[key].lastModifiedAt,
        }));
        customersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCustomers(customersList);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      alert('Could not fetch customer data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
        // Fetch countries
        const dbRef = ref(db, 'referenceCountries');
        get(dbRef).then(snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setCountries(Object.entries(data).map(([id, c]: [string, any]) => ({ id, name: c.name })));
          }
        });
        // Fetch cities
        const cityRef = ref(db, 'referenceCities');
        get(cityRef).then(snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setCities(Object.entries(data).map(([id, c]: [string, any]) => ({ id, name: c.name, country: c.country || '' })));
          }
        });
        // Fetch zones
        const zoneRef = ref(db, 'referenceZones');
        get(zoneRef).then(snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            // Remove string[] assignment, only use array of objects
            setZones(Object.entries(data).map(([id, z]: [string, any]) => ({ id, name: z.name })));
          }
        });
        // Set user groups from enum
        setUserGroups(['Standard', 'Senior', 'Child', 'Student', 'Corporate']);
    fetchCustomers();
  }, [fetchCustomers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'country') {
      setFormData(prev => ({ ...prev, country: value, city: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleOpenModalForAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', email: '', country: '', city: '', userGroup: '', zone: '' });
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      country: customer.country || '',
      city: customer.city || '',
      userGroup: customer.userGroup || '',
      zone: customer.zone || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      if (editingCustomer) {
        const customerRef = ref(db, `customers/${editingCustomer.id}`);
        await update(customerRef, {
          ...formData,
          lastModifiedAt: serverTimestamp(),
          lastModifiedBy: currentUser?.email || 'System',
        });
        // Audit log for update
        if (currentUser) {
          const changes = calculateChanges(editingCustomer, formData);
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'update',
            entityType: 'user',
            entityId: editingCustomer.id,
            entityName: formData.name,
            changes,
          });
        }
      } else {
        const customersListRef = ref(db, 'customers');
        const newCustomerRef = push(customersListRef);
        await set(newCustomerRef, {
          ...formData,
          createdAt: serverTimestamp(),
          lastModifiedAt: serverTimestamp(),
          lastModifiedBy: currentUser?.email || 'System',
        });
        // Audit log for create
        if (currentUser) {
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'create',
            entityType: 'user',
            entityId: newCustomerRef.key || '',
            entityName: formData.name,
          });
        }
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      await fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer.');
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await remove(ref(db, `customers/${customerId}`));
        await fetchCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Failed to delete customer.');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Customer Management</h1>
        <button onClick={handleOpenModalForAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          Add Customer
        </button>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Country</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">User Group</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Zone</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Created At</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-500">Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-500">No customers found.</td></tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{customer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.country}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.city}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.userGroup}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{customer.zone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{customer.createdAt ? new Date(customer.createdAt).toLocaleString() : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                      <button className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2" onClick={() => handleOpenModalForEdit(customer)}>Edit</button>
                      <button className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600" onClick={() => handleDeleteCustomer(customer.id)}>Delete</button>
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
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
            <form onSubmit={handleSaveCustomer}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div className="mb-4">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select id="country" name="country" value={formData.country} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Country</option>
                  {countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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
                <label htmlFor="userGroup" className="block text-sm font-medium text-gray-700 mb-1">User Group</label>
                <select id="userGroup" name="userGroup" value={formData.userGroup} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select User Group</option>
                  {userGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select id="zone" name="zone" value={formData.zone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                  <option value="">Select Zone</option>
                  {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
                </select>
              </div>
              <div className="mt-8 flex justify-end space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingCustomer ? 'Save Changes' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManager;
