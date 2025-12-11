            {/* Removed invalid inline console.log from JSX render */}
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, update, remove, set, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import { FXDiscountOption } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

const FXDiscountOptionManager: React.FC = () => {
  const [options, setOptions] = useState<FXDiscountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<FXDiscountOption | null>(null);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [fxSegments, setFxSegments] = useState<string[]>([]);
  const { currentUser } = useAuth();

  const [newOption, setNewOption] = useState({
    name: '',
    description: '',
    serviceItem: '',
    fxSegment: '',
    discountType: 'Cashback' as 'Cashback' | 'Discount' | 'Bonus Points' | 'Fee Waiver',
    discountAmountType: 'value' as 'value' | 'percentage' | 'pips',
    discountAmount: 0,
    maxCapType: '',
    currency: '',
    capPeriodStart: '',
    capPeriodEnd: '',
    startDate: getTodayString(),
    endDate: '',
  });

  // Helper function to get today's date in YYYY-MM-DD format
  function getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Generate unique group number: FXDG-YYYYMMDD-XXXX
  const generateOptionNumber = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    return `FXDG-${dateStr}-${randomSuffix}`;
  };

  // Fetch currencies from reference data
  useEffect(() => {
    const currenciesRef = ref(db, 'referenceCurrencies');
    const unsubscribe = onValue(currenciesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => ({
          code: data[key].code,
          name: data[key].name,
        }));
        setCurrencies(list.sort((a, b) => (a.code || '').localeCompare(b.code || '')));
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch FX Segments from reference data
  useEffect(() => {
    const segmentsRef = ref(db, 'referenceFXSegments');
    const unsubscribe = onValue(segmentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => data[key].name || '');
        setFxSegments(list.sort((a, b) => (a || '').localeCompare(b || '')));
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const optionsRef = ref(db, 'fxDiscountOptions');
      onValue(optionsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list: FXDiscountOption[] = Object.keys(data).map((key) => {
            const record = { id: key, ...data[key] };
            // Ensure currency is always present, even if undefined
            if (!('currency' in record)) {
              record.currency = '';
            }
            return record;
          });

          // Sort by end date (most recent first)
          list.sort((a, b) => {
            const aEndDate = a.endDate ? new Date(a.endDate).getTime() : 0;
            const bEndDate = b.endDate ? new Date(b.endDate).getTime() : 0;
            return bEndDate - aEndDate;
          });
          setOptions(list);
        } else {
          setOptions([]);
        }
      });
    } catch (error) {
      console.error('Error fetching FX discount groups:', error);
      alert('Could not fetch FX discount groups. See console for details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleOpenModalForAdd = () => {
    setEditingOption(null);
    setNewOption({
      name: '',
      description: '',
      serviceItem: '',
      fxSegment: '',
      discountType: 'Cashback',
      discountAmountType: 'value',
      discountAmount: 0,
      maxCapType: '',
      currency: '',
      capPeriodStart: '',
      capPeriodEnd: '',
      startDate: getTodayString(),
      endDate: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (option: FXDiscountOption) => {
    setEditingOption(option);
    setNewOption({
      name: option.name,
      description: option.description,
      serviceItem: option.serviceItem,
      fxSegment: option.fxSegment,
      discountType: option.discountType,
      discountAmountType: option.discountAmountType,
      discountAmount: option.discountAmount,
      maxCapType: option.maxCapType,
      currency: option.currency,
      capPeriodStart: option.capPeriodStart,
      capPeriodEnd: option.capPeriodEnd,
      startDate: option.startDate,
      endDate: option.endDate,
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log('handleInputChange:', name, value);
    if (name === 'discountAmount') {
      setNewOption((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setNewOption((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Specific handler for currency dropdown to guarantee update
  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    console.log('handleCurrencyChange:', value);
    setNewOption((prev) => ({ ...prev, currency: value }));
  };

  const calculateChanges = (oldData: FXDiscountOption, newData: any) => {
    const changes = [];
    const fieldsToCompare = [
      'name', 'description', 'serviceItem', 'fxSegment', 'discountType',
      'discountAmountType', 'discountAmount', 'maxCapType', 'currency',
      'capPeriodStart', 'capPeriodEnd', 'startDate', 'endDate'
    ];
    
    for (const field of fieldsToCompare) {
      if (oldData[field as keyof FXDiscountOption] !== newData[field]) {
        changes.push({
          field,
          oldValue: oldData[field as keyof FXDiscountOption],
          newValue: newData[field],
        });
      }
    }
    return changes;
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newOption.currency) {
      alert('Please select a currency for this FX Discount Group.');
      return;
    }

    console.log('DEBUG newOption at save:', newOption);
    const optionData = {
      ...newOption,
      currency: newOption.currency || '', // Always include currency explicitly
      optionNumber: editingOption?.optionNumber || generateOptionNumber(),
      lastModifiedBy: currentUser?.email || 'system',
      lastModifiedAt: serverTimestamp(),
    };
    // Forced log: show all keys and values in optionData
    console.log('FORCE LOG: optionData keys:', Object.keys(optionData));
    for (const k of Object.keys(optionData)) {
      console.log('FORCE LOG: optionData[' + k + ']:', optionData[k]);
    }

    try {
      if (editingOption) {
        const optionRef = ref(db, `fxDiscountOptions/${editingOption.id}`);
        console.log('UPDATE: Writing to path:', `fxDiscountOptions/${editingOption.id}`);
        console.log('UPDATE: Payload:', optionData);
        await update(optionRef, optionData);
        // Immediately read back the record after update
        const snapshot = await (await import('firebase/database')).get(optionRef);
        console.log('FORCE LOG: Record after update:', snapshot.exists() ? snapshot.val() : 'No record');

        // Log audit for update
        if (currentUser) {
          const changes = calculateChanges(editingOption, optionData);
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'update',
            entityType: 'fxdiscountoption',
            entityId: editingOption.id,
            entityName: optionData.name,
            changes,
          });
        }
      } else {
        const optionsListRef = ref(db, 'fxDiscountOptions');
        const newOptionRef = push(optionsListRef);
        console.log('CREATE: Writing to path:', `fxDiscountOptions/${newOptionRef.key}`);
        console.log('CREATE: Payload:', optionData);
        await set(newOptionRef, optionData);
        // Immediately read back the record after create
        const snapshot = await (await import('firebase/database')).get(newOptionRef);
        console.log('FORCE LOG: Record after create:', snapshot.exists() ? snapshot.val() : 'No record');

        // Log audit for create
        if (currentUser) {
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'create',
            entityType: 'fxdiscountoption',
            entityId: newOptionRef.key || '',
            entityName: optionData.name,
          });
        }
      }

      setIsModalOpen(false);
      fetchOptions();
    } catch (error) {
      console.error('Error saving FX discount group:', error);
      alert('Could not save FX discount group. See console for details.');
    }
  };

  const handleDeleteOption = async (option: FXDiscountOption) => {
    if (!window.confirm(`Are you sure you want to delete "${option.name}"?`)) {
      return;
    }

    try {
      const optionRef = ref(db, `fxDiscountOptions/${option.id}`);
      await remove(optionRef);

      // Log audit for delete
      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'delete',
          entityType: 'fxdiscountoption',
          entityId: option.id,
          entityName: option.name,
        });
      }

      fetchOptions();
    } catch (error) {
      console.error('Error deleting FX discount group:', error);
      alert('Could not delete FX discount group. See console for details.');
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center">Loading FX discount groups...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">FX Discount Groups</h1>
        <button
          onClick={handleOpenModalForAdd}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition"
        >
          Add New Group
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)] overflow-y-auto">
          <table className="min-w-full">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Group Number</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Service Item</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">FX Segment</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Offer Period</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {options.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No FX discount groups found. Click "Add New Group" to create one.
                  </td>
                </tr>
              ) : (
                options.map((option) => {
                  const isExpired = option.endDate ? new Date(option.endDate).getTime() < new Date().getTime() : false;
                  return (
                    <tr 
                      key={option.id} 
                      className={isExpired ? 'bg-yellow-50' : 'bg-white'}
                      style={isExpired ? { backgroundColor: '#fefce8' } : {}}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-mono text-sm ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {option.optionNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {option.name}
                          {isExpired && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 border border-yellow-200">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-sm`}>{option.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${isExpired ? 'text-yellow-600' : 'text-gray-700'}`}>{option.serviceItem}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${isExpired ? 'text-yellow-600' : 'text-gray-700'}`}>{option.fxSegment}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-medium ${isExpired ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {option.discountType}
                        </div>
                        <div className={`${isExpired ? 'text-yellow-500' : 'text-gray-500'} text-xs`}>
                          {option.discountAmount.toFixed(3)} {option.discountAmountType}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isExpired ? 'text-yellow-600' : 'text-gray-500'}`}>
                        <div>{option.startDate ? new Date(option.startDate).toLocaleDateString() : 'N/A'} -</div>
                        <div>{option.endDate ? new Date(option.endDate).toLocaleDateString() : 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {new Date(option.lastModifiedAt).toLocaleString()}
                        <div className="text-xs text-gray-400">by {option.lastModifiedBy}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                        <button
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                          onClick={() => handleOpenModalForEdit(option)}
                        >Edit</button>
                        <button
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={() => handleDeleteOption(option)}
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
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {editingOption ? 'Edit FX Discount Group' : 'Add New FX Discount Group'}
            </h2>
            {/* Debug log removed: console.log('RENDER: newOption.currency =', newOption.currency) */}
            <form onSubmit={handleSaveOption}>
              <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Group Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={newOption.name}
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
                    value={newOption.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="serviceItem" className="block text-sm font-medium text-gray-700">
                    Service Item
                  </label>
                  <input
                    type="text"
                    name="serviceItem"
                    id="serviceItem"
                    value={newOption.serviceItem}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="fxSegment" className="block text-sm font-medium text-gray-700">
                    FX Segment
                  </label>
                  <select
                    name="fxSegment"
                    id="fxSegment"
                    value={newOption.fxSegment}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select FX Segment</option>
                    {fxSegments.map((segment) => (
                      <option key={segment} value={segment}>
                        {segment}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">
                    Discount Type
                  </label>
                  <select
                    name="discountType"
                    id="discountType"
                    value={newOption.discountType}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="Cashback">Cashback</option>
                    <option value="Discount">Discount</option>
                    <option value="Bonus Points">Bonus Points</option>
                    <option value="Fee Waiver">Fee Waiver</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="discountAmountType" className="block text-sm font-medium text-gray-700">
                    Discount Amount Type
                  </label>
                  <select
                    name="discountAmountType"
                    id="discountAmountType"
                    value={newOption.discountAmountType}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="value">Value</option>
                    <option value="percentage">Percentage</option>
                    <option value="pips">PIPs</option>
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
                    value={newOption.discountAmount}
                    onChange={handleInputChange}
                    step="0.001"
                    min="0"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="maxCapType" className="block text-sm font-medium text-gray-700">
                    Maximum Cap Type
                  </label>
                  <input
                    type="text"
                    name="maxCapType"
                    id="maxCapType"
                    value={newOption.maxCapType}
                    onChange={handleInputChange}
                    placeholder="e.g., Total Value Converted"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    Currency
                  </label>
                  <select
                    name="currency"
                    id="currency"
                    value={newOption.currency}
                    onChange={handleCurrencyChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select Currency</option>
                    {currencies.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} - {curr.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="capPeriodStart" className="block text-sm font-medium text-gray-700">
                    Cap Period Start
                  </label>
                  <input
                    type="date"
                    name="capPeriodStart"
                    id="capPeriodStart"
                    value={newOption.capPeriodStart}
                    onChange={handleInputChange}
                    min={getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="capPeriodEnd" className="block text-sm font-medium text-gray-700">
                    Cap Period End
                  </label>
                  <input
                    type="date"
                    name="capPeriodEnd"
                    id="capPeriodEnd"
                    value={newOption.capPeriodEnd}
                    onChange={handleInputChange}
                    min={newOption.capPeriodStart || getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Offer Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    id="startDate"
                    value={newOption.startDate}
                    onChange={handleInputChange}
                    min={getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    Offer End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    id="endDate"
                    value={newOption.endDate}
                    onChange={handleInputChange}
                    min={newOption.startDate || getTodayString()}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
                >
                  {editingOption ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FXDiscountOptionManager;
