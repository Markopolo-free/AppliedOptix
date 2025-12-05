import React, { useState, useEffect } from 'react';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref, onValue, push, remove, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import WeatherConditionsManager from './WeatherConditionsManager';

interface City {
  id: string;
  name: string;
  country: string;
  population: number;
  dateAdded: string;
  addedBy: string;
}


// --- Multi-category ReferenceDataManager ---
type CategoryType = 'countries' | 'currencies' | 'fxSegments' | 'serviceTypes' | 'zoneTypes' | 'companyTypes' | 'zones' | 'cities' | 'weatherConditions' | 'loyaltyTriggerEvents' | 'badges';


interface ReferenceItem {
  id: string;
  name?: string;
  description?: string;
  iconUrl?: string;
  country?: string; // Used for cities and loyaltyTriggerEvents
  population?: number;
  dateAdded?: string;
  addedBy?: string;
  // For loyaltyTriggerEvents
  // Removed value/label for loyaltyTriggerEvents
  event?: string;
  city?: string;
}

const ReferenceDataManager: React.FC = () => {

  // Handle image upload for icon (Base64)
  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('Image size should be less than 500KB. Please choose a smaller image.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, iconUrl: base64String }));
    };
    reader.readAsDataURL(file);
  };
  const { currentUser } = useAuth();
  const [category, setCategory] = useState<CategoryType>('countries');
  const [items, setItems] = useState<ReferenceItem[]>([]); // Removed badges reference
  const [formData, setFormData] = useState<ReferenceItem>({ id: '', name: '', description: '', iconUrl: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [referenceCountries, setReferenceCountries] = useState<string[]>([]);
  const [referenceCities, setReferenceCities] = useState<{ name: string; country: string }[]>([]);

  useEffect(() => {
    // Map category to correct Firebase path
    const db = getDatabase();
    let refPath = '';
    switch (category) {
      case 'countries': refPath = 'referenceCountries'; break;
      case 'currencies': refPath = 'referenceCurrencies'; break;
      case 'fxSegments': refPath = 'referenceFXSegments'; break;
      case 'serviceTypes': refPath = 'referenceServiceTypes'; break;
      case 'zoneTypes': refPath = 'referenceZoneTypes'; break;
      case 'companyTypes': refPath = 'referenceCompanyTypes'; break;
      case 'zones': refPath = 'referenceZones'; break;
      case 'cities': refPath = 'referenceCities'; break;
      case 'weatherConditions': refPath = 'referenceWeatherConditions'; break;
      case 'loyaltyTriggerEvents': refPath = 'loyaltyTriggerEvents'; break;
      default: refPath = '';
    }
    if (!refPath) {
      setItems([]);
      return;
    }
    const dbRef = ref(db, refPath);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedItems = Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }));
      setItems(loadedItems);
    });
    return () => unsubscribe();
  }, [category]);

  useEffect(() => {
    // Load reference countries and cities for dropdowns in cities and loyaltyTriggerEvents
    if (category === 'cities' || category === 'loyaltyTriggerEvents') {
      const db = getDatabase();
      const countriesRef = ref(db, 'referenceCountries');
      const unsubCountries = onValue(countriesRef, (snapshot) => {
        const data = snapshot.val() || {};
        setReferenceCountries(Object.values(data).map((item: any) => item.name).filter(Boolean));
      });
      const citiesRef = ref(db, 'referenceCities');
      const unsubCities = onValue(citiesRef, (snapshot) => {
        const data = snapshot.val() || {};
        setReferenceCities(Object.values(data).map((item: any) => ({ name: item.name, country: item.country })).filter(c => c.name && c.country));
      });
      return () => {
        unsubCountries();
        unsubCities();
      };
    }
  }, [category]);

  // Map category to correct Firebase path
  const getRefPath = (cat: CategoryType, id?: string) => {
    let base = '';
    switch (cat) {
      case 'countries': base = 'referenceCountries'; break;
      case 'currencies': base = 'referenceCurrencies'; break;
      case 'fxSegments': base = 'referenceFXSegments'; break;
      case 'serviceTypes': base = 'referenceServiceTypes'; break;
      case 'zoneTypes': base = 'referenceZoneTypes'; break;
      case 'companyTypes': base = 'referenceCompanyTypes'; break;
      case 'zones': base = 'referenceZones'; break;
      case 'cities': base = 'referenceCities'; break;
      case 'weatherConditions': base = 'referenceWeatherConditions'; break;
      case 'loyaltyTriggerEvents': base = 'loyaltyTriggerEvents'; break;
      default: base = ''; break;
    }
    return id ? `${base}/${id}` : base;
  };

  const handleAdd = () => {
    // Validation: Prevent blank records for all types
    if (category === 'loyaltyTriggerEvents') {
      if (!formData.event?.trim() || !formData.country?.trim() || !formData.city?.trim()) {
        alert('Event, Country, and City are required.');
        return;
      }
    } else {
      if (category === 'cities') {
        if (!formData.name?.trim() || !formData.description?.trim() || !formData.country?.trim()) {
          alert('Name, Description, and Country are required for cities.');
          return;
        }
      } else {
        if (!formData.name?.trim() || !formData.description?.trim()) {
          alert('Name and Description are required.');
          return;
        }
      }
    }
    const db = getDatabase();
    const refPath = getRefPath(category);
    if (!refPath) return;
    const dbRef = ref(db, refPath);
    if (category === 'loyaltyTriggerEvents') {
      // Push only event, country, city
      push(dbRef, { event: formData.event, country: formData.country, city: formData.city });
      setFormData({ id: '', event: '', country: '', city: '' });
    } else {
      push(dbRef, formData);
      setFormData({ id: '', name: '', description: '', iconUrl: '' });
    }
  };

  const handleEdit = (item: ReferenceItem) => {
    setEditingId(item.id);
    if (category === 'loyaltyTriggerEvents') {
      setFormData({
        id: item.id,
        event: item.event || '',
        country: item.country || '',
        city: item.city || ''
      });
    } else if (category === 'countries') {
      setFormData({
        id: item.id,
        name: item.name || '',
        description: item.description || '',
        iconUrl: item.iconUrl || ''
      });
    } else {
      setFormData(item);
    }
  };

  const handleUpdate = () => {
    if (!editingId) return;
    const db = getDatabase();
    const refPath = getRefPath(category, editingId);
    if (!refPath) return;
    const dbRef = ref(db, refPath);
    if (category === 'loyaltyTriggerEvents') {
      update(dbRef, {
        event: formData.event || '',
        country: formData.country || '',
        city: formData.city || ''
      });
      setFormData({ id: '', event: '', country: '', city: '' });
    } else {
      update(dbRef, formData);
      setFormData({ id: '', name: '', description: '', iconUrl: '' });
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    console.log('Delete requested for ID:', id, 'Category:', category);
    if (!id || typeof id !== 'string' || id.trim() === '') {
      alert('Delete failed: Invalid item ID.');
      console.error('Delete failed: Invalid item ID.', id);
      return;
    }
    const db = getDatabase();
    const refPath = getRefPath(category, id);
    if (!refPath || refPath.endsWith('/')) {
      alert('Delete failed: Invalid reference path.');
      console.error('Delete failed: Invalid reference path.', refPath);
      return;
    }
    const dbRef = ref(db, refPath);
    try {
      await remove(dbRef);
      setEditingId(null);
      setFormData(category === 'countries' ? { id: '', name: '', description: '', iconUrl: '' } : category === 'loyaltyTriggerEvents' ? { id: '', event: '', country: '', city: '' } : { id: '', name: '', description: '', iconUrl: '' });
      // Data will refresh automatically via useEffect
      console.log('Delete successful for ID:', id);
    } catch (error) {
      alert('Delete failed: ' + (error?.message || error));
      console.error('Delete failed:', error);
    }
  };

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
        </select>
        <table className="min-w-full border mb-4">
          <thead>
            <tr>
              {category === 'loyaltyTriggerEvents' ? (
                <>
                  <th>Event</th>
                  <th>Country</th>
                  <th>City</th>
                  <th>Actions</th>
                </>
              ) : (
                <>
                  <th>Country</th>
                  <th>City</th>
                  <th>Icon URL</th>
                  <th>Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {category === 'cities' ? (
              (() => {
                // Group cities by country
                const grouped = items.reduce((acc, item) => {
                  const countryKey = item.country || 'Unknown';
                  if (!acc[countryKey]) acc[countryKey] = [];
                  acc[countryKey].push(item);
                  return acc;
                }, {} as Record<string, ReferenceItem[]>);
                return Object.entries(grouped).map(([country, cities], countryIdx) => (
                  <React.Fragment key={country}>
                    {countryIdx > 0 && (
                      <tr>
                        <td colSpan={4}>
                          <hr style={{ border: 'none', borderTop: '3px solid #2563eb', margin: '12px 0' }} />
                        </td>
                      </tr>
                    )}
                    {cities.map((item, idx) => (
                      <tr key={item.id ? String(item.id) : `${item.name || 'unknown'}-${idx}`}>
                        <td>{item.country}</td>
                        <td>{item.name}</td>
                        <td>
                          {item.iconUrl ? (
                            <span style={{ display: 'inline-block', background: '#fff', borderRadius: '50%', padding: 4 }}>
                              <img
                                src={item.iconUrl}
                                alt={item.name || 'icon'}
                                style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '50%', background: '#fff' }}
                              />
                            </span>
                          ) : (
                            <span className="text-gray-400">No icon</span>
                          )}
                        </td>
                        <td className="space-x-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none"
                            title="Edit"
                          >
                            Edit
                          </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                              title="Delete"
                              disabled={!item.id || typeof item.id !== 'string' || item.id.trim() === ''}
                            >
                              Delete
                            </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ));
              })()
            ) : category === 'loyaltyTriggerEvents' ? (
              <>
                {items.map((item, idx) => (
                  <tr key={item.id ? String(item.id) : `${item.event || 'unknown'}-${idx}`}> 
                    <td>{item.event}</td>
                    <td>{item.country}</td>
                    <td>{item.city}</td>
                    <td className="space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              <>
                {items.map((item, idx) => (
                  <tr key={item.id ? String(item.id) : `${item.name || 'unknown'}-${idx}`}> 
                    <td>{item.name}</td>
                    <td>{item.description}</td>
                    <td>
                      {item.iconUrl ? (
                        <span style={{ display: 'inline-block', background: '#fff', borderRadius: '50%', padding: 4 }}>
                          <img
                            src={item.iconUrl}
                            alt={item.name || 'icon'}
                            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '50%', background: '#fff' }}
                          />
                        </span>
                      ) : (
                        <span className="text-gray-400">No icon</span>
                      )}
                    </td>
                    <td className="space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
        <form onSubmit={e => { e.preventDefault(); editingId ? handleUpdate() : handleAdd(); }}>
          {category === 'loyaltyTriggerEvents' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Event</label>
                <input
                  type="text"
                  value={formData.event || ''}
                  onChange={e => setFormData({ ...formData, event: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <select
                  value={formData.country || ''}
                  onChange={e => {
                    const selectedCountry = e.target.value;
                    setFormData(prev => ({ ...prev, country: selectedCountry, city: '' }));
                  }}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Select Country</option>
                  {[...new Set(referenceCountries)].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                {(() => {
                  // Debug: print all cities and their country values
                  console.log('All referenceCities:', referenceCities);
                  const selectedCountry = (formData.country || '').trim().toLowerCase();
                  console.log('Selected country:', selectedCountry);
                  const filteredCities = referenceCities.filter(city =>
                    city.country && city.country.trim().toLowerCase() === selectedCountry
                  );
                  console.log('Filtered cities:', filteredCities);
                  return (
                    <select
                      value={formData.city || ''}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="">Select City</option>
                      {filteredCities.map(city => (
                        <option key={city.name} value={city.name}>{city.name}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              {category === 'cities' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Country</label>
                  <select
                    value={formData.country || ''}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  >
                    <option value="">Select Country</option>
                    {[...new Set(referenceCountries)].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Icon Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  className="w-full px-3 py-2 border rounded"
                />
                {formData.iconUrl && (
                  <span style={{ display: 'inline-block', background: '#fff', borderRadius: '50%', padding: 4, marginTop: 8 }}>
                    <img
                      src={formData.iconUrl}
                      alt={formData.name || 'icon'}
                      style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '50%', background: '#fff' }}
                    />
                  </span>
                )}
              </div>
            </>
          )}
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
              {editingId ? 'Update' : 'Add'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setFormData(category === 'loyaltyTriggerEvents' ? { id: '', event: '', country: '', city: '' } : { id: '', name: '', description: '', iconUrl: '' }); }} className="px-4 py-2 bg-gray-300 rounded">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferenceDataManager;

