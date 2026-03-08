import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { push, ref, remove, set, update } from 'firebase/database';
import { db } from '../services/firebase';
import { ApprovalStatus, UserRole } from '../enums';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import {
  InterestProduct,
  InterestRateBook,
  InterestRateTier,
  InterestApprovalState,
} from '../types';
import {
  queryInterestProductsByTenant,
  queryInterestRateBooksByTenant,
} from '../services/multiTenantService';

const newTier = (): InterestRateTier => ({
  id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  tierFromAmount: 0,
  tierToAmount: 10000,
  annualRatePercent: 0,
  isPromotional: false,
  promoFrom: '',
  promoTo: '',
});

const initialFormState = {
  rateBookCode: '',
  productId: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: '',
};

const overlaps = (fromA: string, toA?: string, fromB?: string, toB?: string): boolean => {
  if (!fromB) return false;
  const aStart = new Date(fromA).getTime();
  const aEnd = toA ? new Date(toA).getTime() : Number.POSITIVE_INFINITY;
  const bStart = new Date(fromB).getTime();
  const bEnd = toB ? new Date(toB).getTime() : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
};

const InterestRateBooksManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [products, setProducts] = useState<InterestProduct[]>([]);
  const [rateBooks, setRateBooks] = useState<InterestRateBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialFormState);
  const [tiers, setTiers] = useState<InterestRateTier[]>([newTier()]);
  const [editingRateBook, setEditingRateBook] = useState<InterestRateBook | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMaker = currentUser?.role === UserRole.Maker || currentUser?.role === UserRole.Administrator;
  const isChecker = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productList, rateBookList] = await Promise.all([
        queryInterestProductsByTenant(effectiveTenantId),
        queryInterestRateBooksByTenant(effectiveTenantId),
      ]);

      const typedProducts = (productList as InterestProduct[]).sort((a, b) => a.productCode.localeCompare(b.productCode));
      const typedRateBooks = (rateBookList as InterestRateBook[]).sort((a, b) => {
        const aTime = new Date(a.lastModifiedAt || '').getTime();
        const bTime = new Date(b.lastModifiedAt || '').getTime();
        return bTime - aTime;
      });

      setProducts(typedProducts);
      setRateBooks(typedRateBooks);
    } catch (error) {
      console.error('Failed loading rate books:', error);
      setProducts([]);
      setRateBooks([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRateBooks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rateBooks;
    return rateBooks.filter((item) => {
      return (
        item.rateBookCode.toLowerCase().includes(term) ||
        item.productCode.toLowerCase().includes(term) ||
        item.productName.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term)
      );
    });
  }, [rateBooks, searchTerm]);

  const resetForm = () => {
    setEditingRateBook(null);
    setFormData(initialFormState);
    setTiers([newTier()]);
    setErrorMessage('');
  };

  const addTier = () => {
    setTiers((prev) => [...prev, newTier()]);
  };

  const removeTier = (tierId: string) => {
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((tier) => tier.id !== tierId);
    });
  };

  const updateTier = (tierId: string, field: keyof InterestRateTier, value: string | boolean) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.id !== tierId) return tier;
        if (field === 'isPromotional') {
          return { ...tier, isPromotional: Boolean(value) };
        }
        if (field === 'tierFromAmount' || field === 'tierToAmount' || field === 'annualRatePercent') {
          const parsed = String(value).trim() === '' ? null : Number(value);
          return {
            ...tier,
            [field]: parsed,
          } as InterestRateTier;
        }
        return { ...tier, [field]: String(value) } as InterestRateTier;
      })
    );
  };

  const validateTiers = (): string[] => {
    const errors: string[] = [];
    if (tiers.length === 0) {
      errors.push('At least one tier is required.');
      return errors;
    }

    const normalized = [...tiers].sort((a, b) => (a.tierFromAmount || 0) - (b.tierFromAmount || 0));

    normalized.forEach((tier, index) => {
      if (!Number.isFinite(tier.tierFromAmount) || tier.tierFromAmount < 0) {
        errors.push(`Tier ${index + 1}: From amount must be a non-negative number.`);
      }
      if (tier.tierToAmount != null && (!Number.isFinite(tier.tierToAmount) || tier.tierToAmount <= tier.tierFromAmount)) {
        errors.push(`Tier ${index + 1}: To amount must be greater than From amount.`);
      }
      if (!Number.isFinite(tier.annualRatePercent)) {
        errors.push(`Tier ${index + 1}: Annual rate must be a valid number.`);
      }
      if (tier.isPromotional && tier.promoFrom && tier.promoTo && new Date(tier.promoFrom) > new Date(tier.promoTo)) {
        errors.push(`Tier ${index + 1}: Promotional date range is invalid.`);
      }
    });

    for (let i = 0; i < normalized.length - 1; i += 1) {
      const current = normalized[i];
      const next = normalized[i + 1];
      const currentTo = current.tierToAmount ?? Number.POSITIVE_INFINITY;
      if (currentTo > next.tierFromAmount) {
        errors.push(`Tier overlap detected between rows ${i + 1} and ${i + 2}.`);
      }
    }

    return errors;
  };

  const validateRateBookForm = (): boolean => {
    if (!formData.rateBookCode.trim()) {
      setErrorMessage('Rate book code is required.');
      return false;
    }
    if (!formData.productId) {
      setErrorMessage('Please select an interest product.');
      return false;
    }
    if (!formData.effectiveFrom) {
      setErrorMessage('Effective from date is required.');
      return false;
    }
    if (formData.effectiveTo && new Date(formData.effectiveFrom) > new Date(formData.effectiveTo)) {
      setErrorMessage('Effective to date must be on/after effective from date.');
      return false;
    }

    const duplicateCode = rateBooks.find((book) => {
      if (editingRateBook && book.id === editingRateBook.id) return false;
      return book.rateBookCode.toLowerCase() === formData.rateBookCode.trim().toLowerCase();
    });
    if (duplicateCode) {
      setErrorMessage('Rate book code must be unique within tenant.');
      return false;
    }

    const tierErrors = validateTiers();
    if (tierErrors.length > 0) {
      setErrorMessage(tierErrors[0]);
      return false;
    }

    const targetProduct = products.find((p) => p.id === formData.productId);
    if (!targetProduct) {
      setErrorMessage('Selected product could not be found.');
      return false;
    }

    const hasOverlap = rateBooks.some((book) => {
      if (editingRateBook && book.id === editingRateBook.id) return false;
      if (book.productId !== formData.productId) return false;
      if (book.status === ApprovalStatus.Rejected) return false;
      return overlaps(formData.effectiveFrom, formData.effectiveTo || undefined, book.effectiveFrom, book.effectiveTo);
    });

    if (hasOverlap) {
      setErrorMessage('Effective date overlap detected for this product. Use Validate Overlaps (Alt+V).');
      return false;
    }

    setErrorMessage('');
    return true;
  };

  const validateOverlapsOnly = () => {
    if (!formData.productId || !formData.effectiveFrom) {
      alert('Select product and effective-from date first.');
      return;
    }
    const overlapBooks = rateBooks.filter((book) => {
      if (editingRateBook && book.id === editingRateBook.id) return false;
      if (book.productId !== formData.productId) return false;
      if (book.status === ApprovalStatus.Rejected) return false;
      return overlaps(formData.effectiveFrom, formData.effectiveTo || undefined, book.effectiveFrom, book.effectiveTo);
    });

    if (overlapBooks.length === 0) {
      alert('No effective-date overlaps found.');
      return;
    }

    alert(`Found ${overlapBooks.length} overlap(s): ${overlapBooks.map((b) => b.rateBookCode).join(', ')}`);
  };

  const buildPayload = (status: InterestApprovalState): Omit<InterestRateBook, 'id'> | null => {
    const product = products.find((p) => p.id === formData.productId);
    if (!product) return null;
    const nowIso = new Date().toISOString();

    const normalizedTiers = [...tiers]
      .sort((a, b) => (a.tierFromAmount || 0) - (b.tierFromAmount || 0))
      .map((tier) => ({
        ...tier,
        tierToAmount: tier.tierToAmount == null || tier.tierToAmount === 0 ? null : tier.tierToAmount,
        promoFrom: tier.isPromotional ? tier.promoFrom || '' : '',
        promoTo: tier.isPromotional ? tier.promoTo || '' : '',
      }));

    return {
      rateBookCode: formData.rateBookCode.trim().toUpperCase(),
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      effectiveFrom: formData.effectiveFrom,
      effectiveTo: formData.effectiveTo || '',
      tiers: normalizedTiers,
      status,
      version: editingRateBook ? editingRateBook.version + 1 : 1,
      tenantId: effectiveTenantId,
      makerName: editingRateBook?.makerName || currentUser?.name || 'Unknown User',
      makerEmail: editingRateBook?.makerEmail || currentUser?.email || '',
      makerTimestamp: editingRateBook?.makerTimestamp || nowIso,
      checkerName: editingRateBook?.checkerName,
      checkerEmail: editingRateBook?.checkerEmail,
      checkerTimestamp: editingRateBook?.checkerTimestamp,
      publishedBy: editingRateBook?.publishedBy,
      publishedAt: editingRateBook?.publishedAt,
      lastModifiedBy: currentUser?.email || 'usr_admin',
      lastModifiedAt: nowIso,
    };
  };

  const saveRateBook = useCallback(async (targetStatus: InterestApprovalState) => {
    if (!isMaker || !currentUser) {
      alert('Only Maker or Administrator can save rate books.');
      return;
    }
    if (!validateRateBookForm()) return;

    const payload = buildPayload(targetStatus);
    if (!payload) {
      alert('Unable to resolve product for selected rate book.');
      return;
    }

    setIsSaving(true);
    try {
      const entityName = `${payload.rateBookCode} - ${payload.productCode}`;

      if (editingRateBook) {
        await update(ref(db, `banking/interestRateBooks/${editingRateBook.id}`), payload);
        const changes = calculateChanges(editingRateBook as Record<string, any>, payload as Record<string, any>);
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: editingRateBook.id,
          entityName,
          changes,
          metadata: {
            tenantId: effectiveTenantId,
            domain: 'banking-interest-mvp',
            status: targetStatus,
          },
        });
      } else {
        const rootRef = ref(db, 'banking/interestRateBooks');
        const newRef = push(rootRef);
        await set(newRef, payload);
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'create',
          entityType: 'reference',
          entityId: newRef.key || undefined,
          entityName,
          metadata: {
            tenantId: effectiveTenantId,
            domain: 'banking-interest-mvp',
            status: targetStatus,
          },
        });
      }

      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Failed saving rate book:', error);
      alert('Failed saving rate book. Please retry.');
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, editingRateBook, effectiveTenantId, fetchData, formData, isMaker, products, rateBooks, tiers]);

  const handleEdit = (rateBook: InterestRateBook) => {
    setEditingRateBook(rateBook);
    setFormData({
      rateBookCode: rateBook.rateBookCode,
      productId: rateBook.productId,
      effectiveFrom: rateBook.effectiveFrom,
      effectiveTo: rateBook.effectiveTo || '',
    });
    setTiers(rateBook.tiers && rateBook.tiers.length > 0 ? rateBook.tiers : [newTier()]);
    setErrorMessage('');
  };

  const handleDelete = async (rateBook: InterestRateBook) => {
    if (!isMaker || !currentUser) {
      alert('Only Maker or Administrator can delete draft rate books.');
      return;
    }
    if (rateBook.status !== 'Draft') {
      alert('Only Draft rate books can be deleted.');
      return;
    }
    if (!window.confirm(`Delete draft rate book ${rateBook.rateBookCode}?`)) return;

    try {
      await remove(ref(db, `banking/interestRateBooks/${rateBook.id}`));
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'delete',
        entityType: 'reference',
        entityId: rateBook.id,
        entityName: `${rateBook.rateBookCode} - ${rateBook.productCode}`,
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
          status: rateBook.status,
        },
      });
      await fetchData();
      if (editingRateBook?.id === rateBook.id) {
        resetForm();
      }
    } catch (error) {
      console.error('Failed deleting rate book:', error);
      alert('Failed deleting rate book.');
    }
  };

  const updateApproval = async (rateBook: InterestRateBook, nextStatus: ApprovalStatus.Approved | ApprovalStatus.Rejected) => {
    if (!isChecker || !currentUser) {
      alert('Only Checker or Administrator can approve/reject.');
      return;
    }
    if (rateBook.status !== ApprovalStatus.Pending) {
      alert('Only Pending items can be approved/rejected.');
      return;
    }

    const payload: Partial<InterestRateBook> = {
      status: nextStatus,
      checkerName: currentUser.name,
      checkerEmail: currentUser.email,
      checkerTimestamp: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      await update(ref(db, `banking/interestRateBooks/${rateBook.id}`), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: nextStatus === ApprovalStatus.Approved ? 'approve' : 'reject',
        entityType: 'reference',
        entityId: rateBook.id,
        entityName: `${rateBook.rateBookCode} - ${rateBook.productCode}`,
        changes: [{ field: 'status', oldValue: rateBook.status, newValue: nextStatus }],
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
        },
      });
      await fetchData();
    } catch (error) {
      console.error('Failed updating approval:', error);
      alert('Failed updating approval.');
    }
  };

  const publishRateBook = async (rateBook: InterestRateBook) => {
    if (!isChecker || !currentUser) {
      alert('Only Checker or Administrator can publish approved rate books.');
      return;
    }
    if (rateBook.status !== ApprovalStatus.Approved) {
      alert('Only Approved rate books can be published.');
      return;
    }

    const payload: Partial<InterestRateBook> = {
      publishedBy: currentUser.email,
      publishedAt: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      await update(ref(db, `banking/interestRateBooks/${rateBook.id}`), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'update',
        entityType: 'reference',
        entityId: rateBook.id,
        entityName: `${rateBook.rateBookCode} - ${rateBook.productCode}`,
        changes: [{ field: 'publishedAt', oldValue: rateBook.publishedAt || null, newValue: payload.publishedAt }],
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
          operation: 'publish',
        },
      });
      await fetchData();
    } catch (error) {
      console.error('Failed publishing rate book:', error);
      alert('Failed publishing rate book.');
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === 'n') {
        event.preventDefault();
        resetForm();
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (key === 't') {
        event.preventDefault();
        addTier();
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        validateOverlapsOnly();
        return;
      }
      if (key === 's' && isMaker) {
        event.preventDefault();
        void saveRateBook('Draft');
        return;
      }
      if (key === 'p' && isMaker) {
        event.preventDefault();
        void saveRateBook(ApprovalStatus.Pending);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMaker, saveRateBook, formData, tiers]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Rate Book Manager</h1>
        <p className="text-gray-600">
          Create effective-dated tiered rate books with overlap validation, maker-checker controls, and auditable publishing.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search (Alt+F)</label>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Rate book code, product, status"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">New Draft (Alt+N)</button>
            <button type="button" onClick={fetchData} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Refresh</button>
            <button type="button" onClick={validateOverlapsOnly} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Validate Overlaps (Alt+V)</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Rate Book Setup</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveRateBook('Draft');
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Book Code</label>
              <input name="rateBookCode" value={formData.rateBookCode} onChange={(e) => setFormData((p) => ({ ...p, rateBookCode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" maxLength={24} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Product</label>
              <select name="productId" value={formData.productId} onChange={(e) => setFormData((p) => ({ ...p, productId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.productCode} - {product.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input type="date" name="effectiveFrom" value={formData.effectiveFrom} onChange={(e) => setFormData((p) => ({ ...p, effectiveFrom: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
              <input type="date" name="effectiveTo" value={formData.effectiveTo} onChange={(e) => setFormData((p) => ({ ...p, effectiveTo: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Tier Rows</h3>
              <button type="button" onClick={addTier} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Add Tier (Alt+T)</button>
            </div>

            <div className="space-y-3">
              {tiers.map((tier, index) => (
                <div key={tier.id} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 border border-gray-200 rounded-lg p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From Amount</label>
                    <input type="number" step="0.01" value={tier.tierFromAmount ?? ''} onChange={(e) => updateTier(tier.id, 'tierFromAmount', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To Amount</label>
                    <input type="number" step="0.01" value={tier.tierToAmount ?? ''} onChange={(e) => updateTier(tier.id, 'tierToAmount', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Annual Rate %</label>
                    <input type="number" step="0.0001" value={tier.annualRatePercent ?? ''} onChange={(e) => updateTier(tier.id, 'annualRatePercent', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2" />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={tier.isPromotional} onChange={(e) => updateTier(tier.id, 'isPromotional', e.target.checked)} />
                    <label className="text-xs font-medium text-gray-700">Promo</label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Promo From</label>
                    <input type="date" disabled={!tier.isPromotional} value={tier.promoFrom || ''} onChange={(e) => updateTier(tier.id, 'promoFrom', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2 disabled:bg-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Promo To</label>
                    <input type="date" disabled={!tier.isPromotional} value={tier.promoTo || ''} onChange={(e) => updateTier(tier.id, 'promoTo', e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2 disabled:bg-gray-100" />
                  </div>
                  <div className="flex items-center justify-end mt-6">
                    <button type="button" onClick={() => removeTier(tier.id)} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40" disabled={tiers.length <= 1}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={!isMaker || isSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {editingRateBook ? 'Update Draft' : 'Save Draft'} (Alt+S)
            </button>
            <button type="button" disabled={!isMaker || isSaving} onClick={() => void saveRateBook(ApprovalStatus.Pending)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
              Submit for Approval (Alt+P)
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Clear</button>
          </div>
        </form>

        {errorMessage && <p className="text-sm text-red-600 mt-3">{errorMessage}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Rate Books ({filteredRateBooks.length})</h2>

        {isLoading ? (
          <p className="text-gray-600">Loading rate books...</p>
        ) : filteredRateBooks.length === 0 ? (
          <p className="text-gray-600">No rate books found for this tenant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Effective Window</th>
                  <th className="px-3 py-2 text-left">Tiers</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRateBooks.map((rateBook) => (
                  <tr key={rateBook.id} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-semibold">{rateBook.rateBookCode}</td>
                    <td className="px-3 py-2">{rateBook.productCode} - {rateBook.productName}</td>
                    <td className="px-3 py-2">{rateBook.effectiveFrom} to {rateBook.effectiveTo || 'Open Ended'}</td>
                    <td className="px-3 py-2">{rateBook.tiers?.length || 0}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rateBook.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : rateBook.status === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : rateBook.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rateBook.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleEdit(rateBook)} className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
                        <button onClick={() => void updateApproval(rateBook, ApprovalStatus.Approved)} disabled={!isChecker || rateBook.status !== ApprovalStatus.Pending} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">Approve</button>
                        <button onClick={() => void updateApproval(rateBook, ApprovalStatus.Rejected)} disabled={!isChecker || rateBook.status !== ApprovalStatus.Pending} className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-40">Reject</button>
                        <button onClick={() => void publishRateBook(rateBook)} disabled={!isChecker || rateBook.status !== ApprovalStatus.Approved} className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40">Publish</button>
                        <button onClick={() => void handleDelete(rateBook)} disabled={!isMaker || rateBook.status !== 'Draft'} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterestRateBooksManager;
