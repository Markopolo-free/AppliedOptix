// DebugSecrets.tsx - Temporary component to view stored secrets
// Remove this file in production

import React, { useState, useEffect } from 'react';
import { getSecrets } from './secretsService';

const DebugSecrets: React.FC = () => {
  const [secrets, setSecrets] = useState<any[]>([]);

  useEffect(() => {
    setSecrets(getSecrets());
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-red-500 p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold text-red-600 mb-2">DEBUG: Stored Secrets</h3>
      <div className="text-xs max-h-60 overflow-auto">
        {secrets.length === 0 ? (
          <p className="text-gray-500">No secrets stored</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="pr-2">Username</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((s, i) => (
                <tr key={i} className="border-b">
                  <td className="pr-2 py-1">{s.username}</td>
                  <td className="py-1 font-mono">{s.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DebugSecrets;
