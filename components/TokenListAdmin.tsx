import React, { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

// Uses existing env-configured firebase from window.__FIREBASE_CONFIG__ if available
function getFirebaseConfig(): any {
  return firebaseConfig;
}

type TokenRecord = {
  userEmail?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

export default function TokenListAdmin(): JSX.Element {
  const [tokens, setTokens] = useState<Array<{ token: string; data: TokenRecord }>>([]);
  const [emailFilter, setEmailFilter] = useState('');

  useEffect(() => {
    const app = getApps()[0] || initializeApp(getFirebaseConfig());
    const db = getDatabase(app);
    const tokensRef = ref(db, 'fcmTokens');
    const unsub = onValue(tokensRef, (snap) => {
      const val = snap.val() || {};
      const rows: Array<{ token: string; data: TokenRecord }> = Object.keys(val).map((t) => ({ token: t, data: val[t] }));
      setTokens(rows);
    });
    // onValue returns an unsubscribe function in Web v9 compat; in modular SDK, we rely on off via ref
    return () => {
      try { (unsub as any)?.(); } catch {}
    };
  }, []);

  const filtered = tokens.filter((r) => {
    const e = (r.data.userEmail || '').toLowerCase();
    const f = emailFilter.trim().toLowerCase();
    return !f || e.includes(f);
  });

  return (
    <div style={{ padding: 16 }}>
      <h2>FCM Tokens</h2>
      <div style={{ marginBottom: 12 }}>
        <input
          type="email"
          placeholder="Filter by email"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          style={{ width: '100%', maxWidth: 420 }}
        />
      </div>
      <div>
        <strong>Total:</strong> {tokens.length} &nbsp; <strong>Filtered:</strong> {filtered.length}
      </div>
      <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Token</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.token}>
              <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{row.data.userEmail || ''}</td>
              <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{row.token}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={2} style={{ padding: 12, color: '#666' }}>No tokens found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
