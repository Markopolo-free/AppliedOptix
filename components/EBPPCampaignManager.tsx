import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from '../services/firebase';
import { ApprovalStatus, UserRole } from '../enums';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';

// Data Types
export interface EBPPCampaignTier {
  id: string;
  billCycleAmountFrom: number;
  billCycleAmountTo: number | null; // null means infinity
  cashBackMultiplier: number;
}

export interface EBPPStreakMultiplier {
  id: string;
  periodLabel: string; // e.g., "Month 3", "Month 6", "Month 9"
  multipliers: Record<string, number>; // tier id -> multiplier value
}

export interface EBPPCampaign {
  id: string;
  tenantId: string;
  campaignCode: string;
  campaignName: string;
  status: string; // Draft, Pending, Approved, Rejected
  rewardType: string; // Cash Back, Points, etc.
  cashBackType: string; // Flat, Tiered, Percentage On Bill, Percentage On Bill - Increasing
  payoutCurrency: string; // USD, EUR, etc.
  percentageOnBill: string; // Month End, Immediate, etc.
  isTieredPayouts: boolean;
  tiers: EBPPCampaignTier[];
  streakMultipliers: EBPPStreakMultiplier[]; // Only for "Percentage On Bill - Increasing"
  hasStreakMultipliers: boolean;
  startDate: string; // ISO format
  endDate: string; // ISO format
  capMonthlyPayout: boolean;
  monthlyPayoutCap: number;
  accountRestrictions: string; // e.g., "Over-30-Day-Late-ACs"
  campaignOperationsDescription: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  checkerName?: string;
  checkerEmail?: string;
  checkerTimestamp?: string;
  version: number;
}

const newTier = (): EBPPCampaignTier => ({
  id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  billCycleAmountFrom: 0,
  billCycleAmountTo: 1000,
  cashBackMultiplier: 1.5,
});

