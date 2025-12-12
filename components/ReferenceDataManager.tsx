const categoryToPath: Record<CategoryType, string> = {
  countries: 'referenceCountries',
  currencies: 'referenceCurrencies',
  fxSegments: 'referenceFXSegments',
  serviceTypes: 'referenceServiceTypes',
  zoneTypes: 'referenceZoneTypes',
  companyTypes: 'referenceCompanyTypes',
  zones: 'referenceZones',
  cities: 'referenceCities',
  weatherConditions: 'referenceWeatherConditions',
  loyaltyTriggerEvents: 'loyaltyTriggerEvents',
  discountAmountTypes: 'referenceDiscountAmountTypes',
  badges: 'referenceBadges',
};

import React, { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { set } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
// --- Types ---
interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  dateAdded: string;
  addedBy: string;
}
type CategoryType = 'countries' | 'currencies' | 'fxSegments' | 'serviceTypes' | 'zoneTypes' | 'companyTypes' | 'zones' | 'cities' | 'weatherConditions' | 'loyaltyTriggerEvents' | 'discountAmountTypes' | 'badges';
interface ReferenceItem {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  country?: string;
  city?: string;
  population?: number;
  dateAdded?: string;
  addedBy?: string;
}

const categoryFields: Record<CategoryType, Array<{ key: keyof ReferenceItem, label: string, required?: boolean, type?: string }>> = {
  countries: [
    { key: 'name', label: 'Country Name', required: true },
    { key: 'population', label: 'Population', type: 'number' },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  currencies: [
    { key: 'code', label: 'Code', required: true },
    { key: 'name', label: 'Currency Name', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  fxSegments: [
    { key: 'name', label: 'FX Segment', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  serviceTypes: [
    { key: 'name', label: 'Service Type', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  zoneTypes: [
    { key: 'name', label: 'Zone Type', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  companyTypes: [
    { key: 'name', label: 'Company Type', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  zones: [
    { key: 'name', label: 'Zone Name', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  cities: [
    { key: 'name', label: 'City Name', required: true },
    { key: 'country', label: 'Country' },
    { key: 'population', label: 'Population', type: 'number' },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  weatherConditions: [
    { key: 'name', label: 'Weather Condition', required: true },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  loyaltyTriggerEvents: [
    { key: 'name', label: 'Event Name', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  discountAmountTypes: [
    { key: 'name', label: 'Discount Amount Type', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
  badges: [
    { key: 'name', label: 'Badge Name', required: true },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'addedBy', label: 'Added By' },
  ],
};


const ReferenceDataManager: React.FC = () => {
  const [category, setCategory] = useState<CategoryType>('countries');
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [formData, setFormData] = useState<Partial<ReferenceItem>>({});
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    const refPath = categoryToPath[category];
    if (!refPath) {
      setItems([]);
      return;
    }
    const dbRef = ref(db, refPath);
    const countriesRef = ref(db, categoryToPath['countries']);
    const citiesRef = ref(db, categoryToPath['cities']);
    let countryNames: string[] = [];
    let cityNames: string[] = [];
    const unsubCountries = onValue(countriesRef, (snapshot) => {
      const data = snapshot.val() || {};
      countryNames = Object.values(data).map((item: any) => (item.name || '').trim());
      setCountryOptions(countryNames);
    });
    const unsubCities = onValue(citiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      cityNames = Object.values(data).map((item: any) => (item.name || '').trim());
      setCityOptions(cityNames);
    });
    const unsubscribe = onValue(dbRef, (snapshot) => {
        // DEBUG: Log category and Firebase path
        // eslint-disable-next-line no-console
        console.log('Loading category:', category, 'from path:', dbRef.toString());
      const data = snapshot.val() || {};
      let loadedItems = Object.entries(data).map(([key, value]: [string, any]) => {
        // If id is missing or empty, use the Firebase key
        const itemId = value.id && typeof value.id === 'string' && value.id.trim() !== '' ? value.id : key;
        return { id: itemId, ...value };
      });
      // Sanitize all fields for weatherConditions
      if (category === 'weatherConditions') {
        const sanitize = (val) => {
          if (Array.isArray(val)) return val.join('');
          return typeof val === 'string' ? val : '';
        };
        loadedItems = loadedItems
          .map(item => ({
            ...item,
            id: sanitize(item.id),
            name: sanitize(item.name),
            description: sanitize(item.description),
            country: sanitize(item.country),
            city: sanitize(item.city),
          }))
          // Only keep items that have a valid name and description
          .filter(item => typeof item === 'object' && item !== null && item.name && item.description);
      }
      // Debug log: show raw loaded items
      // eslint-disable-next-line no-console
      loadedItems.forEach((item, idx) => {
        console.log(`Item ${idx}:`, item);
      });
      // Filter duplicates by name (case-insensitive)
      const seen = new Set<string>();
      let filtered = loadedItems.filter(item => {
        if (category === 'weatherConditions') {
          // Only include items that are objects and have a valid name
          return typeof item === 'object' && item !== null && typeof item.name === 'string' && item.name.trim() !== '';
        }
        const name = (item.name || '').trim().toLowerCase();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
      // Remove any item whose name matches a country name, except for loyaltyTriggerEvents, countries, cities, and weatherConditions
      if (
        countryNames.length > 0 &&
        category !== 'loyaltyTriggerEvents' &&
        category !== 'countries' &&
        category !== 'cities' &&
        category !== 'weatherConditions'
      ) {
        filtered = filtered.filter(item => {
          const name = (item.name || '').trim().toLowerCase();
          return !countryNames.map(n => n.toLowerCase()).includes(name);
        });
      }
      // Debug log: show filtered items
      // eslint-disable-next-line no-console
      console.log('Filtered items for UI:', filtered);
      setItems(filtered);
    });
    return () => {
      unsubscribe();
      unsubCountries();
      unsubCities();
    };
  }, [category]);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Reference Data Manager</h2>
      <div className="bg-white rounded shadow p-6">
        <select value={category} onChange={e => setCategory(e.target.value as CategoryType)} className="mb-4 bg-gray-100 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="countries">Countries</option>
          <option value="currencies">Currencies</option>
          <option value="fxSegments">FX Segments</option>
          <option value="serviceTypes">Service Types</option>
          <option value="zoneTypes">Zone Types</option>
          <option value="companyTypes">Company Types</option>
          <option value="zones">Pricing Zones</option>
          <option value="cities">Cities</option>
          <option value="weatherConditions">Weather Conditions</option>
          <option value="loyaltyTriggerEvents">Loyalty Trigger Events</option>
          <option value="discountAmountTypes">Discount Amount Types</option>
        </select>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold">{categoryFields[category].map(f => f.label).join(' | ')}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => { setShowForm(true); setEditingItem(null); setFormData({}); }}>Add</button>
              {category === 'countries' && (
                <button
                  className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                  onClick={async () => {
                    const orphanedNames = ['Greece', 'Hong Kong', 'Estonia'];
                    const orphaned = items.filter(item => orphanedNames.includes((item.name || '').trim()));
                    if (orphaned.length === 0) {
                      window.alert('No orphaned countries found.');
                      return;
                    }
                    if (!window.confirm(`Remove the following orphaned countries?\n${orphaned.map(i => i.name).join(', ')}`)) return;
                    const refPath = categoryToPath['countries'];
                    let errors = [];
                    for (const item of orphaned) {
                      try {
                        await remove(ref(db, `${refPath}/${item.id}`));
                      } catch (err) {
                        errors.push(item.name);
                      }
                    }
                    if (errors.length > 0) {
                      window.alert(`Failed to remove: ${errors.join(', ')}`);
                    } else {
                      window.alert('Orphaned countries removed.');
                    }
                  }}
                >
                  Remove Orphaned
                </button>
              )}
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {categoryFields[category].map(field => (
                  <th key={field.key as string} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</th>
                ))}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr><td colSpan={categoryFields[category].length + 1} className="text-center text-gray-500 py-4">No data found for this category.</td></tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id || index}>
                    {categoryFields[category].map(field => {
                      if (field.key === 'dateAdded') {
                        let formatted = '';
                        if (item.dateAdded) {
                          const d = new Date(item.dateAdded);
                          if (!isNaN(d.getTime())) {
                            const date = d.toLocaleDateString();
                            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            formatted = `${date} ${time}`;
                          } else {
                            formatted = item.dateAdded;
                          }
                        }
                        return (
                          <td key={field.key as string} className="pl-2 pr-4 py-2">
                            <span className="text-xs text-gray-500 whitespace-nowrap">{formatted}</span>
                          </td>
                        );
                      }
                      let value = item[field.key] ?? '';
                      return (
                        <td key={field.key as string} className="px-4 py-2">{value}</td>
                      );
                    })}
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          onClick={() => {
                            let safeItem = { ...item };
                            if (category === 'weatherConditions') {
                              Object.keys(safeItem).forEach(key => {
                                if (Array.isArray(safeItem[key])) safeItem[key] = safeItem[key].join('');
                                else if (typeof safeItem[key] !== 'string') safeItem[key] = safeItem[key] ?? '';
                              });
                              safeItem.country = typeof safeItem.country === 'string' ? safeItem.country : '';
                              safeItem.city = typeof safeItem.city === 'string' ? safeItem.city : '';
                            }
                            // Always set id in formData for editing
                            setEditingItem(safeItem);
                            setFormData({ ...safeItem, id: safeItem.id });
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete this record?')) return;
                            const refPath = categoryToPath[category];
                            await remove(ref(db, `${refPath}/${item.id}`));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {showForm && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">{editingItem ? 'Edit' : 'Add'} {categoryFields[category][0].label}</h3>
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const refPath = categoryToPath[category];
                const now = new Date().toISOString();
                let baseData: ReferenceItem = {
                  ...formData,
                  dateAdded: editingItem ? (formData.dateAdded || now) : now,
                  addedBy: currentUser?.email || 'Unknown',
                } as ReferenceItem;
                // For weatherConditions, sanitize all fields to strings
                if (category === 'weatherConditions') {
                  Object.keys(baseData).forEach(key => {
                    if (Array.isArray(baseData[key])) baseData[key] = baseData[key].join('');
                    else if (typeof baseData[key] !== 'string') baseData[key] = baseData[key] ?? '';
                  });
                  baseData.country = typeof baseData.country === 'string' ? baseData.country : '';
                  baseData.city = typeof baseData.city === 'string' ? baseData.city : '';
                }
                if (editingItem) {
                  await update(ref(db, `${refPath}/${editingItem.id}`), baseData);
                } else {
                  const newRef = push(ref(db, refPath));
                  await set(newRef, { ...baseData, id: newRef.key });
                }
                setShowForm(false);
                setEditingItem(null);
                setFormData({});
                if (category === 'weatherConditions') {
                  const countriesRef = ref(db, categoryToPath['countries']);
                  const citiesRef = ref(db, categoryToPath['cities']);
                  onValue(countriesRef, (snapshot) => {
                    const data = snapshot.val() || {};
                    setCountryOptions(Object.values(data).map((item: any) => (item.name || '').trim()));
                  }, { onlyOnce: true });
                  onValue(citiesRef, (snapshot) => {
                    const data = snapshot.val() || {};
                    setCityOptions(Object.values(data).map((item: any) => (item.name || '').trim()));
                  }, { onlyOnce: true });
                }
              }}>
                {categoryFields[category].map(field => {
                  // Country dropdown for cities and weatherConditions
                  if ((category === 'cities' || category === 'weatherConditions') && field.key === 'country') {
                    return (
                      <div key={field.key as string}>
                        <label className="block text-sm font-medium mb-1">{field.label}</label>
                        <select
                          value={typeof formData.country === 'string' ? formData.country : ''}
                          required={field.required}
                          onChange={e => setFormData({ ...formData, country: String(e.target.value) })}
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="">Select a country</option>
                          {countryOptions.map((name, idx) => (
                            <option key={name + '-' + idx} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  // City dropdown for weatherConditions
                  if (category === 'weatherConditions' && field.key === 'city') {
                    return (
                      <div key={field.key as string}>
                        <label className="block text-sm font-medium mb-1">{field.label}</label>
                        <select
                          value={typeof formData.city === 'string' ? formData.city : ''}
                          required={field.required}
                          onChange={e => setFormData({ ...formData, city: String(e.target.value) })}
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="">Select a city</option>
                          {cityOptions.map((name, idx) => (
                            <option key={name + '-' + idx} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  // ...existing code...
                  // Default input
                  return (
                    <div key={field.key as string}>
                      <label className="block text-sm font-medium mb-1">{field.label}</label>
                      <input
                        type={field.type || 'text'}
                        value={formData[field.key] ?? ''}
                        required={field.required}
                        onChange={e => setFormData({ ...formData, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  );
                })}
                <div className="flex gap-2 mt-2">
                  <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">{editingItem ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



export default ReferenceDataManager;


