import React, { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import { UserDiscountGroup, Service } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

const UserDiscountGroupManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [discountGroups, setDiscountGroups] = useState<UserDiscountGroup[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserDiscountGroup | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    serviceIds: [] as string[],
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    capType: 'km' as 'km' | 'trips' | 'amount',
    capValue: '',
    capPeriod: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });

  // Load discount groups from Firebase
  useEffect(() => {
    const discountGroupsRef = ref(db, 'userDiscountGroups');
    const unsubscribe = onValue(discountGroupsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const groupsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setDiscountGroups(groupsArray);
      } else {
        setDiscountGroups([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load services from Firebase
  useEffect(() => {
    const servicesRef = ref(db, 'services');
    const unsubscribe = onValue(servicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const servicesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setServices(servicesArray);
      } else {
        setServices([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      serviceIds: [],
      discountType: 'percentage',
      discountValue: '',
      capType: 'km',
      capValue: '',
      capPeriod: 'monthly',
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: ''
    });
    setEditingGroup(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
    setError('');
  };

  const handleOpenEditModal = (group: UserDiscountGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      serviceIds: group.serviceIds,
      discountType: group.discountType,
      discountValue: group.discountValue.toString(),
      capType: group.capType,
      capValue: group.capValue.toString(),
      capPeriod: group.capPeriod,
      effectiveDate: group.effectiveDate,
      expiryDate: group.expiryDate || ''
    });
    setIsModalOpen(true);
    setError('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
    setError('');
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Group name is required');
      return;
    }

    if (formData.serviceIds.length === 0) {
      setError('At least one service must be selected');
      return;
    }

    const discountValue = parseFloat(formData.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      setError('Discount value must be a positive number');
      return;
    }

    if (formData.discountType === 'percentage' && discountValue > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }

    const capValue = parseFloat(formData.capValue);
    if (isNaN(capValue) || capValue <= 0) {
      setError('Cap value must be a positive number');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const groupData: any = {
        name: formData.name.trim(),
        serviceIds: formData.serviceIds,
        discountType: formData.discountType,
        discountValue: discountValue,
        capType: formData.capType,
        capValue: capValue,
        capPeriod: formData.capPeriod,
        effectiveDate: formData.effectiveDate,
        lastModifiedBy: currentUser.email,
        lastModifiedAt: timestamp
      };

      // Only add expiryDate if it has a value (Firebase doesn't accept undefined)
      if (formData.expiryDate) {
        groupData.expiryDate = formData.expiryDate;
      }

      if (editingGroup) {
        // Update existing group
        const groupRef = ref(db, `userDiscountGroups/${editingGroup.id}`);
        await update(groupRef, groupData);
        
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'discountgroup',
          entityId: editingGroup.id,
          entityName: formData.name,
          changes: Object.keys(groupData).map(key => ({
            field: key,
            oldValue: editingGroup[key as keyof UserDiscountGroup],
            newValue: groupData[key as keyof Omit<UserDiscountGroup, 'id'>]
          }))
        });
      } else {
        // Create new group
        const groupsRef = ref(db, 'userDiscountGroups');
        const newGroupRef = await push(groupsRef, groupData);
        
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'create',
          entityType: 'discountgroup',
          entityId: newGroupRef.key || 'unknown',
          entityName: formData.name
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error('Error saving discount group:', err);
      setError('Failed to save discount group. Please try again.');
    }
  };

  const handleDelete = async (group: UserDiscountGroup) => {
    if (!window.confirm(`Are you sure you want to delete "${group.name}"?`)) {
      return;
    }

    try {
      const groupRef = ref(db, `userDiscountGroups/${group.id}`);
      await remove(groupRef);
      
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'delete',
        entityType: 'discountgroup',
        entityId: group.id,
        entityName: group.name
      });
    } catch (err) {
      console.error('Error deleting discount group:', err);
      setError('Failed to delete discount group. Please try again.');
    }
  };

  const getServiceNames = (serviceIds: string[]): string => {
    return serviceIds
      .map(id => services.find(s => s.id === id)?.name || 'Unknown')
      .join(', ');
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Discount Groups</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Discount Group
        </button>
      </div>

      {error && !isModalOpen && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-blue-600">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Services</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Discount</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Cap</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Effective Date</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase border-b-2 border-blue-700">Expiry Date</th>
              <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase border-b-2 border-blue-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {discountGroups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No discount groups found. Click "Add Discount Group" to create one.
                </td>
              </tr>
            ) : (
              discountGroups.map((group) => {
                const isExpired = group.expiryDate ? new Date(group.expiryDate).getTime() < new Date().getTime() : false;
                return (
                <tr 
                  key={group.id}
                  className={isExpired ? 'bg-yellow-50' : 'bg-white'}
                  style={isExpired ? { backgroundColor: '#fefce8' } : {}}
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {group.name}
                    {isExpired && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-200">
                        Expired
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getServiceNames(group.serviceIds)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {group.discountType === 'percentage' 
                      ? `${group.discountValue}%` 
                      : `€${group.discountValue.toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {group.capValue} {group.capType} / {group.capPeriod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{group.effectiveDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{group.expiryDate || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleOpenEditModal(group)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(group)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingGroup ? 'Edit Discount Group' : 'Add Discount Group'}
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Seniors, Students"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable Services *
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {services.length === 0 ? (
                    <p className="text-gray-500 text-sm">No services available</p>
                  ) : (
                    services.map((service) => (
                      <label key={service.id} className="flex items-center mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.serviceIds.includes(service.id)}
                          onChange={() => handleServiceToggle(service.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{service.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value * {formData.discountType === 'percentage' ? '(%)' : '(€)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={formData.discountType === 'percentage' ? '15' : '5.00'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cap Type *
                  </label>
                  <select
                    value={formData.capType}
                    onChange={(e) => setFormData({ ...formData, capType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="km">KM</option>
                    <option value="trips">Trips</option>
                    <option value="amount">Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cap Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.capValue}
                    onChange={(e) => setFormData({ ...formData, capValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cap Period *
                  </label>
                  <select
                    value={formData.capPeriod}
                    onChange={(e) => setFormData({ ...formData, capPeriod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDiscountGroupManager;
