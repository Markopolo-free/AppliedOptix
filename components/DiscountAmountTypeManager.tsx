import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, push, update, remove } from 'firebase/database';

interface DiscountAmountType {
  id: string;
  value: string;
}

const DiscountAmountTypeManager: React.FC = () => {
  const [types, setTypes] = useState<DiscountAmountType[]>([]);
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const db = getDatabase();
    const refData = ref(db, 'referenceDiscountAmountTypes');
    onValue(refData, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTypes(Object.entries(data).map(([id, v]: [string, any]) => ({ id, value: v.value })));
      } else {
        setTypes([]);
      }
    });
  }, []);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    const db = getDatabase();
    await push(ref(db, 'referenceDiscountAmountTypes'), { value: newValue });
    setNewValue('');
  };

  const handleEdit = (id: string, value: string) => {
    setEditingId(id);
    setEditValue(value);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    const db = getDatabase();
    await update(ref(db, `referenceDiscountAmountTypes/${editingId}`), { value: editValue });
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = async (id: string) => {
    const db = getDatabase();
    await remove(ref(db, `referenceDiscountAmountTypes/${id}`));
  };

  return (
    <div className="p-6 bg-white rounded shadow max-w-lg mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Discount Amount Types Reference Data</h2>
      <div className="mb-4 flex gap-2">
        <input type="text" placeholder="Type value (alpha/numeric)" value={newValue} onChange={e => setNewValue(e.target.value)} className="border px-2 py-1 rounded w-2/3" />
        <button onClick={handleAdd} className="bg-primary-600 text-white px-4 py-1 rounded">Add</button>
      </div>
      <ul className="divide-y">
        {types.map(type => (
          <li key={type.id} className="py-2 flex justify-between items-center">
            {editingId === type.id ? (
              <>
                <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} className="border px-2 py-1 rounded w-2/3" />
                <button onClick={handleSaveEdit} className="bg-green-500 text-white px-2 py-1 rounded ml-2">Save</button>
                <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-2 py-1 rounded ml-2">Cancel</button>
              </>
            ) : (
              <>
                <span>{type.value}</span>
                <div>
                  <button onClick={() => handleEdit(type.id, type.value)} className="text-yellow-600 px-2">Edit</button>
                  <button onClick={() => handleDelete(type.id)} className="text-red-500 px-2">Delete</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DiscountAmountTypeManager;
