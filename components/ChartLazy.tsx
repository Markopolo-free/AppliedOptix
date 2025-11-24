import React, { useEffect, useState } from 'react';

interface ChartProps {
  data: any[];
  maxValue?: number;
}

const ChartLazy: React.FC<ChartProps> = ({ data, maxValue }) => {
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

  // Check if this is the new dashboard data format (has 'count' field) or old format
  const isNewFormat = data.length > 0 && 'count' in data[0];

  if (isNewFormat) {
    // Calculate dynamic Y-axis domain based on max value
    const yAxisMax = maxValue ? Math.ceil(maxValue * 1.1) : 'auto'; // 10% padding

    // Add alternating colors to data
    const dataWithColors = data.map((item, index) => ({
      ...item,
      fill: index % 2 === 0 ? '#3b82f6' : '#eab308' // Alternate blue and yellow
    }));

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={dataWithColors}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={120}
            interval={0}
            style={{ fontSize: '12px' }}
          />
          <YAxis domain={[0, yAxisMax]} />
          <Tooltip />
          <Bar dataKey="count" name="Records" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Legacy format with multiple service types
  return (
    <ResponsiveContainer width="100%" height={400}>
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