const newStreakMultiplier = (tierCount: number): EBPPStreakMultiplier => {
  const multipliers: Record<string, number> = {};
  for (let i = 0; i < tierCount; i++) {
    multipliers[`tier-${i}`] = 1.0;
  }
  return {
    id: `streak-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    periodLabel: `Month ${3 + 3 * multipliers.length}`,
    multipliers,
  };
};

const initialFormState = {
  campaignCode: '',
  campaignName: '',
  rewardType: 'Cash Back',
  cashBackType: 'Flat',
  payoutCurrency: 'USD',
  percentageOnBill: 'Month End',
  isTieredPayouts: false,
  capMonthlyPayout: false,
  monthlyPayoutCap: 50,
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  accountRestrictions: 'Over-30-Day-Late-ACs',
  campaignOperationsDescription: '',
};

const EBPPCampaignManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [campaigns, setCampaigns] = useState<EBPPCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [tiers, setTiers] = useState<EBPPCampaignTier[]>([newTier()]);
  const [streakMultipliers, setStreakMultipliers] = useState<EBPPStreakMultiplier[]>([]);
  const [editingCampaign, setEditingCampaign] = useState<EBPPCampaign | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMaker = currentUser?.role === UserRole.Maker || currentUser?.role === UserRole.Administrator;
  const isChecker = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const campaignsRef = ref(db, `ebpp/campaigns`);
      const snapshot = await get(campaignsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const campaignList: EBPPCampaign[] = Object.entries(data).map(([id, campaign]: [string, any]) => ({
          id,
          ...campaign,
        }));
        setCampaigns(campaignList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      } else {
        setCampaigns([]);
      }
    } catch (error) {
      console.error('Failed loading EBPP campaigns:', error);
      setErrorMessage('Failed to load campaigns.');
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.altKey && event.key === 'n') {
        event.preventDefault();
        resetForm();
      }
      if (event.altKey && event.key === 's') {
        event.preventDefault();
        saveDraft();
      }
      if (event.altKey && event.key === 'p') {
        event.preventDefault();
        submitForApproval();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [formData, tiers, streakMultipliers, editingCampaign]);

  const filteredCampaigns = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter(
      (c) =>
        c.campaignCode.toLowerCase().includes(term) ||
        c.campaignName.toLowerCase().includes(term) ||
        c.rewardType.toLowerCase().includes(term) ||
        c.status.toLowerCase().includes(term)
    );
  }, [campaigns, searchTerm]);

  const resetForm = () => {
    setEditingCampaign(null);
    setFormData(initialFormState);
    setTiers([newTier()]);
    setStreakMultipliers([]);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const addTier = () => {
    setTiers((prev) => [...prev, newTier()]);
  };

  const removeTier = (tierId: string) => {
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== tierId);
    });
  };

  const updateTier = (tierId: string, field: keyof EBPPCampaignTier, value: string | number | null) => {
    setTiers((prev) =>
      prev.map((t) => {
        if (t.id !== tierId) return t;
        if (field === 'cashBackMultiplier' || field === 'billCycleAmountFrom' || field === 'billCycleAmountTo') {
          return { ...t, [field]: value === '' ? null : Number(value) } as EBPPCampaignTier;
        }
        return { ...t, [field]: String(value) } as EBPPCampaignTier;
      })
    );
  };

  const addStreakMultiplier = () => {
    setStreakMultipliers((prev) => [...prev, newStreakMultiplier(tiers.length)]);
  };

  const removeStreakMultiplier = (streakId: string) => {
    setStreakMultipliers((prev) => prev.filter((s) => s.id !== streakId));
  };

  const updateStreakMultiplier = (streakId: string, tierIdOrLabel: string, value: string | number) => {
    setStreakMultipliers((prev) =>
      prev.map((s) => {
        if (s.id !== streakId) return s;
        if (tierIdOrLabel === 'periodLabel') {
          return { ...s, periodLabel: String(value) };
        }
        return {
          ...s,
          multipliers: {
            ...s.multipliers,
            [tierIdOrLabel]: Number(value),
          },
        };
      })
    );
  };

  const saveDraft = async () => {
    if (!isMaker) {
      setErrorMessage('Only Maker or Administrator can save campaigns.');
      return;
    }

    if (!formData.campaignCode.trim()) {
      setErrorMessage('Campaign Code is required.');
      return;
    }
    if (!formData.campaignName.trim()) {
      setErrorMessage('Campaign Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Partial<EBPPCampaign> = {
        tenantId: effectiveTenantId,
        campaignCode: formData.campaignCode,
        campaignName: formData.campaignName,
        rewardType: formData.rewardType,
        cashBackType: formData.cashBackType,
        payoutCurrency: formData.payoutCurrency,
        percentageOnBill: formData.percentageOnBill,
        isTieredPayouts: formData.isTieredPayouts,
        tiers: tiers,
        streakMultipliers: formData.cashBackType === 'Percentage On Bill - Increasing' ? streakMultipliers : [],
        hasStreakMultipliers: streakMultipliers.length > 0,
        startDate: formData.startDate,
        endDate: formData.endDate,
        capMonthlyPayout: formData.capMonthlyPayout,
        monthlyPayoutCap: formData.monthlyPayoutCap,
        accountRestrictions: formData.accountRestrictions,
        campaignOperationsDescription: formData.campaignOperationsDescription,
        updatedBy: currentUser?.email || '',
        updatedAt: now,
        version: (editingCampaign?.version || 0) + 1,
      };

      if (!editingCampaign) {
        payload.status = ApprovalStatus.Draft;
        payload.createdAt = now;
        payload.createdBy = currentUser?.email || '';
        const newRef = push(ref(db, `ebpp/campaigns`));
        await set(newRef, payload);
        setSuccessMessage('Campaign saved as draft.');
      } else {
        await update(ref(db, `ebpp/campaigns/${editingCampaign.id}`), payload);
        setSuccessMessage('Campaign updated.');
      }

      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: editingCampaign ? 'update' : 'create',
          entityType: 'ebpp-campaign',
          entityId: editingCampaign?.id || '',
          entityName: formData.campaignCode,
          metadata: { tenantId: effectiveTenantId, campaignName: formData.campaignName },
        }).catch((e) => console.warn('Audit log failed:', e));
      }

      await fetchCampaigns();
      resetForm();
    } catch (error) {
      console.error('Save failed:', error);
      setErrorMessage('Failed to save campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!isMaker) {
      setErrorMessage('Only Maker or Administrator can submit campaigns.');
      return;
    }
    if (!editingCampaign || editingCampaign.status !== ApprovalStatus.Draft) {
      setErrorMessage('Only Draft campaigns can be submitted for approval.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await update(ref(db, `ebpp/campaigns/${editingCampaign.id}`), {
        status: ApprovalStatus.Pending,
        updatedBy: currentUser?.email || '',
        updatedAt: now,
      });

      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'submit',
          entityType: 'campaign',
          entityId: editingCampaign.id,
          entityName: editingCampaign.campaignCode,
          metadata: { tenantId: effectiveTenantId },
        }).catch((e) => console.warn('Audit log failed:', e));
      }

      setSuccessMessage('Campaign submitted for approval.');
      await fetchCampaigns();
      resetForm();
    } catch (error) {
      console.error('Submit failed:', error);
      setErrorMessage('Failed to submit campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  const approveCampaign = async (campaign: EBPPCampaign) => {
    if (!isChecker) {
      setErrorMessage('Only Checker or Administrator can approve campaigns.');
      return;
    }
    if (campaign.status !== ApprovalStatus.Pending) {
      setErrorMessage('Only Pending campaigns can be approved.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await update(ref(db, `ebpp/campaigns/${campaign.id}`), {
        status: ApprovalStatus.Approved,
        checkerName: currentUser?.name || '',
        checkerEmail: currentUser?.email || '',
        checkerTimestamp: now,
        updatedBy: currentUser?.email || '',
        updatedAt: now,
      });

      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'approve',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.campaignCode,
          metadata: { tenantId: effectiveTenantId },
        }).catch((e) => console.warn('Audit log failed:', e));
      }

      setSuccessMessage(`Campaign ${campaign.campaignCode} approved.`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Approval failed:', error);
      setErrorMessage('Failed to approve campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  const rejectCampaign = async (campaign: EBPPCampaign) => {
    if (!isChecker) {
      setErrorMessage('Only Checker or Administrator can reject campaigns.');
      return;
    }
    if (campaign.status !== ApprovalStatus.Pending) {
      setErrorMessage('Only Pending campaigns can be rejected.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await update(ref(db, `ebpp/campaigns/${campaign.id}`), {
        status: ApprovalStatus.Rejected,
        checkerName: currentUser?.name || '',
        checkerEmail: currentUser?.email || '',
        checkerTimestamp: now,
        updatedBy: currentUser?.email || '',
        updatedAt: now,
      });

      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'reject',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.campaignCode,
          metadata: { tenantId: effectiveTenantId },
        }).catch((e) => console.warn('Audit log failed:', e));
      }

      setSuccessMessage(`Campaign ${campaign.campaignCode} rejected.`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Rejection failed:', error);
      setErrorMessage('Failed to reject campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCampaign = async (campaign: EBPPCampaign) => {
    if (!isMaker) {
      setErrorMessage('Only Maker or Administrator can delete campaigns.');
      return;
    }

    if (campaign.status !== ApprovalStatus.Draft && campaign.status !== ApprovalStatus.Rejected) {
      setErrorMessage('Only Draft or Rejected campaigns can be deleted.');
      return;
    }

    if (!window.confirm(`Delete campaign ${campaign.campaignCode}?`)) return;

    setIsSaving(true);
    try {
      await remove(ref(db, `ebpp/campaigns/${campaign.id}`));

      if (currentUser) {
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'delete',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.campaignCode,
          metadata: { tenantId: effectiveTenantId },
        }).catch((e) => console.warn('Audit log failed:', e));
      }

      setSuccessMessage(`Campaign ${campaign.campaignCode} deleted.`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Delete failed:', error);
      setErrorMessage('Failed to delete campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  const editCampaign = (campaign: EBPPCampaign) => {
    setEditingCampaign(campaign);
    setFormData({
      campaignCode: campaign.campaignCode,
      campaignName: campaign.campaignName,
      rewardType: campaign.rewardType,
      cashBackType: campaign.cashBackType,
      payoutCurrency: campaign.payoutCurrency,
      percentageOnBill: campaign.percentageOnBill,
      isTieredPayouts: campaign.isTieredPayouts,
      capMonthlyPayout: campaign.capMonthlyPayout,
      monthlyPayoutCap: campaign.monthlyPayoutCap,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      accountRestrictions: campaign.accountRestrictions,
      campaignOperationsDescription: campaign.campaignOperationsDescription,
    });
    setTiers(campaign.tiers || [newTier()]);
    setStreakMultipliers(campaign.streakMultipliers || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusBadgeClass = (status: string): string => {
    if (status === ApprovalStatus.Approved) return 'bg-green-100 text-green-800';
    if (status === ApprovalStatus.Pending) return 'bg-blue-100 text-blue-800';
    if (status === ApprovalStatus.Rejected) return 'bg-red-100 text-red-800';
    if (status === ApprovalStatus.Draft) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">EBPP - Campaign Creation</h1>
        <p className="text-gray-600">
          Create and manage Electronic Bill Presentment and Payment incentive campaigns to encourage electronic bill adoption and reduce payment delinquencies.
        </p>
      </div>

      {/* Search and Actions */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search (Alt+F)</label>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Code, name, type, status"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex gap-2 items-end">
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              New Draft (Alt+N)
            </button>
            <button
              onClick={fetchCampaigns}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{errorMessage}</div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">{successMessage}</div>
      )}

      {/* Campaign Form */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Campaign Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Code</label>
              <input
                type="text"
                value={formData.campaignCode}
                onChange={(e) => setFormData({ ...formData, campaignCode: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g., C-1002370"
                disabled={editingCampaign !== null}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payout Currency</label>
              <select
                value={formData.payoutCurrency}
                onChange={(e) => setFormData({ ...formData, payoutCurrency: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiered Pay-outs Per Bill</label>
              <select
                value={String(formData.isTieredPayouts)}
                onChange={(e) => setFormData({ ...formData, isTieredPayouts: e.target.value === 'true' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="false">FALSE</option>
                <option value="true">TRUE</option>
              </select>
            </div>

            {formData.isTieredPayouts && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bill Cycle Tiers</label>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {tiers.map((tier, idx) => (
                    <div key={tier.id} className="flex gap-2 mb-2">
                      <input
                        type="number"
                        value={tier.billCycleAmountFrom}
                        onChange={(e) => updateTier(tier.id, 'billCycleAmountFrom', e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="From"
                      />
                      <span className="text-gray-500 pt-1">–</span>
                      <input
                        type="number"
                        value={tier.billCycleAmountTo || ''}
                        onChange={(e) => updateTier(tier.id, 'billCycleAmountTo', e.target.value || null)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="To (blank = ∞)"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={tier.cashBackMultiplier}
                        onChange={(e) => updateTier(tier.id, 'cashBackMultiplier', e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="Multiplier %"
                      />
                      {tiers.length > 1 && (
                        <button
                          onClick={() => removeTier(tier.id)}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addTier}
                    className="w-full mt-2 px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                  >
                    + Add Tier
                  </button>
                </div>
              </div>
            )}

            {!formData.isTieredPayouts && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash Back Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={1.5}
                  onChange={() => {}}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., 1.5"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="capMonthly"
                checked={formData.capMonthlyPayout}
                onChange={(e) => setFormData({ ...formData, capMonthlyPayout: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="capMonthly" className="text-sm font-medium text-gray-700">
                Cap Monthly Payout
              </label>
            </div>

            {formData.capMonthlyPayout && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Payout Cap</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthlyPayoutCap}
                  onChange={(e) => setFormData({ ...formData, monthlyPayoutCap: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., 50.00"
                />
              </div>
            )}
          </div>

          {/* Middle Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                value={formData.campaignName}
                onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="e.g., Basic_Cash_Back_All_Customers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash Back Type</label>
              <select
                value={formData.cashBackType}
                onChange={(e) => setFormData({ ...formData, cashBackType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="Flat">Flat</option>
                <option value="Tiered">Tiered</option>
                <option value="Percentage On Bill">Percentage On Bill</option>
                <option value="Percentage On Bill - Increasing">Percentage On Bill - Increasing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage On Bill</label>
              <select
                value={formData.percentageOnBill}
                onChange={(e) => setFormData({ ...formData, percentageOnBill: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="Month End">Month End</option>
                <option value="Immediate">Immediate</option>
                <option value="At Maturity">At Maturity</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reward Type</label>
              <select
                value={formData.rewardType}
                onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="Cash Back">Cash Back</option>
                <option value="Points">Points</option>
                <option value="Discount">Discount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {formData.cashBackType === 'Percentage On Bill - Increasing' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Streak Multipliers</label>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {streakMultipliers.map((streak) => (
                    <div key={streak.id} className="mb-3 pb-3 border-b border-gray-200">
                      <input
                        type="text"
                        value={streak.periodLabel}
                        onChange={(e) => updateStreakMultiplier(streak.id, 'periodLabel', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-2"
                      />
                      {tiers.map((_, tierIdx) => (
                        <div key={tierIdx} className="flex gap-1 mb-1">
                          <span className="text-xs text-gray-500 pt-1 w-12">Tier {tierIdx + 1}:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={streak.multipliers[`tier-${tierIdx}`] || 1.0}
                            onChange={(e) => updateStreakMultiplier(streak.id, `tier-${tierIdx}`, e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={addStreakMultiplier}
                    className="w-full mt-2 px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                  >
                    + Add Streak Period
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Restrictions</label>
              <select
                value={formData.accountRestrictions}
                onChange={(e) => setFormData({ ...formData, accountRestrictions: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="None">None</option>
                <option value="Over-30-Day-Late-ACs">Over-30-Day-Late-ACs</option>
                <option value="Over-60-Day-Late-ACs">Over-60-Day-Late-ACs</option>
                <option value="Active-Collections">Active-Collections</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Operations</label>
              <textarea
                value={formData.campaignOperationsDescription}
                onChange={(e) => setFormData({ ...formData, campaignOperationsDescription: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 h-32 text-sm resize-none"
                placeholder="Offer details and terms..."
                defaultValue="Offer allows customers who pay their bill on or before due date, via EBPP (the system) to enjoy a scaled reward. For each bill increment (see details) customers will receive a discount payout at the end of month. See Terms & Conditions"
              />
            </div>

            {editingCampaign && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">
                  <strong>Status:</strong> {editingCampaign.status}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={saveDraft}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
          >
            Save Draft (Alt+S)
          </button>
          {editingCampaign && editingCampaign.status === ApprovalStatus.Draft && (
            <button
              onClick={submitForApproval}
              disabled={isSaving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50"
            >
              Submit for Approval (Alt+P)
            </button>
          )}
          <button
            onClick={resetForm}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Campaigns List */}
      {!isLoading && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Campaigns ({filteredCampaigns.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Campaign Code</th>
                  <th className="px-3 py-2 text-left">Campaign Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Active Period</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-medium">{campaign.campaignCode}</td>
                    <td className="px-3 py-2">{campaign.campaignName}</td>
                    <td className="px-3 py-2 text-xs">{campaign.cashBackType}</td>
                    <td className="px-3 py-2 text-xs">
                      {campaign.startDate} to {campaign.endDate}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 space-x-1">
                      {campaign.status === ApprovalStatus.Draft && isMaker && (
                        <button
                          onClick={() => editCampaign(campaign)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                        >
                          Edit
                        </button>
                      )}
                      {campaign.status === ApprovalStatus.Pending && isChecker && (
                        <>
                          <button
                            onClick={() => approveCampaign(campaign)}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectCampaign(campaign)}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(campaign.status === ApprovalStatus.Draft || campaign.status === ApprovalStatus.Rejected) &&
                        isMaker && (
                          <button
                            onClick={() => deleteCampaign(campaign)}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-8 text-gray-500">Loading campaigns...</div>}
    </div>
  );
};

export default EBPPCampaignManager;
