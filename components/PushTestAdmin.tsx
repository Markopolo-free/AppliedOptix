import React, { useEffect, useState } from 'react';
import { ref, get, push } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface TokenEntry {
  token: string;
  userEmail?: string | null;
}

const PushTestAdmin: React.FC = () => {
  const { currentUser } = useAuth();
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      try {
        const snap = await get(ref(db, 'fcmTokens'));
        const val = snap.val() || {};
        const list: TokenEntry[] = Object.entries(val).map(([token, meta]: any) => ({ token, userEmail: meta?.userEmail ?? null }));
        setTokens(list);
      } catch (e) {
        console.error('Failed to load FCM tokens', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTokens();
  }, []);

  const enqueueTestPush = async (targetToken?: string) => {
    try {
      const payload = {
        email: currentUser?.email || '',
        createdAt: new Date().toISOString(),
        campaignId: 'test',
        campaignName: 'Test Push',
        country: 'N/A',
        serviceType: 'N/A',
        currency: 'N/A',
        discountAmountType: 'N/A',
        discountAmount: null,
        campaignStart: null,
        campaignEnd: null,
        qualifyStart: null,
        qualifyEnd: null,
        rewardsAvailableFrom: null,
        message: targetToken ? `Test push to token ${targetToken}` : 'Broadcast test push to all tokens',
        status: 'pending',
        targetToken: targetToken || null,
      };
      await push(ref(db, 'mgmPushMessages'), payload);
      setStatus('Queued test push successfully. Run the processor to send.');
    } catch (e) {
      console.error('Failed to enqueue test push', e);
      setStatus('Failed to enqueue test push.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Push Test Admin</h2>
      <div className="mb-4">
        <button
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          onClick={() => enqueueTestPush(undefined)}
        >
          Queue Broadcast Test Push
        </button>
      </div>

      <div className="mb-2 text-sm text-gray-600">Saved tokens: {tokens.length}</div>
      {isLoading ? (
        <div>Loading tokens…</div>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div key={t.token} className="flex items-center justify-between border rounded-md p-2">
              <div className="text-xs break-all">
                <div><strong>Token:</strong> {t.token}</div>
                <div><strong>User:</strong> {t.userEmail || 'Unknown'}</div>
              </div>
              <button
                className="ml-4 px-3 py-1 bg-gray-800 text-white rounded hover:bg-black text-xs"
                onClick={() => enqueueTestPush(t.token)}
              >
                Queue Test to This Token
              </button>
            </div>
          ))}
        </div>
      )}

      {status && <div className="mt-4 text-sm">{status}</div>}
    </div>
  );
};

export default PushTestAdmin;
