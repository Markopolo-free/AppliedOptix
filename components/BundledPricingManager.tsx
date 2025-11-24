import React, { useState, useEffect } from 'react';
import { ref, get, update, remove, push, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import { Bundle, DiscountType, Service } from '../types';

const BundledPricingManager: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBundle, setNewBundle] = useState<any>({
    name: '',
    description: '',
    serviceIds: [],
    discountType: DiscountType.Fixed,
    discountValue: 0,
    startDate: '',
    endDate: ''
  });
  const [addError, setAddError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBundle, setEditBundle] = useState<any | null>(null);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Fetch bundles
      const bundlesRef = ref(db, 'bundles');
      const bundlesSnapshot = await get(bundlesRef);
      if (bundlesSnapshot.exists()) {
        const data = bundlesSnapshot.val();
        const list: Bundle[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setBundles(list);
      } else {
        setBundles([]);
      }
      // Fetch services
      const servicesRef = ref(db, 'services');
      const servicesSnapshot = await get(servicesRef);
      if (servicesSnapshot.exists()) {
        const data = servicesSnapshot.val();
        const list: Service[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setServices(list);
      } else {
        setServices([]);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const getServiceName = (serviceId: string) => services.find(s => s.id === serviceId)?.name || serviceId;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Bundled Pricing Management</h1>
      <button className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowAddModal(true)}>Add Bundle</button>
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Type</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Description</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Services</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Discount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Active Period</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Last Modified</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading bundles...</td></tr>
              ) : bundles.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-500">No bundles found.</td></tr>
              ) : (
                bundles.map(bundle => (
                  <tr key={bundle.id || JSON.stringify(bundle)}>
                    <td className="px-6 py-4 font-semibold text-primary-700">Bundle</td>
                    <td className="px-6 py-4 font-semibold">{bundle.name}</td>
                    <td className="px-6 py-4 whitespace-pre-line break-words max-w-xs align-top">{bundle.description}</td>
                    <td className="px-6 py-4">{bundle.serviceIds.map(getServiceName).join(', ')}</td>
                    <td className="px-6 py-4">{bundle.discountType === DiscountType.Fixed ? `€${bundle.discountValue}` : `${bundle.discountValue}%`}</td>
                    <td className="px-6 py-4">{bundle.startDate} - {bundle.endDate}</td>
                    <td className="px-6 py-4 text-xs text-gray-400">{bundle.lastModifiedAt ? new Date(bundle.lastModifiedAt).toLocaleString() : ''}</td>
                    <td className="px-6 py-4 text-right bg-blue-100 whitespace-nowrap">
                      <button
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                        onClick={() => { setEditBundle(bundle); setShowEditModal(true); }}
                      >Edit</button>
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        onClick={async () => {
                          if (window.confirm(`Delete bundle '${bundle.name}'?`)) {
                            await remove(ref(db, `bundles/${bundle.id}`));
                            setBundles(bundles.filter(b => b.id !== bundle.id));
                          }
                        }}
                      >Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Add Bundle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-lg relative">
            <h2 className="text-xl font-bold mb-4">Add New Bundle</h2>
            <form onSubmit={async e => {
              e.preventDefault();
              setAddError('');
              if (!newBundle.name || !newBundle.serviceIds.length || !newBundle.startDate || !newBundle.endDate) {
                setAddError('Please fill all required fields.');
                return;
              }
              try {
                const bundleRef = push(ref(db, 'bundles'));
                await update(bundleRef, {
                  ...newBundle,
                  lastModifiedAt: serverTimestamp()
                });
                setShowAddModal(false);
                setNewBundle({ name: '', description: '', serviceIds: [], discountType: DiscountType.Fixed, discountValue: 0, startDate: '', endDate: '' });
                setAddError('');
                // Refresh bundles
                const bundlesSnapshot = await get(ref(db, 'bundles'));
                if (bundlesSnapshot.exists()) {
                  const data = bundlesSnapshot.val();
                  const list: Bundle[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                  setBundles(list);
                }
              } catch (err) {
                setAddError('Error adding bundle.');
              }
            }}>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input className="w-full border px-3 py-2 rounded" value={newBundle.name} onChange={e => setNewBundle({ ...newBundle, name: e.target.value })} required />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full border px-3 py-2 rounded" value={newBundle.description} onChange={e => setNewBundle({ ...newBundle, description: e.target.value })} />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Services *</label>
                <select multiple className="w-full border px-3 py-2 rounded" value={newBundle.serviceIds} onChange={e => setNewBundle({ ...newBundle, serviceIds: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) })} required>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Discount Type</label>
                <select className="w-full border px-3 py-2 rounded" value={newBundle.discountType} onChange={e => setNewBundle({ ...newBundle, discountType: e.target.value })}>
                  <option value={DiscountType.Fixed}>Fixed</option>
                  <option value={DiscountType.Percentage}>Percentage</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Discount Value</label>
                <input type="number" className="w-full border px-3 py-2 rounded" value={newBundle.discountValue} onChange={e => setNewBundle({ ...newBundle, discountValue: Number(e.target.value) })} />
              </div>
              <div className="mb-2 flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input type="date" className="w-full border px-3 py-2 rounded" value={newBundle.startDate} onChange={e => setNewBundle({ ...newBundle, startDate: e.target.value })} required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input type="date" className="w-full border px-3 py-2 rounded" value={newBundle.endDate} onChange={e => setNewBundle({ ...newBundle, endDate: e.target.value })} required />
                </div>
              </div>
              {addError && <div className="text-red-600 text-sm mb-2">{addError}</div>}
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="px-4 py-2 bg-gray-300 rounded" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Add Bundle</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Bundle Modal */}
      {showEditModal && editBundle && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-lg relative">
            <h2 className="text-xl font-bold mb-4">Edit Bundle</h2>
            <form onSubmit={async e => {
              e.preventDefault();
              setEditError('');
              if (!editBundle.name || !editBundle.serviceIds.length || !editBundle.startDate || !editBundle.endDate) {
                setEditError('Please fill all required fields.');
                return;
              }
              try {
                await update(ref(db, `bundles/${editBundle.id}`), {
                  ...editBundle,
                  lastModifiedAt: serverTimestamp()
                });
                setShowEditModal(false);
                setEditBundle(null);
                setEditError('');
                // Refresh bundles
                const bundlesSnapshot = await get(ref(db, 'bundles'));
                if (bundlesSnapshot.exists()) {
                  const data = bundlesSnapshot.val();
                  const list: Bundle[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                  setBundles(list);
                }
              } catch (err) {
                setEditError('Error updating bundle.');
              }
            }}>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input className="w-full border px-3 py-2 rounded" value={editBundle.name} onChange={e => setEditBundle({ ...editBundle, name: e.target.value })} required />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full border px-3 py-2 rounded" value={editBundle.description} onChange={e => setEditBundle({ ...editBundle, description: e.target.value })} />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Services *</label>
                <select multiple className="w-full border px-3 py-2 rounded" value={editBundle.serviceIds} onChange={e => setEditBundle({ ...editBundle, serviceIds: Array.from((e.target as HTMLSelectElement).selectedOptions, o => o.value) })} required>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Discount Type</label>
                <select className="w-full border px-3 py-2 rounded" value={editBundle.discountType} onChange={e => setEditBundle({ ...editBundle, discountType: e.target.value })}>
                  <option value={DiscountType.Fixed}>Fixed</option>
                  <option value={DiscountType.Percentage}>Percentage</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Discount Value</label>
                <input type="number" className="w-full border px-3 py-2 rounded" value={editBundle.discountValue} onChange={e => setEditBundle({ ...editBundle, discountValue: Number(e.target.value) })} />
              </div>
              <div className="mb-2 flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input type="date" className="w-full border px-3 py-2 rounded" value={editBundle.startDate} onChange={e => setEditBundle({ ...editBundle, startDate: e.target.value })} required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input type="date" className="w-full border px-3 py-2 rounded" value={editBundle.endDate} onChange={e => setEditBundle({ ...editBundle, endDate: e.target.value })} required />
                </div>
              </div>
              {editError && <div className="text-red-600 text-sm mb-2">{editError}</div>}
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" className="px-4 py-2 bg-gray-300 rounded" onClick={() => { setShowEditModal(false); setEditBundle(null); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Update Bundle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundledPricingManager;
