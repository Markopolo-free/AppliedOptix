
import React, { useState, useEffect, Suspense } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';
const ChartLazy = React.lazy(() => import('./ChartLazy'));

interface EntityCount {
  label: string;
  count: number;
  color: string;
}

const StatCard: React.FC<{ title: string; value: number; color: string }> = ({ title, value, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className={`mt-2 text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [entityCounts, setEntityCounts] = useState<EntityCount[]>([]);

  useEffect(() => {
    fetchAllCounts();
  }, []);

  const fetchAllCounts = async () => {
    try {
      setLoading(true);
      
      // Fetch counts from all collections
      const [
        usersSnap,
        servicesSnap,
        pricingRulesSnap,
        pricingZonesSnap,
        campaignsSnap,
        fxCampaignsSnap,
        fxDiscountGroupsSnap,
        loyaltyProgramsSnap,
        bundlesSnap,
        userDiscountGroupsSnap
      ] = await Promise.all([
        get(ref(db, 'users')),
        get(ref(db, 'services')),
        get(ref(db, 'pricingRules')),
        get(ref(db, 'referenceZones')),
        get(ref(db, 'campaigns')),
        get(ref(db, 'fxCampaigns')),
        get(ref(db, 'fxDiscountOptions')),
        get(ref(db, 'loyaltyPrograms')),
        get(ref(db, 'bundles')),
        get(ref(db, 'userDiscountGroups'))
      ]);

      // Count records
      const usersCount = usersSnap.exists() ? Object.keys(usersSnap.val()).length : 0;
      const servicesCount = servicesSnap.exists() ? Object.keys(servicesSnap.val()).length : 0;
      const pricingRulesCount = pricingRulesSnap.exists() ? Object.keys(pricingRulesSnap.val()).length : 0;
      const pricingZonesCount = pricingZonesSnap.exists() ? Object.keys(pricingZonesSnap.val()).length : 0;
      const campaignsCount = campaignsSnap.exists() ? Object.keys(campaignsSnap.val()).length : 0;
      const fxCampaignsCount = fxCampaignsSnap.exists() ? Object.keys(fxCampaignsSnap.val()).length : 0;
      const fxDiscountGroupsCount = fxDiscountGroupsSnap.exists() ? Object.keys(fxDiscountGroupsSnap.val()).length : 0;
      const userDiscountGroupsCount = userDiscountGroupsSnap.exists() ? Object.keys(userDiscountGroupsSnap.val()).length : 0;
      const loyaltyProgramsCount = loyaltyProgramsSnap.exists() ? Object.keys(loyaltyProgramsSnap.val()).length : 0;
      const bundledPricingCount = bundlesSnap.exists() ? Object.keys(bundlesSnap.val()).length : 0;

      console.log('Dashboard Counts:', {
        usersCount,
        servicesCount,
        pricingRulesCount,
        pricingZonesCount,
        campaignsCount,
        fxCampaignsCount,
        fxDiscountGroupsCount,
        loyaltyProgramsCount,
        bundledPricingCount,
        userDiscountGroupsCount
      });

      const counts: EntityCount[] = [
        { label: 'Users', count: usersCount, color: 'text-blue-600' },
        { label: 'Services', count: servicesCount, color: 'text-green-600' },
        { label: 'Pricing Rules', count: pricingRulesCount, color: 'text-purple-600' },
        { label: 'Pricing Zones', count: pricingZonesCount, color: 'text-indigo-600' },
        { label: 'Campaigns', count: campaignsCount, color: 'text-orange-600' },
        { label: 'FX Campaigns', count: fxCampaignsCount, color: 'text-pink-600' },
        { label: 'FX Discount Groups', count: fxDiscountGroupsCount, color: 'text-red-600' },
        { label: 'Loyalty Programs', count: loyaltyProgramsCount, color: 'text-teal-600' },
        { label: 'Bundled Pricing', count: bundledPricingCount, color: 'text-cyan-600' },
        { label: 'User Discount Groups', count: userDiscountGroupsCount, color: 'text-amber-600' },
      ];

      setEntityCounts(counts);
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data based on counts with dynamic scale
  const maxCount = Math.max(...entityCounts.map(e => e.count), 1);
  const chartData = entityCounts.map(entity => ({
    name: entity.label,
    count: entity.count
  }));

  return (
    <div className="relative pb-24">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Loading dashboard data...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {entityCounts.map((entity, index) => (
              <StatCard 
                key={entity.label}
                title={entity.label}
                value={entity.count}
                color={entity.color}
              />
            ))}
          </div>

          <div className="mt-8 bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">System Records Overview</h2>
            <div style={{ width: '100%', height: 400 }}>
              <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading chart…</div>}>
                <ChartLazy data={chartData} maxValue={maxCount} />
              </Suspense>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 flex justify-end">
        <img src="/logo.jpg" alt="Adaptive Optix Logo" className="h-32 w-auto opacity-90" />
      </div>
    </div>
  );
};

export default Dashboard;
