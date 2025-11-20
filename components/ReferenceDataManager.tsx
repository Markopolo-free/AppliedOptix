


import React, { useState, useEffect } from 'react';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref, onValue, push, remove, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import WeatherConditionsManager from './WeatherConditionsManager';

interface City {
  id: string;
  name: string;
  population: number;
  dateAdded: string;
  addedBy: string;
}


// --- Multi-category ReferenceDataManager ---
type CategoryType = 'countries' | 'currencies' | 'fxSegments' | 'serviceTypes' | 'zoneTypes' | 'zones' | 'cities' | 'weatherConditions' | 'loyaltyTriggerEvents' | 'badges';


interface ReferenceItem {
  id: string;
  name?: string;
  description?: string;
  iconUrl?: string;
  population?: number;
  dateAdded?: string;
  addedBy?: string;
  // For loyaltyTriggerEvents
  value?: string;
  label?: string;
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
      case 'zones': refPath = 'referenceZones'; break;
      case 'cities': refPath = 'referenceCities'; break;
      case 'weatherConditions': refPath = 'referenceWeatherConditions'; break;
      case 'loyaltyTriggerEvents': refPath = 'loyaltyTriggerEvents'; break; // Removed badges reference
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

  // Map category to correct Firebase path
  const getRefPath = (cat: CategoryType, id?: string) => {
    let base = '';
    switch (cat) {
      case 'countries': base = 'referenceCountries'; break;
      case 'currencies': base = 'referenceCurrencies'; break;
      case 'fxSegments': base = 'referenceFXSegments'; break;
      case 'serviceTypes': base = 'referenceServiceTypes'; break;
      case 'zoneTypes': base = 'referenceZoneTypes'; break;
      case 'zones': base = 'referenceZones'; break;
      case 'cities': base = 'referenceCities'; break;
      case 'weatherConditions': base = 'referenceWeatherConditions'; break;
      case 'loyaltyTriggerEvents': base = 'loyaltyTriggerEvents'; break;
      default: base = ''; break;
    }
    return id ? `${base}/${id}` : base;
  };

  const handleAdd = () => {
    const db = getDatabase();
    const refPath = getRefPath(category);
    if (!refPath) return;
    const dbRef = ref(db, refPath);
    if (category === 'loyaltyTriggerEvents') {
      // Only push value and label for trigger events
      push(dbRef, { value: formData.value || '', label: formData.label || '' });
      setFormData({ id: '', value: '', label: '' });
    } else {
      push(dbRef, formData);
      setFormData({ id: '', name: '', description: '', iconUrl: '' });
    }
  };

  const handleEdit = (item: ReferenceItem) => {
    setEditingId(item.id);
    if (category === 'loyaltyTriggerEvents') {
      setFormData({ id: item.id, value: item.value || '', label: item.label || '' });
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
      update(dbRef, { value: formData.value || '', label: formData.label || '' });
      setFormData({ id: '', value: '', label: '' });
    } else {
      update(dbRef, formData);
      setFormData({ id: '', name: '', description: '', iconUrl: '' });
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const db = getDatabase();
    const refPath = getRefPath(category, id);
    if (!refPath) return;
    const dbRef = ref(db, refPath);
    remove(dbRef);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Reference Data Manager</h2>
      <select value={category} onChange={e => setCategory(e.target.value as CategoryType)} className="mb-4">
        <option value="countries">Countries</option>
        <option value="currencies">Currencies</option>
        <option value="fxSegments">FX Segments</option>
        <option value="serviceTypes">Service Types</option>
        <option value="zoneTypes">Zone Types</option>
        <option value="zones">Pricing Zones</option>
        <option value="cities">Cities</option>
        <option value="weatherConditions">Weather Conditions</option>
        <option value="loyaltyTriggerEvents">Loyalty Trigger Events</option>
      </select>
      <table className="min-w-full border mb-4">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            {category === 'fxSegments' && <th>Type</th>}
            <th>Icon URL</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id || item.name || JSON.stringify(item)}>
              <td>{item.name}</td>
              <td>{item.description}</td>
              {category === 'fxSegments' && <td>{item.type || ''}</td>}
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
        </tbody>
      </table>
      <form onSubmit={e => { e.preventDefault(); editingId ? handleUpdate() : handleAdd(); }}>
        {category === 'loyaltyTriggerEvents' ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Value</label>
              <input
                type="text"
                value={formData.value || ''}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                type="text"
                value={formData.label || ''}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
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
            <button type="button" onClick={() => { setEditingId(null); setFormData(category === 'loyaltyTriggerEvents' ? { id: '', value: '', label: '' } : { id: '', name: '', description: '', iconUrl: '' }); }} className="px-4 py-2 bg-gray-300 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ReferenceDataManager;

