
import React, { Suspense } from 'react';
const ChartLazy = React.lazy(() => import('./ChartLazy'));

const data = [
  { name: 'Mon', 'eCar': 400, 'eBike': 240, 'Train': 180 },
  { name: 'Tue', 'eCar': 300, 'eBike': 139, 'Train': 250 },
  { name: 'Wed', 'eCar': 200, 'eBike': 980, 'Train': 310 },
  { name: 'Thu', 'eCar': 278, 'eBike': 390, 'Train': 200 },
  { name: 'Fri', 'eCar': 189, 'eBike': 480, 'Train': 400 },
  { name: 'Sat', 'eCar': 239, 'eBike': 380, 'Train': 600 },
  { name: 'Sun', 'eCar': 349, 'eBike': 430, 'Train': 550 },
];

const StatCard: React.FC<{ title: string; value: string; change: string; isPositive: boolean }> = ({ title, value, change, isPositive }) => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    <p className={`mt-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? '▲' : '▼'} {change} vs last week
    </p>
  </div>
);

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value="1,245" change="12.5%" isPositive={true} />
        <StatCard title="Active Campaigns" value="18" change="2" isPositive={true} />
        <StatCard title="Total Revenue (EUR)" value="€86,540" change="8.2%" isPositive={true} />
        <StatCard title="Service Usage" value="9,876 trips" change="3.1%" isPositive={false} />
      </div>

      <div className="mt-8 bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Weekly Service Usage</h2>
        <div style={{ width: '100%', height: 400 }}>
          <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading chart…</div>}>
            <ChartLazy data={data} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
