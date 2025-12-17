import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { ref, onValue, push, set, get } from 'firebase/database';
import { getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const ReferralCodeManager: React.FC = () => {
  const [referralCodes, setReferralCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendToEmail, setSendToEmail] = useState('');
  const [sendFromEmail, setSendFromEmail] = useState('');
  const [selectedCode, setSelectedCode] = useState<any | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);
  const [invitationEvents, setInvitationEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'all' | 'sent' | 'delivered' | 'bounced' | 'deferred' | 'opened' | 'clicked'>('all');
  
  // Form state
  const [memberEmail, setMemberEmail] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [maxUses, setMaxUses] = useState('');
  
  // FX Campaigns state
  const [fxCampaigns, setFxCampaigns] = useState<any[]>([]);
  const [selectedCampaignNumber, setSelectedCampaignNumber] = useState('');

  useEffect(() => {
    try { Modal.setAppElement('#root'); } catch { try { Modal.setAppElement('body'); } catch {} }
    const app = getApps()[0];
    const db = getDatabase(app);

    const codesRef = ref(db, 'referralCodes');
    const unsubscribe = onValue(codesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const codesArray = Object.entries(data).map(([id, code]: [string, any]) => ({
          id,
          ...code,
        }));
        // Sort by creation date, newest first
        codesArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReferralCodes(codesArray);
      } else {
        setReferralCodes([]);
      }
      setLoading(false);
    });

    // Fetch FX Campaigns
    const campaignsRef = ref(db, 'fxCampaigns');
    const unsubscribeCampaigns = onValue(campaignsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const campaignsList = Object.entries(data).map(([id, campaign]: [string, any]) => ({
          id,
          ...campaign,
        }));
        // Sort by campaign number
        campaignsList.sort((a, b) => (a.campaignNumber || '').localeCompare(b.campaignNumber || ''));
        setFxCampaigns(campaignsList);
      } else {
        setFxCampaigns([]);
      }
    });

    // Subscribe to recent invitations
    const invitesRef = ref(db, 'referralInvitations');
    const unInvites = onValue(invitesRef, (snap) => {
      const v = snap.val();
      const list = v ? Object.entries(v).map(([id, val]: [string, any]) => ({ id, ...val })) : [];
      list.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());
      setInvitations(list.slice(0, 50));
    });

    return () => { unsubscribe(); unsubscribeCampaigns(); unInvites(); };
  }, []);

  const generateReferralCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const emailValid = (e: string) => /.+@.+\..+/.test(e);

  const openSendModal = (code: any) => {
    setSelectedCode(code);
    setSendToEmail('');
    try {
      // Prefill from localStorage or Vite env if available
      const saved = localStorage.getItem('referral_from_email') || '';
      // @ts-ignore Vite env available at runtime
      const viteDefault = (import.meta as any)?.env?.VITE_FROM_EMAIL || '';
      setSendFromEmail(saved || viteDefault || '');
    } catch {
      setSendFromEmail('');
    }
    setSendError(null);
    setSendSuccess(false);
    setSendModalOpen(true);
  };

  const closeSendModal = () => {
    if (sending) return;
    setSendModalOpen(false);
  };

  const handleSendEmail = async () => {
    if (!selectedCode) return;
    if (!emailValid(sendToEmail)) {
      setSendError('Please enter a valid email address.');
      return;
    }
    if (sendFromEmail && !emailValid(sendFromEmail)) {
      setSendError('Please enter a valid From email, or leave it blank.');
      return;
    }
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const res = await fetch('/api/referrals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: selectedCode.code, to: sendToEmail, from: sendFromEmail || undefined }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const details = typeof j.details === 'string'
          ? j.details
          : Array.isArray(j.details?.errors)
            ? j.details.errors.map((x: any) => x?.message).filter(Boolean).join('; ')
            : '';
        const msg = [j.error, details].filter(Boolean).join(': ');
        throw new Error(msg || 'Failed to send email');
      }
      setSendSuccess(true);
      try { if (sendFromEmail) localStorage.setItem('referral_from_email', sendFromEmail); } catch {}
    } catch (e: any) {
      setSendError(e?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const openEventsModal = async (inv: any) => {
    setSelectedInvitation(inv);
    setInvitationEvents([]);
    setEventsModalOpen(true);
    if (!inv?.messageId) return; // Older records may not have messageId
    setEventsLoading(true);
    try {
      const app = getApps()[0];
      const db = getDatabase(app);
      const evSnap = await get(ref(db, `sendgridEvents/${inv.messageId}`));
      if (evSnap.exists()) {
        const v = evSnap.val();
        const items = Object.entries(v).map(([id, val]: [string, any]) => ({ id, ...(val as any) }));
        items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setInvitationEvents(items);
      } else {
        setInvitationEvents([]);
      }
    } catch (e) {
      setInvitationEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const closeEventsModal = () => {
    setEventsModalOpen(false);
    setSelectedInvitation(null);
    setInvitationEvents([]);
  };

  const handleGenerateCode = async () => {
    if (!memberEmail || !campaignName || !welcomeMessage) {
      alert('Please fill in member email, campaign name, and welcome message');
      return;
    }

    if (!discountAmount || parseFloat(discountAmount) <= 0) {
      alert('Please enter a valid discount amount');
      return;
    }

    setGenerating(true);

    try {
      const app = getApps()[0];
      const db = getDatabase(app);

      // Generate unique code
      let code = generateReferralCode();
      let isUnique = false;
      
      while (!isUnique) {
        const codeRef = ref(db, `referralCodes/${code}`);
        const snapshot = await get(codeRef);
        if (!snapshot.exists()) {
          isUnique = true;
        } else {
          code = generateReferralCode();
        }
      }

      const referralData = {
        code,
        memberEmail,
        campaignName,
        discountAmount: parseFloat(discountAmount),
        discountType,
        welcomeMessage,
        maxUses: maxUses ? parseInt(maxUses) : null,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        status: 'active',
        referrals: [],
        fxCampaignNumber: selectedCampaignNumber || null, // Link to FX Campaign
      };

      const codeRef = ref(db, `referralCodes/${code}`);
      await set(codeRef, referralData);

      // Create audit log
      const auditRef = push(ref(db, 'auditLogs'));
      await set(auditRef, {
        action: 'create',
        entityType: 'referralCode',
        entityId: code,
        timestamp: new Date().toISOString(),
        userEmail: memberEmail,
        changes: referralData,
      });

      alert(`Referral code generated: ${code}\n\nShare this code with potential new members!`);

      // Copy code to clipboard
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(code);
          console.log('Code copied to clipboard');
        } catch (err) {
          console.log('Could not copy to clipboard');
        }
      }

      // Reset form
      setMemberEmail('');
      setCampaignName('');
      setDiscountAmount('');
      setWelcomeMessage('');
      setMaxUses('');
      setSelectedCampaignNumber('');
    } catch (error) {
      console.error('Error generating referral code:', error);
      alert('Failed to generate referral code');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadgeColor = (code: any) => {
    if (code.status === 'inactive') return '#999';
    if (code.maxUses && code.usedCount >= code.maxUses) return '#e74c3c';
    if (code.usedCount > 0) return '#3498db';
    return '#2ecc71';
  };

  const getStatusText = (code: any) => {
    if (code.status === 'inactive') return 'Inactive';
    if (code.maxUses && code.usedCount >= code.maxUses) return 'Maxed Out';
    if (code.usedCount > 0) return 'Active (Used)';
    return 'Active (Unused)';
  };

  const getSendStatsForCode = (codeVal: string) => {
    const matches = invitations.filter((i) => i.referralCode === codeVal);
    const total = matches.length;
    const delivered = matches.filter((m) => m.status === 'delivered').length;
    const bounced = matches.filter((m) => m.status === 'bounced').length;
    return { delivered, total, bounced };
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading referral codes...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px' }}>
      <h2>🎁 Referral Code Manager</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Generate referral codes for existing members to share with friends. New users who register with a code will automatically receive a welcome push notification.
      </p>

      {/* Generate New Code Form */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginTop: 0 }}>Generate New Referral Code</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Member Email *
            </label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="member@example.com"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Campaign Name *
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Friend Referral Bonus"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Discount Amount *
            </label>
            <input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="20"
              min="0"
              step="0.01"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Discount Type
            </label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Max Uses (Optional)
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              min="1"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Link to FX Campaign (Optional)
            </label>
            <select
              value={selectedCampaignNumber}
              onChange={(e) => setSelectedCampaignNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Select a campaign...</option>
              {fxCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.campaignNumber}>
                  {campaign.campaignNumber} - {campaign.name}
                </option>
              ))}
            </select>
            {selectedCampaignNumber && (
              <p style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
                Selected: {fxCampaigns.find(c => c.campaignNumber === selectedCampaignNumber)?.description}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
            Welcome Message *
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Welcome! Thanks for joining through your friend's referral. Enjoy 20% off your first ride!"
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <button
          onClick={handleGenerateCode}
          disabled={generating}
          style={{
            padding: '10px 20px',
            backgroundColor: generating ? '#95a5a6' : '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontWeight: 600
          }}
        >
          {generating ? 'Generating...' : '🎁 Generate Referral Code'}
        </button>
      </div>

      {/* Existing Codes Table */}
      <h3>Existing Referral Codes</h3>
      
      {referralCodes.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No referral codes generated yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Code</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Member</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Campaign</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>FX Campaign</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Discount</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Usage</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Sends (deliv/total)</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {referralCodes.map((code) => (
                <tr key={code.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace', fontSize: '16px' }}>
                    {code.code}
                  </td>
                  <td style={{ padding: '12px' }}>{code.memberEmail}</td>
                  <td style={{ padding: '12px' }}>{code.campaignName}</td>
                  <td style={{ padding: '12px' }}>
                    {code.fxCampaignNumber ? (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1565c0'
                      }}>
                        {code.fxCampaignNumber}
                      </span>
                    ) : (
                      <span style={{ color: '#999', fontSize: '13px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {code.discountAmount}{code.discountType === 'percentage' ? '%' : ' fixed'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {code.usedCount} {code.maxUses ? `/ ${code.maxUses}` : '/ ∞'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {(() => { const s = getSendStatsForCode(code.code); return `${s.delivered}/${s.total}${s.bounced ? ` (b:${s.bounced})` : ''}`; })()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: getStatusBadgeColor(code),
                      color: 'white'
                    }}>
                      {getStatusText(code)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                    {new Date(code.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openSendModal(code)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '6px'
                      }}
                      title="Send referral email (via SendGrid)"
                    >
                      ✉️ Send Email
                    </button>
                    <button
                      onClick={async () => {
                        const registrationUrl = `${window.location.origin}/register?ref=${code.code}`;
                        try {
                          await navigator.clipboard.writeText(registrationUrl);
                          alert(`Link copied to clipboard!\n\n${registrationUrl}`);
                        } catch (err) {
                          alert(`Registration link:\n${registrationUrl}`);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      title="Copy registration link"
                    >
                      🔗 Copy Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Referral Emails */}
      <h3 style={{ marginTop: '32px' }}>Recent Referral Emails</h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 12px' }}>
        <input
          type="text"
          value={inviteQuery}
          onChange={(e) => setInviteQuery(e.target.value)}
          placeholder="Search email or code..."
          style={{ flex: 1, minWidth: 200, padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <select value={inviteStatus} onChange={(e) => setInviteStatus(e.target.value as any)} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="opened">Opened</option>
          <option value="clicked">Clicked</option>
          <option value="deferred">Deferred</option>
          <option value="bounced">Bounced</option>
        </select>
      </div>
      {(() => {
        const q = inviteQuery.trim().toLowerCase();
        const filtered = invitations.filter((inv) => {
          const matchQ = !q || [inv.sentTo, inv.from || inv.sentBy, inv.referralCode].some((v) => String(v || '').toLowerCase().includes(q));
          const s = (inv.status || 'sent').toLowerCase();
          const matchS = inviteStatus === 'all' ? true : (inviteStatus === 'opened' ? (s === 'opened') : inviteStatus === 'clicked' ? (s === 'clicked') : s === inviteStatus);
          return matchQ && matchS;
        });
        return filtered.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No referral emails found.</p>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Sent At</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>To</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>From</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Code</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Last Event</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px', fontSize: 13, color: '#555' }}>{inv.sentAt ? new Date(inv.sentAt).toLocaleString() : '-'}</td>
                  <td style={{ padding: '12px' }}>{inv.sentTo}</td>
                  <td style={{ padding: '12px' }}>{inv.from || inv.sentBy}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{inv.referralCode}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: inv.status === 'delivered' ? '#16a34a' : inv.status === 'bounced' ? '#dc2626' : inv.status === 'deferred' ? '#f59e0b' : '#64748b',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600
                    }}>{inv.status || 'sent'}</span>
                  </td>
                  <td style={{ padding: '12px' }}>{inv.lastEvent || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => openEventsModal(inv)}
                      style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      title={inv.messageId ? 'View SendGrid events' : 'No events captured for this email'}
                    >
                      📬 View Events
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })()}
      <Modal
        isOpen={sendModalOpen}
        onRequestClose={closeSendModal}
        contentLabel="Send Referral Email"
        style={{
          content: {
            maxWidth: '480px',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.35)' }
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Send Referral Email</h3>
        <p style={{ marginTop: 0, color: '#555' }}>
          {selectedCode ? (
            <>
              Code: <strong style={{ fontFamily: 'monospace' }}>{selectedCode.code}</strong>
              {selectedCode.campaignName ? (<><br/>Campaign: <strong>{selectedCode.campaignName}</strong></>) : null}
            </>
          ) : null}
        </p>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Recipient Email</label>
        <input
          type="email"
          value={sendToEmail}
          onChange={(e) => setSendToEmail(e.target.value)}
          placeholder="friend@example.com"
          style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, marginTop: 8 }}>From (optional)</label>
        <input
          type="email"
          value={sendFromEmail}
          onChange={(e) => setSendFromEmail(e.target.value)}
          placeholder="noreply@yourdomain.com"
          style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, marginBottom: 8, boxSizing: 'border-box' }}
        />
        {sendError ? (
          <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>
            {sendError}
            {/(verified\s+Sender\s+Identity|from address does not match)/i.test(sendError) ? (
              <div style={{ marginTop: 6, color: '#7f1d1d' }}>
                Tip: Use a verified sender address in SendGrid, or verify this address in your SendGrid dashboard (Settings → Sender Authentication). You can also set a default in .env.local as VITE_FROM_EMAIL.
              </div>
            ) : null}
          </div>
        ) : null}
        {sendSuccess ? <div style={{ color: '#166534', fontSize: 12, marginBottom: 8 }}>Email sent successfully.</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            onClick={closeSendModal}
            disabled={sending}
            style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: sending ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending}
            style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: sending ? 'not-allowed' : 'pointer', minWidth: 120 }}
          >
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </Modal>

      {/* Events Modal */}
      <Modal
        isOpen={eventsModalOpen}
        onRequestClose={closeEventsModal}
        contentLabel="Email Events"
        style={{
          content: {
            maxWidth: '680px',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.35)' }
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Email Events</h3>
        <p style={{ marginTop: 0, color: '#555' }}>
          {selectedInvitation ? (
            <>To: <strong>{selectedInvitation.sentTo}</strong> · Code: <strong style={{ fontFamily: 'monospace' }}>{selectedInvitation.referralCode}</strong><br/>
            Status: <strong>{selectedInvitation.status || 'sent'}</strong>{selectedInvitation.messageId ? ` · messageId: ${selectedInvitation.messageId}` : ''}</>
          ) : null}
        </p>
        {!selectedInvitation?.messageId ? (
          <div style={{ color: '#6b7280' }}>No message id for this invitation. It may predate event tracking.</div>
        ) : eventsLoading ? (
          <div>Loading events…</div>
        ) : invitationEvents.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No events recorded yet.</div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Event</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>At</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Reason/Response</th>
                </tr>
              </thead>
              <tbody>
                {invitationEvents.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{ev.event}</td>
                    <td style={{ padding: 8 }}>{ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleString() : '-'}</td>
                    <td style={{ padding: 8, color: '#374151' }}>{ev.reason || ev.response || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={closeEventsModal} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
        </div>
      </Modal>
    </div>
  );
};

export default ReferralCodeManager;
