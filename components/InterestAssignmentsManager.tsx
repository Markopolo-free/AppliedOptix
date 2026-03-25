import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { push, ref, remove, set, update } from 'firebase/database';
import { db } from '../services/firebase';
import { ApprovalStatus, UserRole } from '../enums';
import { useAuth } from '../contexts/AuthContext';
import { logAudit, calculateChanges } from '../services/auditService';
import { InterestAssignment, InterestProduct, InterestRateBook, InterestApprovalState } from '../types';
import {
  queryInterestAssignmentsByTenant,
  queryInterestProductsByTenant,
  queryInterestRateBooksByTenant,
} from '../services/multiTenantService';

const initialFormState = {
  accountId: '',
  customerId: '',
  productId: '',
  rateBookId: '',
  segmentCode: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
};

const InterestAssignmentsManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [products, setProducts] = useState<InterestProduct[]>([]);
  const [rateBooks, setRateBooks] = useState<InterestRateBook[]>([]);
  const [assignments, setAssignments] = useState<InterestAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InterestApprovalState>('all');
  const [formData, setFormData] = useState(initialFormState);
  const [editingItem, setEditingItem] = useState<InterestAssignment | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMaker = currentUser?.role === UserRole.Maker || currentUser?.role === UserRole.Administrator;
  const isChecker = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productRows, rateBookRows, assignmentRows] = await Promise.all([
        queryInterestProductsByTenant(effectiveTenantId),
        queryInterestRateBooksByTenant(effectiveTenantId),
        queryInterestAssignmentsByTenant(effectiveTenantId),
      ]);

      setProducts(productRows as InterestProduct[]);
      setRateBooks((rateBookRows as InterestRateBook[]).filter((book) => book.status === ApprovalStatus.Approved));
      setAssignments((assignmentRows as InterestAssignment[]).sort((a, b) => {
        const aTime = new Date(a.lastModifiedAt || '').getTime();
        const bTime = new Date(b.lastModifiedAt || '').getTime();
        return bTime - aTime;
      }));
    } catch (error) {
      console.error('Failed loading assignment data:', error);
      setProducts([]);
      setRateBooks([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingItem(null);
    setErrorMessage('');
  };

  const availableRateBooks = useMemo(() => {
    if (!formData.productId) return rateBooks;
    return rateBooks.filter((book) => book.productId === formData.productId);
  }, [formData.productId, rateBooks]);

  const filteredAssignments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return assignments.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!term) return true;
      return (
        item.accountId.toLowerCase().includes(term) ||
        (item.customerId || '').toLowerCase().includes(term) ||
        item.productCode.toLowerCase().includes(term) ||
        (item.rateBookCode || '').toLowerCase().includes(term)
      );
    });
  }, [assignments, searchTerm, statusFilter]);

  const validateForm = (): boolean => {
    if (!formData.accountId.trim()) {
      setErrorMessage('Account ID is required.');
      return false;
    }
    if (!formData.productId) {
      setErrorMessage('Interest product selection is required.');
      return false;
    }
    if (!formData.startDate) {
      setErrorMessage('Start date is required.');
      return false;
    }
    if (formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      setErrorMessage('End date must be on/after start date.');
      return false;
    }

    const duplicate = assignments.find((item) => {
      if (editingItem && item.id === editingItem.id) return false;
      return item.accountId.toLowerCase() === formData.accountId.trim().toLowerCase() && item.status !== ApprovalStatus.Rejected;
    });
    if (duplicate) {
      setErrorMessage('An active assignment already exists for this account.');
      return false;
    }

    setErrorMessage('');
    return true;
  };

  const buildPayload = (status: InterestApprovalState): Omit<InterestAssignment, 'id'> | null => {
    const product = products.find((p) => p.id === formData.productId);
    if (!product) return null;
    const rateBook = rateBooks.find((book) => book.id === formData.rateBookId);
    const nowIso = new Date().toISOString();

    const payload: any = {
      accountId: formData.accountId.trim(),
      productId: product.id,
      productCode: product.productCode,
      productName: product.name,
      startDate: formData.startDate,
      endDate: formData.endDate || '',
      status,
      tenantId: effectiveTenantId,
      makerName: editingItem?.makerName || currentUser?.name || 'Unknown User',
      makerEmail: editingItem?.makerEmail || currentUser?.email || '',
      makerTimestamp: editingItem?.makerTimestamp || nowIso,
      lastModifiedBy: currentUser?.email || 'usr_admin',
      lastModifiedAt: nowIso,
    };

    // Only include optional fields when they have values — Firebase rejects undefined
    if (formData.customerId.trim()) payload.customerId = formData.customerId.trim();
    if (rateBook?.id) payload.rateBookId = rateBook.id;
    if (rateBook?.rateBookCode) payload.rateBookCode = rateBook.rateBookCode;
    if (formData.segmentCode.trim()) payload.segmentCode = formData.segmentCode.trim();
    if (editingItem?.checkerName) payload.checkerName = editingItem.checkerName;
    if (editingItem?.checkerEmail) payload.checkerEmail = editingItem.checkerEmail;
    if (editingItem?.checkerTimestamp) payload.checkerTimestamp = editingItem.checkerTimestamp;

    return payload as Omit<InterestAssignment, 'id'>;
  };

  const saveAssignment = useCallback(async (targetStatus: InterestApprovalState) => {
    if (!currentUser || !isMaker) {
      alert('Only Maker or Administrator can save assignments.');
      return;
    }
    if (!validateForm()) return;

    const payload = buildPayload(targetStatus);
    if (!payload) {
      alert('Unable to resolve selected product or rate book.');
      return;
    }

    setSaving(true);
    try {
      const entityName = `${payload.accountId} -> ${payload.productCode}`;

      if (editingItem) {
        await update(ref(db, `banking/interestAssignments/${editingItem.id}`), payload);
        await logAudit({
          userId: currentUser.email,
          userName: currentUser.name,
          userEmail: currentUser.email,
          action: 'update',
          entityType: 'reference',
          entityId: editingItem.id,
          entityName,
          changes: calculateChanges(editingItem as Record<string, any>, payload as Record<string, any>),
          metadata: {
            tenantId: effectiveTenantId,
            domain: 'banking-interest-mvp',
            status: targetStatus,
          },
        });
      } else {
        const rootRef = ref(db, 'banking/interestAssignments');
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

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Failed saving assignment:', error);
      alert('Failed saving assignment.');
    } finally {
      setSaving(false);
    }
  }, [buildPayload, currentUser, editingItem, effectiveTenantId, formData, isMaker, loadData, products, rateBooks]);

  const updateApproval = async (item: InterestAssignment, nextStatus: ApprovalStatus.Approved | ApprovalStatus.Rejected) => {
    if (!currentUser || !isChecker) {
      alert('Only Checker or Administrator can approve/reject assignments.');
      return;
    }
    if (item.status !== ApprovalStatus.Pending) {
      alert('Only Pending assignments can be approved/rejected.');
      return;
    }

    const payload = {
      status: nextStatus,
      checkerName: currentUser.name,
      checkerEmail: currentUser.email,
      checkerTimestamp: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      await update(ref(db, `banking/interestAssignments/${item.id}`), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: nextStatus === ApprovalStatus.Approved ? 'approve' : 'reject',
        entityType: 'reference',
        entityId: item.id,
        entityName: `${item.accountId} -> ${item.productCode}`,
        changes: [{ field: 'status', oldValue: item.status, newValue: nextStatus }],
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
        },
      });
      await loadData();
    } catch (error) {
      console.error('Failed updating assignment approval:', error);
      alert('Approval action failed.');
    }
  };

  const handleDelete = async (item: InterestAssignment) => {
    if (!currentUser || !isMaker) {
      alert('Only Maker or Administrator can delete assignments.');
      return;
    }
    if (item.status !== 'Draft') {
      alert('Only Draft assignments can be deleted.');
      return;
    }
    if (!window.confirm(`Delete assignment for account ${item.accountId}?`)) return;

    try {
      await remove(ref(db, `banking/interestAssignments/${item.id}`));
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'delete',
        entityType: 'reference',
        entityId: item.id,
        entityName: `${item.accountId} -> ${item.productCode}`,
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
        },
      });
      await loadData();
      if (editingItem?.id === item.id) {
        resetForm();
      }
    } catch (error) {
      console.error('Failed deleting assignment:', error);
      alert('Delete failed.');
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
      if (key === 'l') {
        event.preventDefault();
        const approvedRateBook = availableRateBooks.find((book) => book.status === ApprovalStatus.Approved);
        if (approvedRateBook) {
          setFormData((prev) => ({ ...prev, rateBookId: approvedRateBook.id }));
        }
        return;
      }
      if (key === 's' && isMaker) {
        event.preventDefault();
        void saveAssignment('Draft');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [availableRateBooks, isMaker, saveAssignment]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Account Assignment Manager</h1>
        <p className="text-gray-600">
          Assign products and approved rate books to accounts with effective dating and maker-checker governance.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Find Account (Alt+F)</label>
            <input ref={searchInputRef} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Account, customer, product" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | InterestApprovalState)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => void loadData()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Refresh</button>
            <button onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">New (Alt+N)</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Assignment Setup</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveAssignment('Draft');
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account ID</label>
            <input value={formData.accountId} onChange={(e) => setFormData((p) => ({ ...p, accountId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
            <input value={formData.customerId} onChange={(e) => setFormData((p) => ({ ...p, customerId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Product</label>
            <select value={formData.productId} onChange={(e) => setFormData((p) => ({ ...p, productId: e.target.value, rateBookId: '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.productCode} - {product.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Book Override</label>
            <select value={formData.rateBookId} onChange={(e) => setFormData((p) => ({ ...p, rateBookId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="">Auto by rules</option>
              {availableRateBooks.map((book) => (
                <option key={book.id} value={book.id}>{book.rateBookCode} ({book.effectiveFrom})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segment Code</label>
            <input value={formData.segmentCode} onChange={(e) => setFormData((p) => ({ ...p, segmentCode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={formData.startDate} onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={formData.endDate} onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>

          <div className="lg:col-span-4 flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={!isMaker || saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {editingItem ? 'Update Draft' : 'Save Draft'} (Alt+S)
            </button>
            <button type="button" disabled={!isMaker || saving} onClick={() => void saveAssignment('Pending')} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
              Submit for Approval
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Clear</button>
          </div>
        </form>
        {errorMessage && <p className="text-sm text-red-600 mt-3">{errorMessage}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Assignments ({filteredAssignments.length})</h2>

        {loading ? (
          <p className="text-gray-600">Loading assignments...</p>
        ) : filteredAssignments.length === 0 ? (
          <p className="text-gray-600">No assignments found for current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Rate Book</th>
                  <th className="px-3 py-2 text-left">Date Window</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((item) => (
                  <tr key={item.id} className="border-t border-gray-200">
                    <td className="px-3 py-2 font-semibold">{item.accountId}</td>
                    <td className="px-3 py-2">{item.customerId || '-'}</td>
                    <td className="px-3 py-2">{item.productCode}</td>
                    <td className="px-3 py-2">{item.rateBookCode || 'Auto'}</td>
                    <td className="px-3 py-2">{item.startDate} to {item.endDate || 'Open Ended'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : item.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setFormData({
                              accountId: item.accountId,
                              customerId: item.customerId || '',
                              productId: item.productId,
                              rateBookId: item.rateBookId || '',
                              segmentCode: item.segmentCode || '',
                              startDate: item.startDate,
                              endDate: item.endDate || '',
                            });
                          }}
                          className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button onClick={() => void updateApproval(item, ApprovalStatus.Approved)} disabled={!isChecker || item.status !== ApprovalStatus.Pending} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">Approve</button>
                        <button onClick={() => void updateApproval(item, ApprovalStatus.Rejected)} disabled={!isChecker || item.status !== ApprovalStatus.Pending} className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-40">Reject</button>
                        <button onClick={() => void handleDelete(item)} disabled={!isMaker || item.status !== 'Draft'} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40">Delete</button>
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

export default InterestAssignmentsManager;
