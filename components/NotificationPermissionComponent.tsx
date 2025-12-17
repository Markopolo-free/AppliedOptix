import React, { useEffect, useState } from 'react';
import {
  requestNotificationPermission,
  isNotificationSupported,
  getNotificationPermissionStatus,
  saveTokenToDatabase,
  getFCMToken,
  initNotifications,
} from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

interface NotificationPermissionComponentProps {
  onPermissionGranted?: (token: string | null) => void;
}

export const NotificationPermissionComponent: React.FC<NotificationPermissionComponentProps> = ({
  onPermissionGranted,
}) => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<NotificationPermission>(getNotificationPermissionStatus());
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  // Check support on mount
  useEffect(() => {
    (async () => {
      const isSupported = await isNotificationSupported();
      setSupported(isSupported);
    })();
  }, []);

  // If permission is already granted, ensure the token exists and is saved with the user's email
  useEffect(() => {
    if (status === 'granted' && supported) {
      (async () => {
        try {
          // Ensure messaging is initialized before attempting to fetch token
          await initNotifications();
          let token = localStorage.getItem('fcm_token');
          if (!token) {
            token = await getFCMToken();
          }
          if (token) {
            await saveTokenToDatabase(token, currentUser?.email || undefined);
          }
        } catch (e) {
          console.warn('Auto-sync of FCM token failed:', e);
        }
      })();
    }
  }, [status, currentUser?.email, supported]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const isSupported = await isNotificationSupported();
      if (!isSupported) {
        setError('Notifications are not supported in this browser');
        return;
      }
      
      const token = await requestNotificationPermission();
      setStatus(getNotificationPermissionStatus());

      if (token) {
        console.log('Successfully enabled notifications');
        // Save token with user mapping for backend sends
        await saveTokenToDatabase(token, currentUser?.email || undefined);
        onPermissionGranted?.(token);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable notifications';
      setError(errorMessage);
      console.error('Error requesting notification permission:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (supported === null) {
    return null; // Still checking support
  }

  if (!supported) {
    return null; // Browser doesn't support notifications
  }

  if (status === 'granted') {
    return (
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#d4edda',
        color: '#155724',
        borderRadius: '4px',
        fontSize: '14px',
        marginBottom: '10px',
      }}>
        ✓ Push notifications enabled
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '4px',
        fontSize: '14px',
        marginBottom: '10px',
      }}>
        ✗ Push notifications are blocked. Please enable them in your browser settings.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '15px' }}>
      <button
        onClick={handleRequestPermission}
        disabled={isLoading}
        style={{
          padding: '8px 15px',
          backgroundColor: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          fontSize: '14px',
        }}
      >
        {isLoading ? 'Enabling...' : 'Enable Push Notifications'}
      </button>
      {error && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          Error: {error}
        </div>
      )}
    </div>
  );
};
