import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * Example component showing how to use the notification system
 * 
 * This demonstrates:
 * 1. How to trigger manual notifications
 * 2. How to use the notification context
 * 3. How notifications appear on screen
 */
export const NotificationExample: React.FC = () => {
  const { addNotification } = useNotifications();

  const handleSuccessNotification = () => {
    addNotification({
      title: 'Success',
      body: 'Operation completed successfully',
    });
  };

  const handleWarningNotification = () => {
    addNotification({
      title: 'Warning',
      body: 'Please review your input before proceeding',
    });
  };

  const handleErrorNotification = () => {
    addNotification({
      title: 'Error',
      body: 'Something went wrong. Please try again.',
    });
  };

  const handleCustomNotification = () => {
    addNotification({
      title: 'Campaign Created',
      body: 'New campaign "Summer 2025" has been created',
      data: {
        campaignId: 'campaign_123',
        type: 'campaign_alert',
      },
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Notification System Examples</h2>
      
      <section style={{ marginBottom: '30px' }}>
        <h3>Push Notifications (FCM)</h3>
        <p>
          Push notifications are handled automatically by the service worker and NotificationContext.
          When your backend sends a push notification via Firebase Cloud Messaging, it will
          automatically appear on screen as a toast notification.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3>In-App Notifications</h3>
        <p>You can also trigger notifications programmatically:</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={handleSuccessNotification}
            style={{
              padding: '10px 15px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Success Notification
          </button>

          <button
            onClick={handleWarningNotification}
            style={{
              padding: '10px 15px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Warning Notification
          </button>

          <button
            onClick={handleErrorNotification}
            style={{
              padding: '10px 15px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Error Notification
          </button>

          <button
            onClick={handleCustomNotification}
            style={{
              padding: '10px 15px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Custom Notification
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h3>Usage in Your Components</h3>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            overflowX: 'auto',
          }}
        >
{`import { useNotifications } from '../contexts/NotificationContext';

export const MyComponent = () => {
  const { addNotification } = useNotifications();

  const handleSave = async () => {
    try {
      // Your save logic here
      addNotification({
        title: 'Success',
        body: 'Changes saved successfully',
      });
    } catch (error) {
      addNotification({
        title: 'Error',
        body: 'Failed to save changes',
      });
    }
  };

  return <button onClick={handleSave}>Save</button>;
};`}
        </pre>
      </section>

      <section>
        <h3>Backend Integration Example</h3>
        <p>Send notifications from your backend:</p>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            overflowX: 'auto',
          }}
        >
{`// Node.js/Firebase Admin SDK
const admin = require('firebase-admin');

async function notifyStaff() {
  const message = {
    notification: {
      title: 'New Campaign Alert',
      body: 'Campaign "Summer 2025" is now live',
    },
    data: {
      campaignId: 'campaign_123',
      type: 'campaign_alert',
    },
    topic: 'staff-notifications', // Send to all subscribed users
  };

  try {
    await admin.messaging().send(message);
    console.log('Notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

notifyStaff();`}
        </pre>
      </section>
    </div>
  );
};

export default NotificationExample;
