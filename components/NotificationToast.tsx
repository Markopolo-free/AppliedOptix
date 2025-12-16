import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

export const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        maxWidth: '400px',
      }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          style={{
            marginBottom: '10px',
            padding: '15px',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
            }}
          >
            <div style={{ flex: 1 }}>
              <h4
                style={{
                  margin: '0 0 5px 0',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#333',
                }}
              >
                {notification.title}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#666',
                }}
              >
                {notification.body}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                marginLeft: '10px',
                color: '#999',
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
