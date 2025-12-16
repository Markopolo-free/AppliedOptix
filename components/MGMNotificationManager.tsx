import React, { useEffect, useMemo, useState } from 'react';
import { ref, get, push, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

interface FXCampaign {
  id: string;
  name: string;
  description: string;
  countryId?: string;
  serviceTypes?: string[]; // derived from services
  currency?: string;
  discountAmountType?: string;
  discountAmount?: number;
  startDate?: string;
  endDate?: string;
  qualifyStartDate?: string;
  qualifyEndDate?: string;
  rewardAvailableFrom?: string;
}

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

const MGMNotificationManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [campaigns, setCampaigns] = useState<FXCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const snap = await get(ref(db, 'fxCampaigns'));
        const val = snap.val() || {};
        const list: FXCampaign[] = Object.entries(val).map(([id, c]: any) => ({
          id,
          ...c,
          // Normalize discount amount type from FX Campaign records
          discountAmountType: c.discountAmountType || c.discountType || '',
        }));
        setCampaigns(list);
      } catch (e) {
        console.error('Error loading FX campaigns', e);
      }
    };
    loadCampaigns();

    // Listen for MGM push messages in real-time
    const messagesRef = ref(db, 'mgmPushMessages');
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const val = snapshot.val() || {};
      const list = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
      // Sort by createdAt descending (newest first)
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotifications(list);
    });

    return () => unsubscribe();
  }, []);

  const selected = useMemo(() => campaigns.find(c => c.id === selectedCampaignId) || null, [campaigns, selectedCampaignId]);

  const generatedBody = useMemo(() => {
    if (!selected) return '';
    const lines = [
      `Campaign Name: ${selected.name}`,
      `Campaign Description: ${selected.description || ''}`,
      `Country: ${selected.countryId || ''}`,
      `Service Type: ${(selected as any).serviceItem || (selected.serviceTypes?.join(', ') || '')}`,
      `Currency: ${selected.currency || ''}`,
      `Discount Amount Type: ${selected.discountAmountType || ''}`,
      `Discount Amount: ${selected.discountAmount ?? ''}`,
      `Campaign Start: ${formatDate(selected.startDate)}`,
      `Campaign End: ${formatDate(selected.endDate)}`,
      `Qualifying Period Start: ${formatDate(selected.qualifyStartDate)}`,
      `Qualifying Period End: ${formatDate(selected.qualifyEndDate)}`,
      `Rewards Available From: ${formatDate(selected.rewardAvailableFrom)}`,
    ];
    return lines.join('\n');
  }, [selected]);

  useEffect(() => {
    if (generatedBody) setMessage(generatedBody);
  }, [generatedBody]);

  const handleSend = async () => {
    if (!selected) {
      setError('Please select a campaign');
      return;
    }
    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const nowIso = new Date().toISOString();

      // Write push request record (to be picked up by backend job or Cloud Function)
      const pushRef = ref(db, 'mgmPushMessages');
      const payload = {
        email: currentUser?.email || '',
        createdAt: nowIso,
        campaignId: selected.id,
        campaignName: selected.name,
        country: selected.countryId || '',
        serviceType: (selected as any).serviceItem || (selected.serviceTypes?.join(', ') || ''),
        currency: selected.currency || '',
        discountAmountType: selected.discountAmountType || '',
        discountAmount: selected.discountAmount ?? null,
        campaignStart: selected.startDate || null,
        campaignEnd: selected.endDate || null,
        qualifyStart: selected.qualifyStartDate || null,
        qualifyEnd: selected.qualifyEndDate || null,
        rewardsAvailableFrom: selected.rewardAvailableFrom || null,
        message: message,
        status: 'pending',
      };
      await push(pushRef, payload);

      // Audit record
      await logAudit({
        userId: currentUser?.email || 'unknown',
        userName: currentUser?.name || 'Unknown',
        userEmail: currentUser?.email || 'unknown@unknown',
        action: 'create',
        entityType: 'campaign',
        entityId: selected.id,
        entityName: selected.name,
        metadata: payload,
      });

      setSuccess('Push notification queued and audit recorded.');
    } catch (e) {
      console.error('Error sending MGM push:', e);
      setError('Failed to queue push notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sent/Pending Notifications List */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Push Notification History</h2>
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-sm">No notifications yet. Create one below to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left p-2 text-sm font-semibold">Status</th>
                  <th className="text-left p-2 text-sm font-semibold">Campaign</th>
                  <th className="text-left p-2 text-sm font-semibold">Created</th>
                  <th className="text-left p-2 text-sm font-semibold">Sent</th>
                  <th className="text-left p-2 text-sm font-semibold">Success</th>
                  <th className="text-left p-2 text-sm font-semibold">Failures</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif) => (
                  <React.Fragment key={notif.id}>
                    <tr 
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === notif.id ? null : notif.id)}
                    >
                      <td className="p-2">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                          notif.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notif.status || 'pending'}
                        </span>
                      </td>
                      <td className="p-2 text-sm">{notif.campaignName || '—'}</td>
                      <td className="p-2 text-sm text-gray-600">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="p-2 text-sm text-gray-600">
                        {notif.sentAt ? new Date(notif.sentAt).toLocaleString() : '—'}
                      </td>
                      <td className="p-2 text-sm text-green-600">{notif.success ?? '—'}</td>
                      <td className="p-2 text-sm text-red-600">{notif.failures ?? '—'}</td>
                    </tr>
                    {expandedId === notif.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4 border-b border-gray-200">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong className="text-gray-700">Country:</strong>
                              <p className="text-gray-600">{notif.country || '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Service Type:</strong>
                              <p className="text-gray-600">{notif.serviceType || '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Currency:</strong>
                              <p className="text-gray-600">{notif.currency || '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Discount Type:</strong>
                              <p className="text-gray-600">{notif.discountAmountType || '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Discount Amount:</strong>
                              <p className="text-gray-600">{notif.discountAmount ?? '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Campaign Start:</strong>
                              <p className="text-gray-600">{notif.campaignStart ? new Date(notif.campaignStart).toLocaleDateString() : '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Campaign End:</strong>
                              <p className="text-gray-600">{notif.campaignEnd ? new Date(notif.campaignEnd).toLocaleDateString() : '—'}</p>
                            </div>
                            <div>
                              <strong className="text-gray-700">Created By:</strong>
                              <p className="text-gray-600">{notif.email || '—'}</p>
                            </div>
                            <div className="col-span-2">
                              <strong className="text-gray-700">Message:</strong>
                              <pre className="mt-1 p-2 bg-white border rounded text-xs whitespace-pre-wrap">{notif.message || '—'}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compose New Notification */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Member-Get-Member (MGM) Push Notifications</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
          <input className="w-full py-2 px-3 border rounded-md" value={currentUser?.email || ''} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input className="w-full py-2 px-3 border rounded-md" value={new Date().toLocaleString()} readOnly />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select FX Campaign</label>
        <select
          className="w-full py-2 px-3 border rounded-md"
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
        >
          <option value="">-- Select Campaign --</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <input className="w-full py-2 px-3 border rounded-md" value={selected.name} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Description</label>
            <input className="w-full py-2 px-3 border rounded-md" value={selected.description || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input className="w-full py-2 px-3 border rounded-md" value={selected.countryId || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <input className="w-full py-2 px-3 border rounded-md" value={(selected as any).serviceItem || (selected.serviceTypes?.join(', ') || '')} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input className="w-full py-2 px-3 border rounded-md" value={selected.currency || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount Type</label>
            <input className="w-full py-2 px-3 border rounded-md" value={selected.discountAmountType || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount</label>
            <input className="w-full py-2 px-3 border rounded-md" value={String(selected.discountAmount ?? '')} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Start</label>
            <input className="w-full py-2 px-3 border rounded-md" value={formatDate(selected.startDate)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign End</label>
            <input className="w-full py-2 px-3 border rounded-md" value={formatDate(selected.endDate)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualifying Period Start</label>
            <input className="w-full py-2 px-3 border rounded-md" value={formatDate(selected.qualifyStartDate)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualifying Period End</label>
            <input className="w-full py-2 px-3 border rounded-md" value={formatDate(selected.qualifyEndDate)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rewards Available From</label>
            <input className="w-full py-2 px-3 border rounded-md" value={formatDate(selected.rewardAvailableFrom)} readOnly />
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea
          className="w-full py-2 px-3 border rounded-md h-40"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Edit the message if needed"
        />
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-4 text-green-600 text-sm">{success}</div>}

      <button
        onClick={handleSend}
        disabled={isSending}
        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-60"
      >
        {isSending ? 'Sending…' : 'Send Push Notification'}
      </button>
    </div>
    </div>
  );
};

export default MGMNotificationManager;
