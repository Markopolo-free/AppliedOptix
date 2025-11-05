// DebugSecrets.tsx - Temporary component to view stored secrets
// Remove this file in production

import React, { useState, useEffect } from 'react';
import { getTestCredentials } from '../services/testCredentialsService';
import { getAllUsers } from './userManagementService';
import { User } from '../types';

const DebugSecrets: React.FC = () => {
  const [secrets, setSecrets] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonContent, setJsonContent] = useState('');

  const refreshSecrets = () => {
    setSecrets(getTestCredentials());
    const jsonData = {
      credentials: getTestCredentials()
    };
    setJsonContent(JSON.stringify(jsonData, null, 2));
  };

  const refreshUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  useEffect(() => {
    refreshSecrets();
    refreshUsers();
  }, []);

  const copyJsonToClipboard = () => {
    navigator.clipboard.writeText(jsonContent);
    alert('JSON copied to clipboard! Paste it into test-credentials.json');
  };

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const dragRef = React.useRef<HTMLDivElement>(null);

  // Touch/mouse drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    e.stopPropagation();
  };
  const handleDragEnd = () => setDragging(false);
  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    let clientX = 0, clientY = 0;
    if ('touches' in e && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    setPos({ x: clientX, y: clientY });
  };
  useEffect(() => {
    if (!dragging) return;
    const move = (e: any) => handleDragMove(e);
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  // Initial position: bottom right, but allow drag
  const style = dragging || pos.x || pos.y
    ? { position: 'fixed', left: pos.x ? pos.x : undefined, top: pos.y ? pos.y : undefined, zIndex: 50, maxWidth: '32rem', maxHeight: '80vh', overflowY: 'auto' }
    : { position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 50, maxWidth: '32rem', maxHeight: '80vh', overflowY: 'auto' };

  return (
    <div ref={dragRef} style={style} className="bg-white border-2 border-red-500 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-2 cursor-move" onMouseDown={handleDragStart} onTouchStart={handleDragStart} onMouseUp={handleDragEnd} onTouchEnd={handleDragEnd}>
        <h3 className="font-bold text-red-600 select-none">DEBUG: Test Credentials & Users</h3>
        <div className="flex gap-2">
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
      </div>

      {/* JSON Editor Section */}
      <div className="mb-3 pb-3 border-b border-gray-300">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-sm">test-credentials.json</h4>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showJsonEditor ? 'Hide' : 'Edit'} JSON
            </button>
            <button
              onClick={copyJsonToClipboard}
              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Copy JSON
            </button>
          </div>
        </div>
        {showJsonEditor && (
          <div>
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="w-full h-32 text-xs font-mono p-2 border rounded bg-gray-50"
              spellCheck={false}
            />
            <p className="text-xs text-gray-600 mt-1">
              Copy this JSON and paste it into your local <code className="bg-gray-100 px-1">test-credentials.json</code> file.
            </p>
          </div>
        )}
      </div>

      {/* Test Credentials Table */}
      <div className="mb-3 pb-3 border-b border-gray-300">
        <h4 className="font-semibold text-sm mb-2">Test Credentials ({secrets.length})</h4>
        <div className="text-xs max-h-40 overflow-auto">
          {secrets.length === 0 ? (
            <p className="text-gray-500">No test credentials found.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="pr-2 py-1">Username</th>
                  <th className="py-1">Password</th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="pr-2 py-1">{s.username}</td>
                    <td className="py-1 font-mono">{showPasswords ? s.password : '••••••••'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* All Users Table */}
      <div>
        <h4 className="font-semibold text-sm mb-2">All Users in User Management ({users.length})</h4>
        <div className="text-xs max-h-60 overflow-auto">
          {users.length === 0 ? (
            <p className="text-gray-500">No users found in database.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="pr-2 py-1">Name</th>
                  <th className="pr-2 py-1">Email</th>
                  <th className="py-1">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="pr-2 py-1">{user.name}</td>
                    <td className="pr-2 py-1">{user.email}</td>
                    <td className="py-1">
                      <span className={`px-1 text-xs rounded ${
                        user.role === 'Administrator' ? 'bg-red-100 text-red-800' :
                        user.role === 'Maker' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'Checker' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugSecrets;
