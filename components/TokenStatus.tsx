import React, { useEffect, useState } from 'react';
import { getNotificationPermissionStatus } from '../services/notificationService';

const TokenStatus: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermissionStatus());
    try {
      const t = localStorage.getItem('fcm_token');
      setToken(t);
      const email = localStorage.getItem('user_email');
      setUserEmail(email);
    } catch (_) {
      setToken(null);
      setUserEmail(null);
    }
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 40 }}>
      <div className="bg-white/90 backdrop-blur border border-gray-300 rounded-md shadow px-3 py-2 text-xs text-gray-700">
        <div className="font-semibold mb-1">Notification Status</div>
        <div>Permission: <span className="font-mono">{permission}</span></div>
        <div>User: <span className="font-mono">{userEmail || 'not logged in'}</span></div>
        <div>Token: <span className="font-mono">{token ? 'present' : 'none'}</span></div>
      </div>
    </div>
  );
};

export default TokenStatus;
