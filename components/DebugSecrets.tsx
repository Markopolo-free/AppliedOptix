// DebugSecrets.tsx - Temporary component to view stored secrets
// Remove this file in production

import React, { useState, useEffect } from 'react';
import { getSecrets, saveSecret } from './secretsService';

const DebugSecrets: React.FC = () => {
  const [secrets, setSecrets] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

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
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-red-600">DEBUG: Stored Secrets</h3>
        <button
          onClick={() => setShowPasswords(!showPasswords)}
          className="text-gray-600 hover:text-gray-800"
          title={showPasswords ? "Hide passwords" : "Show passwords"}
        >
          {showPasswords ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      
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
                  <td className="py-1 font-mono">{showPasswords ? s.password : '••••••••'}</td>
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
