import React, { useEffect, useState } from 'react';

const ChartLazy: React.FC<{ data: any }> = ({ data }) => {
  const [R, setR] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    import('recharts')
      .then((mod) => {
        if (mounted) setR(mod);
      })
      .catch((err) => {
        console.error('Failed to load recharts dynamically:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!R) return <div className="h-96 flex items-center justify-center">Loading chart...</div>;

  const { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } = R;

  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="eCar" fill="#10b981" />
        <Bar dataKey="eBike" fill="#3b82f6" />
        <Bar dataKey="Train" fill="#f97316" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ChartLazy;
