// Loyalty Trigger Events Reference Data Manager
import React, { useEffect, useState } from 'react';
import { ref, get, push, remove, update, onValue } from 'firebase/database';
import { db } from '../services/firebase';

interface TriggerEvent {
  id: string;
  value: string;
  label: string;
}

const LoyaltyTriggerEventsManager: React.FC = () => {
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    const eventsRef = ref(db, 'loyaltyTriggerEvents');
    const unsubscribe = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setEvents(Object.entries(data).map(([id, ev]: [string, any]) => ({ id, ...ev })));
      } else {
        setEvents([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!newLabel || !newValue) return;
    await push(ref(db, 'loyaltyTriggerEvents'), { value: newValue, label: newLabel });
    setNewLabel('');
    setNewValue('');
  };

  const handleDelete = async (id: string) => {
    await remove(ref(db, `loyaltyTriggerEvents/${id}`));
  };

  return (
    <div className="p-6 bg-white rounded shadow max-w-lg mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Loyalty Trigger Events Reference Data</h2>
      <div className="mb-4 flex gap-2">
        <input type="text" placeholder="Event value (e.g. birthday)" value={newValue} onChange={e => setNewValue(e.target.value)} className="border px-2 py-1 rounded w-1/3" />
        <input type="text" placeholder="Event label (e.g. Birthday)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="border px-2 py-1 rounded w-2/3" />
        <button onClick={handleAdd} className="bg-primary-600 text-white px-4 py-1 rounded">Add</button>
      </div>
      <ul className="divide-y">
        {events.map(ev => (
          <li key={ev.id} className="py-2 flex justify-between items-center">
            <span>{ev.label} <span className="text-xs text-gray-400">({ev.value})</span></span>
            <button onClick={() => handleDelete(ev.id)} className="text-red-500 px-2">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LoyaltyTriggerEventsManager;
