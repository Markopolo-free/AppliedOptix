import React, { useState, useEffect } from 'react';
import { ref, get, update, remove, push, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import { Bundle, DiscountType, Service } from '../types';

const BundledPricingManager: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BundledPricingManager;
