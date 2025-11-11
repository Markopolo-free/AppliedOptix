import React, { useState, useEffect, useRef } from 'react';
import { getDatabase, ref, onValue, push, remove, update, query, orderByChild, equalTo } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';

interface ReferenceItem {
  id: string;
  name: string;
  code?: string; // For currencies
  population?: number; // For cities/countries
  providers?: { name: string; model?: string }[]; // For service types
  dateAdded: string;
  addedBy: string;
}

type CategoryType = 'countries' | 'currencies' | 'fxSegments' | 'cities' | 'serviceTypes' | 'zoneTypes' | 'zones';

const ReferenceDataManager: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('countries');
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  // Inline edit state for service types
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowName, setEditingRowName] = useState<string>('');
  const [bulkImportText, setBulkImportText] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    population: ''
  });
  const [providersForm, setProvidersForm] = useState<{ name: string; model: string }[]>([]);
  // Inline City management under Countries
  type CityItem = { id: string; name: string; population?: number; country?: string; dateAdded?: string; addedBy?: string };
  const [expandedCountry, setExpandedCountry] = useState<{ id: string; name: string } | null>(null);
  const [countryCities, setCountryCities] = useState<Record<string, CityItem[]>>({});
  const [cityAddForm, setCityAddForm] = useState<{ name: string; population: string }>({ name: '', population: '' });
  const cityUnsubRef = useRef<(() => void) | null>(null);
  const [cityEdit, setCityEdit] = useState<{ id: string; name: string; population: string } | null>(null);
  const { currentUser, isAdmin } = useAuth();
  const database = getDatabase();

  const categoryConfig = {
    countries: {
      label: 'Countries',
      singular: 'Country',
      icon: '🌍',
      dbPath: 'referenceCountries',
      fields: ['name', 'population'],
      bulkHelp: 'Enter one country per line. Format: CountryName or CountryName,Population'
    },
    currencies: {
      label: 'Currencies',
      singular: 'Currency',
      icon: '💱',
      dbPath: 'referenceCurrencies',
      fields: ['code', 'name'],
      bulkHelp: 'Enter one currency per line. Format: CODE,Name (e.g., USD,US Dollar)'
    },
    fxSegments: {
      label: 'FX Segments',
      singular: 'FX Segment',
      icon: '📊',
      dbPath: 'referenceFXSegments',
      fields: ['name'],
      bulkHelp: 'Enter one segment per line (e.g., Retail, Corporate, Premium)'
    },
    serviceTypes: {
      label: 'Service Types',
      singular: 'Service Type',
      icon: '🔧',
      dbPath: 'referenceServiceTypes',
      fields: ['name'],
      bulkHelp: 'Enter one service type per line. Optional providers: Name|Model; Name2|Model2 (e.g., eScooter, Bolt|B2; Tuul|T100)'
    },
    zoneTypes: {
      label: 'Zone Types',
      singular: 'Zone Type',
      icon: '📍',
      dbPath: 'referenceZoneTypes',
      fields: ['name'],
      bulkHelp: 'Enter one zone type per line (e.g., Urban, Suburban, Airport)'
    },
    zones: {
      label: 'Zones',
      singular: 'Zone',
      icon: '🗺️',
      dbPath: 'referenceZones',
      fields: ['name', 'location', 'type'],
      bulkHelp: 'Enter one zone per line. Format: Name,Location,Type (e.g., Downtown,Berlin Center,Urban)'
    }
  };

  const currentConfig = categoryConfig[activeCategory];

  // Load items when category changes
  useEffect(() => {
    const itemsRef = ref(database, currentConfig.dbPath);
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const itemsArray: ReferenceItem[] = Object.entries(data).map(([id, item]: [string, any]) => ({
          id,
          ...item
        }));
        
        // Sort by name, code, or population
        if (activeCategory === 'countries') {
          itemsArray.sort((a, b) => a.name.localeCompare(b.name));
        } else if (activeCategory === 'currencies') {
          itemsArray.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        } else {
          itemsArray.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        setItems(itemsArray);
      } else {
        setItems([]);
      }
    });

    return () => unsubscribe();
  }, [activeCategory, database, currentConfig.dbPath]);

  // Cleanup any city subscriptions on unmount
  useEffect(() => {
    return () => {
      if (cityUnsubRef.current) {
        cityUnsubRef.current();
        cityUnsubRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      alert('You must be logged in');
      return;
    }

    const itemData: any = {
      dateAdded: new Date().toISOString(),
      addedBy: currentUser.name || currentUser.email
    };

    // Add fields based on category
    if (currentConfig.fields.includes('name')) itemData.name = formData.name;
    if (currentConfig.fields.includes('code')) itemData.code = formData.code.toUpperCase();
    if (currentConfig.fields.includes('population')) itemData.population = parseInt(formData.population) || 0;
    if (activeCategory === 'serviceTypes') {
      const cleanProviders = providersForm
        .map(p => ({ name: p.name.trim(), model: p.model.trim() }))
        .filter(p => p.name.length > 0);
      itemData.providers = cleanProviders;
    }

    try {
      if (editingItem) {
        // Update existing item
        const itemRef = ref(database, `${currentConfig.dbPath}/${editingItem.id}`);
        await update(itemRef, itemData);

        // Log audit for update
        const oldData: any = {};
        const newData: any = {};
        currentConfig.fields.forEach(field => {
          oldData[field] = (editingItem as any)[field];
          newData[field] = itemData[field];
        });
        if (activeCategory === 'serviceTypes') {
          oldData.providers = (editingItem as any).providers || [];
          newData.providers = itemData.providers || [];
        }

        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: editingItem.id,
          entityName: itemData.name || itemData.code,
          changes: calculateChanges(oldData, newData),
        });

        setEditingItem(null);
      } else {
        // Add new item
        
        // For currencies, check if code already exists
        if (activeCategory === 'currencies' && itemData.code) {
          const existingCurrency = items.find(
            (item: any) => item.code && item.code.toUpperCase() === itemData.code.toUpperCase()
          );
          if (existingCurrency) {
            alert(`Currency code "${itemData.code}" already exists. Please use a different code.`);
            return;
          }
        }
        
        const itemsRef = ref(database, currentConfig.dbPath);
        const newItemRef = await push(itemsRef, itemData);

        // Log audit for create
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'create',
          entityType: 'reference',
          entityId: newItemRef.key || '',
          entityName: itemData.name || itemData.code,
        });
      }

  setFormData({ name: '', code: '', population: '' });
  setProvidersForm([]);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  const handleBulkImport = async () => {
    if (!currentUser || !bulkImportText.trim()) {
      alert('Please enter data to import');
      return;
    }

    const lines = bulkImportText.trim().split('\n').filter(line => line.trim());
    let successCount = 0;
    let errorCount = 0;
    const importedCodes = new Set<string>(); // Track codes added in this batch

    try {
      const itemsRef = ref(database, currentConfig.dbPath);

      for (const line of lines) {
        try {
          const parts = line.split(',').map(p => p.trim());
          const itemData: any = {
            dateAdded: new Date().toISOString(),
            addedBy: currentUser.name || currentUser.email
          };

          if (activeCategory === 'countries') {
            itemData.name = parts[0];
            itemData.population = parts[1] ? parseInt(parts[1]) : 0;
          } else if (activeCategory === 'currencies') {
            itemData.code = parts[0].toUpperCase();
            itemData.name = parts[1] || parts[0];
            
            // Check if code already exists in database or in current batch
            const existingCurrency = items.find(
              (item: any) => item.code && item.code.toUpperCase() === itemData.code
            );
            if (existingCurrency || importedCodes.has(itemData.code)) {
              console.warn(`Skipping duplicate currency code: ${itemData.code}`);
              errorCount++;
              continue;
            }
            importedCodes.add(itemData.code);
          } else if (activeCategory === 'fxSegments') {
            itemData.name = parts[0];
          } else if (activeCategory === 'serviceTypes') {
            itemData.name = parts[0];
            if (parts[1]) {
              const providersRaw = parts.slice(1).join(',');
              const entries = providersRaw.split(';').map(s => s.trim()).filter(Boolean);
              const providers = entries.map(entry => {
                const [provName, model] = entry.split('|').map(x => (x || '').trim());
                return { name: provName, model };
              }).filter(p => p.name);
              if (providers.length > 0) {
                itemData.providers = providers;
              }
            }
          }

          await push(itemsRef, itemData);
          successCount++;
        } catch (err) {
          console.error('Error importing line:', line, err);
          errorCount++;
        }
      }

      // Log audit for bulk import
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'initialize',
        entityType: 'reference',
        entityName: `${currentConfig.label} Bulk Import`,
        metadata: { successCount, errorCount, totalLines: lines.length },
      });

      alert(`Import complete!\n✅ Success: ${successCount}\n❌ Errors: ${errorCount}`);
      setBulkImportText('');
      setShowBulkImport(false);
    } catch (error) {
      console.error('Error during bulk import:', error);
      alert('Failed to complete bulk import');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!isAdmin) {
      alert('Only administrators can delete items');
      return;
    }

    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const itemToDelete = items.find(i => i.id === itemId);
        const itemRef = ref(database, `${currentConfig.dbPath}/${itemId}`);
        await remove(itemRef);

        // Log audit for delete
        if (currentUser && itemToDelete) {
          await logAudit({
            userId: currentUser.email,
            userName: currentUser.name,
            userEmail: currentUser.email,
            action: 'delete',
            entityType: 'reference',
            entityId: itemId,
            entityName: itemToDelete.name || itemToDelete.code || '',
          });
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
      }
    }
  };

  const handleEdit = (item: ReferenceItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      population: item.population?.toString() || ''
    });
    if (activeCategory === 'serviceTypes') {
      setProvidersForm((item.providers || []).map(p => ({ name: p.name || '', model: p.model || '' })));
    }
    setShowAddForm(true);
  };

  const handleRename = (item: ReferenceItem) => {
    if (activeCategory === 'serviceTypes') {
      setEditingRowId(item.id);
      setEditingRowName(item.name || '');
    }
  };

  const handleInlineCancel = () => {
    setEditingRowId(null);
    setEditingRowName('');
  };

  const handleInlineSave = async () => {
    if (!currentUser || !editingRowId) return;
    const oldItem = items.find(i => i.id === editingRowId);
    try {
      const itemRef = ref(database, `${currentConfig.dbPath}/${editingRowId}`);
      const newData: any = {
        name: editingRowName,
        dateAdded: new Date().toISOString(),
        addedBy: currentUser.name || currentUser.email
      };
      await update(itemRef, newData);

      if (oldItem) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: editingRowId,
          entityName: editingRowName,
          changes: calculateChanges({ name: oldItem.name }, { name: editingRowName })
        });
      }
      setEditingRowId(null);
      setEditingRowName('');
    } catch (err) {
      console.error('Inline save failed:', err);
      alert('Failed to save changes');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setFormData({ name: '', code: '', population: '' });
  };

  const formatPopulation = (population?: number): string => {
    if (!population) return 'N/A';
    if (population >= 1000000) {
      return `${(population / 1000000).toFixed(2)}M`;
    }
    return population.toLocaleString();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const initializeDefaultData = async () => {
    if (!isAdmin) {
      alert('Only administrators can initialize default data');
      return;
    }

    const defaults: Record<CategoryType, any[]> = {
      countries: [
        { name: 'United States', population: 331900000 },
        { name: 'United Kingdom', population: 67220000 },
        { name: 'Germany', population: 83240000 },
        { name: 'France', population: 65270000 },
        { name: 'Japan', population: 125800000 },
        { name: 'Australia', population: 25690000 },
        { name: 'Canada', population: 38250000 },
        { name: 'Switzerland', population: 8670000 },
        { name: 'Singapore', population: 5850000 },
        { name: 'Hong Kong', population: 7500000 }
      ],
      currencies: [
        { code: 'USD', name: 'US Dollar' },
        { code: 'EUR', name: 'Euro' },
        { code: 'GBP', name: 'British Pound' },
        { code: 'JPY', name: 'Japanese Yen' },
        { code: 'CHF', name: 'Swiss Franc' },
        { code: 'AUD', name: 'Australian Dollar' },
        { code: 'CAD', name: 'Canadian Dollar' },
        { code: 'SGD', name: 'Singapore Dollar' },
        { code: 'HKD', name: 'Hong Kong Dollar' },
        { code: 'CNY', name: 'Chinese Yuan' }
      ],
      fxSegments: [
        { name: 'Retail' },
        { name: 'Corporate' },
        { name: 'Premium' },
        { name: 'Institutional' },
        { name: 'SME' }
      ],
      serviceTypes: [
        { name: 'eBike' },
        { name: 'eScooter' },
        { name: 'Car Sharing' },
        { name: 'Bike Sharing' },
        { name: 'Public Transport' },
        { name: 'Taxi' },
        { name: 'Ride Hailing' }
      ],
      zoneTypes: [
        { name: 'Urban' },
        { name: 'Suburban' },
        { name: 'Airport' },
        { name: 'City Center' },
        { name: 'Residential' },
        { name: 'Business District' },
        { name: 'Tourist Area' }
      ],
      zones: [
        { name: 'Berlin Downtown', location: 'Berlin Center', type: 'Urban' },
        { name: 'Berlin Airport', location: 'Berlin TXL', type: 'Airport' },
        { name: 'Munich Center', location: 'Munich City', type: 'City Center' },
        { name: 'Hamburg Port', location: 'Hamburg', type: 'Business District' },
        { name: 'Frankfurt Financial', location: 'Frankfurt', type: 'Business District' }
      ],
      cities: [
        { name: 'Berlin', population: 3850000 },
        { name: 'Hamburg', population: 1900000 },
        { name: 'Munich', population: 1600000 },
        { name: 'Cologne', population: 1100000 },
        { name: 'Frankfurt', population: 773000 }
      ]
    };

    try {
      const itemsRef = ref(database, currentConfig.dbPath);
      const defaultItems = defaults[activeCategory];

      for (const item of defaultItems) {
        await push(itemsRef, {
          ...item,
          dateAdded: new Date().toISOString(),
          addedBy: currentUser?.name || currentUser?.email || 'System'
        });
      }

      // Log audit for initialization
      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'initialize',
          entityType: 'reference',
          entityName: currentConfig.label,
          metadata: { itemCount: defaultItems.length },
        });
      }

      alert(`Default ${currentConfig.label.toLowerCase()} added successfully`);
    } catch (error) {
      console.error('Error initializing data:', error);
      alert('Failed to initialize data');
    }
  };

  return (
    <div className="p-6">
      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        {(Object.keys(categoryConfig) as CategoryType[]).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setShowAddForm(false);
              setShowBulkImport(false);
              setEditingItem(null);
            }}
            className={`px-4 py-2 font-medium transition-colors ${
              activeCategory === cat
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {categoryConfig[cat].icon} {categoryConfig[cat].label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          {currentConfig.icon} {currentConfig.label}
        </h2>
        <div className="flex gap-2">
          {items.length === 0 && isAdmin && (
            <button
              onClick={initializeDefaultData}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Initialize Defaults
            </button>
          )}
          <button
            onClick={() => {
              setShowBulkImport(!showBulkImport);
              setShowAddForm(false);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {showBulkImport ? 'Cancel Bulk Import' : '📋 Bulk Import'}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowBulkImport(false);
              if (showAddForm) handleCancel();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : `+ Add ${currentConfig.singular}`}
          </button>
        </div>
      </div>

      {/* Bulk Import Form */}
      {showBulkImport && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h3 className="text-lg font-semibold mb-2">📋 Bulk Import {currentConfig.label}</h3>
          <p className="text-sm text-gray-600 mb-4">{currentConfig.bulkHelp}</p>
          <textarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder={`Example:\n$${
              activeCategory === 'currencies'
                ? 'USD,US Dollar\nEUR,Euro\nGBP,British Pound'
                : activeCategory === 'fxSegments'
                ? 'Retail\nCorporate\nPremium'
                : activeCategory === 'serviceTypes'
                ? 'eScooter,Bolt|B2; Tuul|T100\neBike\nCar Sharing'
                : 'United States,331000000\nUnited Kingdom,67000000\nGermany,83000000'
            }`}
            className="w-full px-3 py-2 border rounded h-40 font-mono text-sm"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleBulkImport}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Import Data
            </button>
            <button
              onClick={() => {
                setShowBulkImport(false);
                setBulkImportText('');
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {editingItem ? `Edit ${currentConfig.singular}` : `Add New ${currentConfig.singular}`}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {currentConfig.fields.includes('code') && (
              <div>
                <label className="block text-sm font-medium mb-1">Currency Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded uppercase"
                  maxLength={3}
                  required
                  placeholder="e.g., USD"
                />
              </div>
            )}
            {currentConfig.fields.includes('name') && (
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
            )}
            {activeCategory === 'serviceTypes' && (
              <div>
                <label className="block text-sm font-medium mb-1">Providers (optional)</label>
                <div className="space-y-2">
                  {providersForm.map((p, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Provider Name (e.g., Bolt)"
                        value={p.name}
                        onChange={(e) => {
                          const next = [...providersForm];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setProvidersForm(next);
                        }}
                        className="flex-1 px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="Model (e.g., B2)"
                        value={p.model}
                        onChange={(e) => {
                          const next = [...providersForm];
                          next[idx] = { ...next[idx], model: e.target.value };
                          setProvidersForm(next);
                        }}
                        className="flex-1 px-3 py-2 border rounded"
                      />
                      <button type="button" onClick={() => setProvidersForm(providersForm.filter((_, i) => i !== idx))} className="px-2 py-2 text-red-600 hover:text-red-800">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setProvidersForm([...providersForm, { name: '', model: '' }])} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm">+ Add Provider</button>
                </div>
              </div>
            )}
            {currentConfig.fields.includes('population') && (
              <div>
                <label className="block text-sm font-medium mb-1">Population (optional)</label>
                <input
                  type="number"
                  value={formData.population}
                  onChange={(e) => setFormData({ ...formData, population: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingItem ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {currentConfig.fields.includes('code') && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              {currentConfig.fields.includes('population') && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Population
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Added By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No {currentConfig.label.toLowerCase()} found. Click "Initialize Defaults", "Bulk Import", or "Add" to get started.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <React.Fragment key={item.id}>
                <tr className="hover:bg-gray-50">
                  {currentConfig.fields.includes('code') && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{item.code}</div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activeCategory === 'serviceTypes' && editingRowId === item.id ? (
                      <input
                        type="text"
                        value={editingRowName}
                        onChange={(e) => setEditingRowName(e.target.value)}
                        className="px-2 py-1 border rounded w-56"
                        autoFocus
                      />
                    ) : (
                      <div className="text-sm text-gray-900">
                        <div className="font-medium flex items-center gap-3">
                          <span>{item.name}</span>
                          {activeCategory === 'countries' && (
                            <button
                              className="text-blue-600 hover:underline text-xs"
                              onClick={() => {
                                // toggle inline city list
                                if (expandedCountry?.id === item.id) {
                                  if (cityUnsubRef.current) { cityUnsubRef.current(); cityUnsubRef.current = null; }
                                  setExpandedCountry(null);
                                  return;
                                }
                                setExpandedCountry({ id: item.id, name: item.name });
                                // unsubscribe previous
                                if (cityUnsubRef.current) { cityUnsubRef.current(); cityUnsubRef.current = null; }
                                const qCountry = query(ref(database, 'referenceCities'), orderByChild('country'), equalTo(item.name));
                                const unsub = onValue(qCountry, (snapshot) => {
                                  const data = snapshot.val() || {};
                                  let list = Object.entries(data).map(([id, c]: [string, any]) => ({ id, ...(c as any) }));
                                  // Include legacy German cities without country
                                  if (item.name === 'Germany') {
                                    onValue(ref(database, 'referenceCities'), (snapAll) => {
                                      const all = snapAll.val() || {};
                                      const legacy = Object.entries(all).map(([id, c]: [string, any]) => ({ id, ...(c as any) })).filter((c) => !c.country);
                                      const merged: Record<string, any> = {};
                                      [...list, ...legacy].forEach((c) => { merged[c.id] = c; });
                                      list = Object.values(merged);
                                      list.sort((a: any, b: any) => (b.population || 0) - (a.population || 0));
                                      setCountryCities((prev) => ({ ...prev, [item.id]: list as any }));
                                    }, { onlyOnce: true });
                                  } else {
                                    list.sort((a: any, b: any) => (b.population || 0) - (a.population || 0));
                                    setCountryCities((prev) => ({ ...prev, [item.id]: list as any }));
                                  }
                                });
                                cityUnsubRef.current = unsub;
                              }}
                              title="View and manage cities"
                            >
                              City List
                            </button>
                          )}
                        </div>
                        {(item.providers || []).length > 0 && (
                          <div className="text-gray-600 flex flex-col mt-1 text-xs">
                            {
                              (item.providers || [])
                                .slice()
                                .sort((a, b) => {
                                  const nameCmp = (a.name || '').localeCompare(b.name || '');
                                  if (nameCmp !== 0) return nameCmp;
                                  return (a.model || '').localeCompare(b.model || '');
                                })
                                .map((p, idx) => (
                                  <div key={`${p.name}-${p.model}-${idx}`}>{`${p.name}${p.model ? ' ' + p.model : ''}`}</div>
                                ))
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {currentConfig.fields.includes('population') && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPopulation(item.population)}</div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatDate(item.dateAdded)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{item.addedBy}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {activeCategory === 'serviceTypes' && editingRowId === item.id ? (
                      <>
                        <button
                          onClick={handleInlineSave}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleInlineCancel}
                          className="text-gray-600 hover:text-gray-900 mr-4"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRename(item)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
                {activeCategory === 'countries' && expandedCountry?.id === item.id && (
                  <tr>
                    <td colSpan={6} className="px-6 pb-6">
                      <div className="mt-2 border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Cities in {expandedCountry.name}</h4>
                          <button
                            className="text-xs text-gray-600 hover:text-gray-900"
                            onClick={() => {
                              if (cityUnsubRef.current) { cityUnsubRef.current(); cityUnsubRef.current = null; }
                              setExpandedCountry(null);
                            }}
                          >
                            Close
                          </button>
                        </div>
                        <div className="mt-3 space-y-3">
                          {/* Quick Add City */}
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="block text-xs text-gray-600">City name</label>
                              <input
                                type="text"
                                value={cityAddForm.name}
                                onChange={(e) => setCityAddForm({ ...cityAddForm, name: e.target.value })}
                                className="px-2 py-1 border rounded"
                                placeholder="e.g., Munich"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600">Population</label>
                              <input
                                type="number"
                                value={cityAddForm.population}
                                onChange={(e) => setCityAddForm({ ...cityAddForm, population: e.target.value })}
                                className="px-2 py-1 border rounded w-28"
                                placeholder="0"
                              />
                            </div>
                            <button
                              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                              onClick={async () => {
                                if (!currentUser || !expandedCountry) return;
                                const name = cityAddForm.name.trim();
                                if (!name) return;
                                const pop = parseInt(cityAddForm.population || '0') || 0;
                                await push(ref(database, 'referenceCities'), {
                                  name,
                                  population: pop,
                                  country: expandedCountry.name,
                                  dateAdded: new Date().toISOString(),
                                  addedBy: currentUser.name || currentUser.email
                                });
                                await logAudit({
                                  userId: currentUser.email,
                                  userName: currentUser.name,
                                  userEmail: currentUser.email,
                                  action: 'create',
                                  entityType: 'reference',
                                  entityName: name,
                                  metadata: { country: expandedCountry.name, population: pop }
                                });
                                setCityAddForm({ name: '', population: '' });
                              }}
                            >
                              Add City
                            </button>
                          </div>

                          {/* City List */}
                          {((countryCities[item.id] || []).length === 0) ? (
                            <div className="text-sm text-gray-600">No cities found.</div>
                          ) : (
                            <ul className="space-y-1">
                              {(countryCities[item.id] || []).map((c) => (
                                <li key={c.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-3">
                                    {cityEdit?.id === c.id ? (
                                      <>
                                        <input
                                          className="px-2 py-1 border rounded"
                                          value={cityEdit.name}
                                          onChange={(e) => setCityEdit({ ...(cityEdit as any), name: e.target.value })}
                                        />
                                        <input
                                          type="number"
                                          className="px-2 py-1 border rounded w-24"
                                          value={cityEdit.population}
                                          onChange={(e) => setCityEdit({ ...(cityEdit as any), population: e.target.value })}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <span>{c.name}</span>
                                        <span className="text-gray-500">{(c.population || 0).toLocaleString()}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {cityEdit?.id === c.id ? (
                                      <>
                                        <button
                                          className="text-green-600 hover:text-green-800"
                                          onClick={async () => {
                                            if (!currentUser) return;
                                            const newName = (cityEdit?.name || '').trim() || c.name;
                                            const newPop = parseInt(cityEdit?.population || `${c.population || 0}`) || 0;
                                            const oldData = { name: c.name, population: c.population || 0 };
                                            const newData = { name: newName, population: newPop };
                                            await update(ref(database, `referenceCities/${c.id}`), {
                                              ...newData,
                                              country: expandedCountry?.name || c.country,
                                              dateAdded: new Date().toISOString(),
                                              addedBy: currentUser.name || currentUser.email
                                            });
                                            await logAudit({
                                              userId: currentUser.email,
                                              userName: currentUser.name,
                                              userEmail: currentUser.email,
                                              action: 'update',
                                              entityType: 'reference',
                                              entityId: c.id,
                                              entityName: newName,
                                              changes: calculateChanges(oldData, newData),
                                            });
                                            setCityEdit(null);
                                          }}
                                        >
                                          Save
                                        </button>
                                        <button className="text-gray-600 hover:text-gray-900" onClick={() => setCityEdit(null)}>Cancel</button>
                                      </>
                                    ) : (
                                      <>
                                        <button className="text-blue-600 hover:text-blue-900" onClick={() => setCityEdit({ id: c.id, name: c.name, population: `${c.population || ''}` })}>Edit</button>
                                        {isAdmin && (
                                          <button
                                            className="text-red-600 hover:text-red-900"
                                            onClick={async () => {
                                              if (!isAdmin) return;
                                              if (!window.confirm('Delete this city?')) return;
                                              await remove(ref(database, `referenceCities/${c.id}`));
                                              await logAudit({
                                                userId: currentUser?.email || '',
                                                userName: currentUser?.name || '',
                                                userEmail: currentUser?.email || '',
                                                action: 'delete',
                                                entityType: 'reference',
                                                entityId: c.id,
                                                entityName: c.name,
                                              });
                                            }}
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-900">{items.length}</div>
            <div className="text-sm text-blue-700">Total {currentConfig.label}</div>
          </div>
          <div className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Use "Bulk Import" to quickly add multiple items at once.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceDataManager;
