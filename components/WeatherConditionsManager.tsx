import React, { useState, useEffect } from 'react';
import { WeatherCondition } from '../types/weather';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { db } from '../services/firebase';

const WeatherConditionsManager: React.FC = () => {
  const [conditions, setConditions] = useState<WeatherCondition[]>([]);
  const [newCondition, setNewCondition] = useState<Partial<WeatherCondition>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const conditionsRef = ref(db, 'referenceWeatherConditions');
    const unsubscribe = onValue(conditionsRef, (snapshot) => {
      const data = snapshot.val() || {};
  const arr = Object.entries(data).map(([id, cond]) => ({ id, ...(typeof cond === 'object' && cond !== null ? cond : {}) }));
      setConditions(arr.map(c => {
        const cond = c as any;
        return {
          id: cond.id,
          name: cond.name || '',
          description: cond.description || '',
          severity: cond.severity || '',
          lastModifiedBy: cond.lastModifiedBy || '',
          lastModifiedAt: cond.lastModifiedAt || ''
        };
      }));
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (field: keyof WeatherCondition, value: string) => {
    setNewCondition({ ...newCondition, [field]: value });
  };

  const handleSave = async () => {
    if (!newCondition.name) return;
    setIsSaving(true);
    const conditionsRef = ref(db, 'referenceWeatherConditions');
    await push(conditionsRef, {
      name: newCondition.name,
      description: newCondition.description || '',
    });
    setNewCondition({});
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await remove(ref(db, `referenceWeatherConditions/${id}`));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Weather Conditions</h1>
      <div className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Add New Condition</h2>
        <input
          type="text"
          placeholder="Name"
          value={newCondition.name || ''}
          onChange={e => handleChange('name', e.target.value)}
          className="mb-2 w-full px-3 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Description"
          value={newCondition.description || ''}
          onChange={e => handleChange('description', e.target.value)}
          className="mb-2 w-full px-3 py-2 border rounded"
        />
        {/* Icon field removed */}
        <button
          onClick={handleSave}
          disabled={isSaving || !newCondition.name}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {isSaving ? 'Saving...' : 'Add Condition'}
        </button>
      </div>
      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            {/* Icon column removed */}
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map(cond => (
            <tr key={cond.id}>
              <td className="px-4 py-2">{cond.name}</td>
              <td className="px-4 py-2">{cond.description}</td>
              {/* Icon cell removed */}
              <td className="px-4 py-2">
                <button
                  onClick={() => handleDelete(cond.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeatherConditionsManager;
