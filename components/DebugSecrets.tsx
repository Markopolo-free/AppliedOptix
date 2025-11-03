// DebugSecrets.tsx - Temporary component to view stored secrets
// Remove this file in production

import React, { useState, useEffect } from 'react';
import { getSecrets, saveSecret } from './secretsService';

const DebugSecrets: React.FC = () => {
  const [secrets, setSecrets] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const refreshSecrets = () => {
    setSecrets(getSecrets());
  };

  useEffect(() => {
    refreshSecrets();
  }, []);

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      saveSecret({ username, password });
      setUsername('');
      setPassword('');
      refreshSecrets();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-red-500 p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold text-red-600 mb-2">DEBUG: Stored Secrets</h3>
      
      {/* Add Secret Form */}
      <form onSubmit={handleAddSecret} className="mb-3 pb-3 border-b border-gray-300">
        <div className="text-xs mb-2">
          <input
            type="text"
            placeholder="Username/Email"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-2 py-1 border rounded mb-1"
          />
          <input
            type="text"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-2 py-1 border rounded mb-1"
          />
          <button type="submit" className="w-full px-2 py-1 bg-red-500 text-white rounded text-xs">
            Add Secret
          </button>
        </div>
      </form>

      <div className="text-xs max-h-60 overflow-auto">
        {secrets.length === 0 ? (
          <p className="text-gray-500">No secrets stored. Add one above or register.</p>
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
