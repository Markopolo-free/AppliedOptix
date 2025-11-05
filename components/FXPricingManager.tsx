import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, push, remove, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { FXPricing, FXPricingTier } from '../types';
import { ApprovalStatus } from '../enums';
import { logAudit, calculateChanges } from '../services/auditService';

interface ReferenceData {
  id: string;
  name: string;
}

const FXPricingManager: React.FC = () => {
  const [fxPricings, setFxPricings] = useState<FXPricing[]>([]);
  const [countries, setCountries] = useState<ReferenceData[]>([]);
  const [currencies, setCurrencies] = useState<ReferenceData[]>([]);
  const [segments, setSegments] = useState<ReferenceData[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPricing, setEditingPricing] = useState<FXPricing | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    referenceNumber: '',
    entity: '',
    country: '',
    baseCurrency: '',
    quoteCurrency: '',
    activeFromDate: '',
    activeToDate: '',
    segment: '',
    channel: 'Branch' as 'Branch' | 'Mobile' | 'Web',
    loyaltyStatus: 'None' as 'High' | 'Medium' | 'Low' | 'None',
  });
  const [tiers, setTiers] = useState<FXPricingTier[]>([
    { minValue: 0, maxValue: 1000, marginPercentage: 2.5 }
  ]);

  const { currentUser, isAdmin } = useAuth();
  const database = getDatabase();

  // Load FX Pricings
  useEffect(() => {
    const fxRef = ref(database, 'fxPricings');
    const unsubscribe = onValue(fxRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fxArray: FXPricing[] = Object.entries(data).map(([id, fx]: [string, any]) => ({
          id,
          ...fx
        }));
        fxArray.sort((a, b) => b.lastModifiedAt.localeCompare(a.lastModifiedAt));
        setFxPricings(fxArray);
      } else {
        setFxPricings([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load Countries from reference data
  useEffect(() => {
    const countriesRef = ref(database, 'referenceCountries');
    const unsubscribe = onValue(countriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const countriesArray: ReferenceData[] = Object.entries(data).map(([id, country]: [string, any]) => ({
          id,
          name: country.name
        }));
        setCountries(countriesArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load Currencies from reference data
  useEffect(() => {
    const currenciesRef = ref(database, 'referenceCurrencies');
    const unsubscribe = onValue(currenciesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const currenciesArray: ReferenceData[] = Object.entries(data).map(([id, currency]: [string, any]) => ({
          id,
          name: currency.code || currency.name
        }));
        setCurrencies(currenciesArray);
      } else {
        // Default currencies if none exist
        setCurrencies([
          { id: '1', name: 'USD' },
          { id: '2', name: 'EUR' },
          { id: '3', name: 'GBP' },
          { id: '4', name: 'JPY' },
          { id: '5', name: 'CHF' },
          { id: '6', name: 'AUD' },
          { id: '7', name: 'CAD' },
        ]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load FX Segments from reference data
  useEffect(() => {
    const segmentsRef = ref(database, 'referenceFXSegments');
    const unsubscribe = onValue(segmentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const segmentsArray: ReferenceData[] = Object.entries(data).map(([id, segment]: [string, any]) => ({
          id,
          name: segment.name
        }));
        setSegments(segmentsArray);
      } else {
        // Default segments if none exist
        setSegments([
          { id: '1', name: 'Retail' },
          { id: '2', name: 'Corporate' },
          { id: '3', name: 'Premium' },
        ]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTierChange = (index: number, field: keyof FXPricingTier, value: string) => {
    const newTiers = [...tiers];
    newTiers[index] = {
      ...newTiers[index],
      [field]: parseFloat(value) || 0
    };
    setTiers(newTiers);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      { minValue: lastTier.maxValue, maxValue: lastTier.maxValue + 1000, marginPercentage: 2.5 }
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  };

  const flipCurrencyPair = () => {
    setFormData(prev => ({
      ...prev,
      baseCurrency: prev.quoteCurrency,
      quoteCurrency: prev.baseCurrency
    }));
  };

  const generateReferenceNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `FX${timestamp}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      alert('You must be logged in');
      return;
    }

    // Validation
    if (formData.entity.length !== 6) {
      alert('Entity must be exactly 6 alphanumeric characters');
      return;
    }

    if (new Date(formData.activeToDate) < new Date(formData.activeFromDate)) {
      alert('Active To Date must be after Active From Date');
      return;
    }

    const pricingData: Omit<FXPricing, 'id'> = {
      referenceNumber: formData.referenceNumber || generateReferenceNumber(),
      entity: formData.entity.toUpperCase(),
      country: formData.country,
      baseCurrency: formData.baseCurrency,
      quoteCurrency: formData.quoteCurrency,
      tiers: tiers,
      activeFromDate: formData.activeFromDate,
      activeToDate: formData.activeToDate,
      segment: formData.segment,
      channel: formData.channel,
      loyaltyStatus: formData.loyaltyStatus,
      status: ApprovalStatus.Pending,
      makerName: currentUser.name,
      makerEmail: currentUser.email,
      makerTimestamp: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      if (editingPricing) {
        // Update existing
        const fxRef = ref(database, `fxPricings/${editingPricing.id}`);
        await update(fxRef, pricingData);

        // Log audit
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'fxpricing',
          entityId: editingPricing.id,
          entityName: pricingData.referenceNumber,
          changes: calculateChanges(editingPricing, pricingData),
        });

        setEditingPricing(null);
      } else {
        // Create new
        const fxRef = ref(database, 'fxPricings');
        const newFxRef = await push(fxRef, pricingData);

        // Log audit
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'create',
          entityType: 'fxpricing',
          entityId: newFxRef.key || '',
          entityName: pricingData.referenceNumber,
        });
      }

      // Reset form
      setFormData({
        referenceNumber: '',
        entity: '',
        country: '',
        baseCurrency: '',
        quoteCurrency: '',
        activeFromDate: '',
        activeToDate: '',
        segment: '',
        channel: 'Branch',
        loyaltyStatus: 'None',
      });
      setTiers([{ minValue: 0, maxValue: 1000, marginPercentage: 2.5 }]);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving FX pricing:', error);
      alert('Failed to save FX pricing');
    }
  };

  const handleEdit = (pricing: FXPricing) => {
    setEditingPricing(pricing);
    setFormData({
      referenceNumber: pricing.referenceNumber,
      entity: pricing.entity,
      country: pricing.country,
      baseCurrency: pricing.baseCurrency,
      quoteCurrency: pricing.quoteCurrency,
      activeFromDate: pricing.activeFromDate,
      activeToDate: pricing.activeToDate,
      segment: pricing.segment,
      channel: pricing.channel,
      loyaltyStatus: pricing.loyaltyStatus,
    });
    setTiers(pricing.tiers);
    setShowAddForm(true);
  };

  const handleDelete = async (pricingId: string) => {
    if (!window.confirm('Are you sure you want to delete this FX pricing?')) return;

    const pricingToDelete = fxPricings.find(p => p.id === pricingId);
    if (!pricingToDelete || !currentUser) return;

    try {
      const fxRef = ref(database, `fxPricings/${pricingId}`);
      await remove(fxRef);

      // Log audit
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'delete',
        entityType: 'fxpricing',
        entityId: pricingId,
        entityName: pricingToDelete.referenceNumber,
      });
    } catch (error) {
      console.error('Error deleting FX pricing:', error);
      alert('Failed to delete FX pricing');
    }
  };

  const handleApprove = async (pricingId: string) => {
    if (!isAdmin || !currentUser) return;

    const pricing = fxPricings.find(p => p.id === pricingId);
    if (!pricing) return;

    try {
      const fxRef = ref(database, `fxPricings/${pricingId}`);
      await update(fxRef, {
        status: ApprovalStatus.Approved,
        checkerName: currentUser.name,
        checkerEmail: currentUser.email,
        checkerTimestamp: new Date().toISOString(),
      });

      // Log audit
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'approve',
        entityType: 'fxpricing',
        entityId: pricingId,
        entityName: pricing.referenceNumber,
      });
    } catch (error) {
      console.error('Error approving FX pricing:', error);
      alert('Failed to approve FX pricing');
    }
  };

  const handleReject = async (pricingId: string) => {
    if (!isAdmin || !currentUser) return;

    const pricing = fxPricings.find(p => p.id === pricingId);
    if (!pricing) return;

    try {
      const fxRef = ref(database, `fxPricings/${pricingId}`);
      await update(fxRef, {
        status: ApprovalStatus.Rejected,
        checkerName: currentUser.name,
        checkerEmail: currentUser.email,
        checkerTimestamp: new Date().toISOString(),
      });

      // Log audit
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'reject',
        entityType: 'fxpricing',
        entityId: pricingId,
        entityName: pricing.referenceNumber,
      });
    } catch (error) {
      console.error('Error rejecting FX pricing:', error);
      alert('Failed to reject FX pricing');
    }
  };

  const filteredPricings = fxPricings.filter(pricing => {
    const matchesSearch = 
      pricing.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pricing.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pricing.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${pricing.baseCurrency}/${pricing.quoteCurrency}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || pricing.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ApprovalStatus) => {
    const styles = {
      [ApprovalStatus.Pending]: 'bg-yellow-100 text-yellow-800',
      [ApprovalStatus.Approved]: 'bg-green-100 text-green-800',
      [ApprovalStatus.Rejected]: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>{status}</span>;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">💱 FX Pricing Management</h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingPricing(null);
            setFormData({
              referenceNumber: '',
              entity: '',
              country: '',
              baseCurrency: '',
              quoteCurrency: '',
              activeFromDate: '',
              activeToDate: '',
              segment: '',
              channel: 'Branch',
              loyaltyStatus: 'None',
            });
            setTiers([{ minValue: 0, maxValue: 1000, marginPercentage: 2.5 }]);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add FX Pricing'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search by reference, entity, country, or currency pair..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">All Statuses</option>
          <option value={ApprovalStatus.Pending}>Pending</option>
          <option value={ApprovalStatus.Approved}>Approved</option>
          <option value={ApprovalStatus.Rejected}>Rejected</option>
        </select>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingPricing ? 'Edit FX Pricing' : 'Add New FX Pricing'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium mb-1">Reference Number</label>
                <input
                  type="text"
                  name="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={handleInputChange}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              {/* Entity */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Entity (6 chars) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="entity"
                  value={formData.entity}
                  onChange={handleInputChange}
                  maxLength={6}
                  required
                  placeholder="e.g., BU001A"
                  className="w-full px-3 py-2 border rounded uppercase"
                />
                <span className="text-xs text-gray-500">{formData.entity.length}/6 characters</span>
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.name}>{country.name}</option>
                  ))}
                </select>
              </div>

              {/* Currency Pair with Flip Button */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Currency Pair <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    name="baseCurrency"
                    value={formData.baseCurrency}
                    onChange={handleInputChange}
                    required
                    className="flex-1 px-3 py-2 border rounded"
                  >
                    <option value="">Base</option>
                    {currencies.map(curr => (
                      <option key={curr.id} value={curr.name}>{curr.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={flipCurrencyPair}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                    title="Flip currency pair"
                  >
                    ⇄
                  </button>
                  <select
                    name="quoteCurrency"
                    value={formData.quoteCurrency}
                    onChange={handleInputChange}
                    required
                    className="flex-1 px-3 py-2 border rounded"
                  >
                    <option value="">Quote</option>
                    {currencies.map(curr => (
                      <option key={curr.id} value={curr.name}>{curr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Segment */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Segment <span className="text-red-500">*</span>
                </label>
                <select
                  name="segment"
                  value={formData.segment}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Segment</option>
                  {segments.map(seg => (
                    <option key={seg.id} value={seg.name}>{seg.name}</option>
                  ))}
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Channel <span className="text-red-500">*</span>
                </label>
                <select
                  name="channel"
                  value={formData.channel}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="Branch">Branch</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Web">Web</option>
                </select>
              </div>

              {/* Loyalty Status */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Loyalty Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="loyaltyStatus"
                  value={formData.loyaltyStatus}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="None">None</option>
                </select>
              </div>

              {/* Active From Date */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Active From Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="activeFromDate"
                  value={formData.activeFromDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              {/* Active To Date */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Active To Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="activeToDate"
                  value={formData.activeToDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>

            {/* Pricing Tiers */}
            {/* Reference Number Display */}
            <div className="mt-6">
              <div className="mb-3">
                <span className="block text-xs text-gray-600 font-mono">Reference Number: <span className="font-bold text-blue-700">{formData.referenceNumber || '(auto-generated on save)'}</span></span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">
                  Pricing Tiers <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addTier}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  + Add Tier
                </button>
              </div>
              
              <div className="space-y-2">
                {tiers.map((tier, index) => {
                  const currencyPair = `${formData.baseCurrency}${formData.quoteCurrency}`;
                  const subRef = `${formData.referenceNumber || '(auto-ref)'}-${currencyPair}-T${index+1}`;
                  return (
                    <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded">
                      <div className="flex flex-col flex-1">
                        <label className="text-xs text-gray-600">Min Value</label>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.minValue}
                          onChange={(e) => handleTierChange(index, 'minValue', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <label className="text-xs text-gray-600">Max Value</label>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.maxValue}
                          onChange={(e) => handleTierChange(index, 'maxValue', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <label className="text-xs text-gray-600">Margin %</label>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.marginPercentage}
                          onChange={(e) => handleTierChange(index, 'marginPercentage', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-xs font-mono text-blue-700">Ref: {subRef}</span>
                      </div>
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTier(index)}
                          className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 mt-5"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Add multiple tiers to avoid creating separate records for each tier
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingPricing ? 'Update' : 'Create'} FX Pricing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingPricing(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FX Pricings Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Reference</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Entity</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Country</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Currency Pair</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Tiers</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Segment</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Channel</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Active Period</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPricings.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No FX pricings found. Click "Add FX Pricing" to create one.
                </td>
              </tr>
            ) : (
              filteredPricings.map((pricing) => (
                <tr key={pricing.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{pricing.referenceNumber}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{pricing.entity}</td>
                  <td className="px-4 py-3 text-sm">{pricing.country}</td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {pricing.baseCurrency} → {pricing.quoteCurrency}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <details className="cursor-pointer">
                      <summary className="text-blue-600 hover:underline">
                        {pricing.tiers.length} tier{pricing.tiers.length !== 1 ? 's' : ''}
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {pricing.tiers.map((tier, idx) => {
                          // Generate sub-reference number: referenceNumber-baseCurrency+quoteCurrency-T{idx+1}
                          const currencyPair = `${pricing.baseCurrency}${pricing.quoteCurrency}`;
                          const subRef = `${pricing.referenceNumber}-${currencyPair}-T${idx+1}`;
                          return (
                            <div key={idx} className="bg-gray-50 p-2 rounded">
                              <div className="font-mono text-xs text-gray-700 mb-1">Ref: {subRef}</div>
                              {tier.minValue.toLocaleString()} - {tier.maxValue.toLocaleString()}: {tier.marginPercentage}%
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </td>
                  <td className="px-4 py-3 text-sm">{pricing.segment}</td>
                  <td className="px-4 py-3 text-sm">{pricing.channel}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-xs">
                      <div>{new Date(pricing.activeFromDate).toLocaleDateString()}</div>
                      <div className="text-gray-500">to {new Date(pricing.activeToDate).toLocaleDateString()}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(pricing.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(pricing)}
                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(pricing.id)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                      {isAdmin && pricing.status === ApprovalStatus.Pending && (
                        <>
                          <button
                            onClick={() => handleApprove(pricing.id)}
                            className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(pricing.id)}
                            className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold">{fxPricings.length}</div>
          <div className="text-sm text-gray-600">Total FX Pricings</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-700">
            {fxPricings.filter(p => p.status === ApprovalStatus.Pending).length}
          </div>
          <div className="text-sm text-gray-600">Pending Approval</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-700">
            {fxPricings.filter(p => p.status === ApprovalStatus.Approved).length}
          </div>
          <div className="text-sm text-gray-600">Approved</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-700">
            {fxPricings.filter(p => p.status === ApprovalStatus.Rejected).length}
          </div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Multi-Tier Pricing Solution</h4>
        <p className="text-sm text-blue-800">
          This module allows you to add multiple pricing tiers within a single FX pricing record, 
          eliminating the need to create separate records for each tier. Simply click "Add Tier" 
          to define additional margin bands for different transaction value ranges.
        </p>
      </div>
    </div>
  );
};

export default FXPricingManager;
