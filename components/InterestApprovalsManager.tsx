import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';
import { ApprovalStatus, UserRole } from '../enums';
import { InterestProduct, InterestRateBook, InterestApprovalState } from '../types';
import { queryInterestProductsByTenant, queryInterestRateBooksByTenant } from '../services/multiTenantService';

type ApprovalSourceType = 'product' | 'rateBook';

interface ApprovalQueueItem {
  id: string;
  sourceType: ApprovalSourceType;
  code: string;
  name: string;
  status: InterestApprovalState;
  effectiveFrom?: string;
  effectiveTo?: string;
  version?: number;
  updatedAt?: string;
}

const InterestApprovalsManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [products, setProducts] = useState<InterestProduct[]>([]);
  const [rateBooks, setRateBooks] = useState<InterestRateBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'All'>('Pending');
  const [sourceFilter, setSourceFilter] = useState<'All' | ApprovalSourceType>('All');
  const [selectedKey, setSelectedKey] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const canReview = currentUser?.role === UserRole.Checker || currentUser?.role === UserRole.Administrator;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productList, rateBookList] = await Promise.all([
        queryInterestProductsByTenant(effectiveTenantId),
        queryInterestRateBooksByTenant(effectiveTenantId),
      ]);

      setProducts(productList as InterestProduct[]);
      setRateBooks(rateBookList as InterestRateBook[]);
    } catch (error) {
      console.error('Failed loading approval queue data:', error);
      setProducts([]);
      setRateBooks([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const queueItems = useMemo<ApprovalQueueItem[]>(() => {
    const productItems: ApprovalQueueItem[] = products.map((product) => ({
      id: product.id,
      sourceType: 'product',
      code: product.productCode,
      name: product.name,
      status: product.status,
      updatedAt: product.lastModifiedAt,
    }));

    const rateBookItems: ApprovalQueueItem[] = rateBooks.map((rateBook) => ({
      id: rateBook.id,
      sourceType: 'rateBook',
      code: rateBook.rateBookCode,
      name: `${rateBook.productCode} - ${rateBook.productName}`,
      status: rateBook.status,
      effectiveFrom: rateBook.effectiveFrom,
      effectiveTo: rateBook.effectiveTo,
      version: rateBook.version,
      updatedAt: rateBook.lastModifiedAt,
    }));

    return [...productItems, ...rateBookItems].sort((a, b) => {
      const aTime = new Date(a.updatedAt || '').getTime();
      const bTime = new Date(b.updatedAt || '').getTime();
      return bTime - aTime;
    });
  }, [products, rateBooks]);

  const filteredQueue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return queueItems.filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }
      if (sourceFilter !== 'All' && item.sourceType !== sourceFilter) {
        return false;
      }
      if (!term) return true;
      return (
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term) ||
        item.sourceType.toLowerCase().includes(term)
      );
    });
  }, [queueItems, searchTerm, statusFilter, sourceFilter]);

  const selectedItem = useMemo(() => {
    return filteredQueue.find((item) => `${item.sourceType}:${item.id}` === selectedKey) || null;
  }, [filteredQueue, selectedKey]);

  const resolveQueueItemPath = (item: ApprovalQueueItem): string => {
    return item.sourceType === 'product'
      ? `banking/interestProducts/${item.id}`
      : `banking/interestRateBooks/${item.id}`;
  };

  const applyStatus = useCallback(async (item: ApprovalQueueItem, nextStatus: ApprovalStatus.Approved | ApprovalStatus.Rejected) => {
    if (!currentUser || !canReview) {
      alert('Only Checker or Administrator can approve/reject queue items.');
      return;
    }
    if (item.status !== ApprovalStatus.Pending) {
      alert('Only Pending items can be approved or rejected.');
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
      await update(ref(db, resolveQueueItemPath(item)), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: nextStatus === ApprovalStatus.Approved ? 'approve' : 'reject',
        entityType: 'reference',
        entityId: item.id,
        entityName: `${item.code} - ${item.name}`,
        changes: [{ field: 'status', oldValue: item.status, newValue: nextStatus }],
        metadata: {
          tenantId: effectiveTenantId,
          sourceType: item.sourceType,
          domain: 'banking-interest-mvp',
        },
      });
      await fetchData();
    } catch (error) {
      console.error('Failed approval action:', error);
      alert('Approval action failed.');
    }
  }, [canReview, currentUser, effectiveTenantId, fetchData]);

  const publishRateBook = useCallback(async (item: ApprovalQueueItem) => {
    if (!currentUser || !canReview) {
      alert('Only Checker or Administrator can publish approved items.');
      return;
    }
    if (item.sourceType !== 'rateBook') {
      alert('Publish is only supported for rate books.');
      return;
    }
    if (item.status !== ApprovalStatus.Approved) {
      alert('Only Approved rate books can be published.');
      return;
    }

    const payload = {
      publishedBy: currentUser.email,
      publishedAt: new Date().toISOString(),
      lastModifiedBy: currentUser.email,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      await update(ref(db, resolveQueueItemPath(item)), payload);
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'update',
        entityType: 'reference',
        entityId: item.id,
        entityName: `${item.code} - ${item.name}`,
        changes: [{ field: 'publishedAt', oldValue: null, newValue: payload.publishedAt }],
        metadata: {
          tenantId: effectiveTenantId,
          sourceType: item.sourceType,
          domain: 'banking-interest-mvp',
          operation: 'publish',
        },
      });
      await fetchData();
    } catch (error) {
      console.error('Publish action failed:', error);
      alert('Publish action failed.');
    }
  }, [canReview, currentUser, effectiveTenantId, fetchData]);

  const exportQueueCsv = () => {
    if (filteredQueue.length === 0) {
      alert('No queue rows to export.');
      return;
    }

    const headers = ['Source', 'Code', 'Name', 'Status', 'EffectiveFrom', 'EffectiveTo', 'Version', 'UpdatedAt'];
    const lines = [headers.join(',')];

    filteredQueue.forEach((item) => {
      const row = [
        item.sourceType,
        `"${item.code}"`,
        `"${item.name}"`,
        item.status,
        item.effectiveFrom || '',
        item.effectiveTo || '',
        item.version ?? '',
        item.updatedAt || '',
      ];
      lines.push(row.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `interest-approvals-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === 'q') {
        event.preventDefault();
        setStatusFilter('Pending');
        setSourceFilter('All');
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        exportQueueCsv();
        return;
      }

      if (!selectedItem) return;

      if (key === 'a') {
        event.preventDefault();
        void applyStatus(selectedItem, ApprovalStatus.Approved);
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        void applyStatus(selectedItem, ApprovalStatus.Rejected);
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        void publishRateBook(selectedItem);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyStatus, publishRateBook, selectedItem, filteredQueue]);

  if (!canReview) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Access Denied</h1>
        <p className="text-gray-600">Only Checker or Administrator roles can review approval queue items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Approval Workbench</h1>
        <p className="text-gray-600">
          Consolidated maker-checker queue for Interest Products and Interest Rate Books with auditable release actions.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Code, name, source, status"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter (Alt+Q)</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'Pending' | 'Approved' | 'All')} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="All">All</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Filter</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as 'All' | ApprovalSourceType)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="All">All</option>
              <option value="product">Interest Products</option>
              <option value="rateBook">Interest Rate Books</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => fetchData()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Refresh</button>
          <button onClick={exportQueueCsv} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">Export CSV (Alt+X)</button>
          <button
            onClick={() => selectedItem && void applyStatus(selectedItem, ApprovalStatus.Approved)}
            disabled={!selectedItem || selectedItem.status !== ApprovalStatus.Pending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
          >
            Approve Selected (Alt+A)
          </button>
          <button
            onClick={() => selectedItem && void applyStatus(selectedItem, ApprovalStatus.Rejected)}
            disabled={!selectedItem || selectedItem.status !== ApprovalStatus.Pending}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40"
          >
            Reject Selected (Alt+R)
          </button>
          <button
            onClick={() => selectedItem && void publishRateBook(selectedItem)}
            disabled={!selectedItem || selectedItem.sourceType !== 'rateBook' || selectedItem.status !== ApprovalStatus.Approved}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40"
          >
            Publish Selected (Alt+P)
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Queue ({filteredQueue.length})</h2>

        {isLoading ? (
          <p className="text-gray-600">Loading queue...</p>
        ) : filteredQueue.length === 0 ? (
          <p className="text-gray-600">No queue items match current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Select</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Effective Window</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Version</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((item) => {
                  const rowKey = `${item.sourceType}:${item.id}`;
                  return (
                    <tr key={rowKey} className="border-t border-gray-200">
                      <td className="px-3 py-2">
                        <input type="radio" checked={selectedKey === rowKey} onChange={() => setSelectedKey(rowKey)} />
                      </td>
                      <td className="px-3 py-2">{item.sourceType === 'product' ? 'Interest Product' : 'Rate Book'}</td>
                      <td className="px-3 py-2 font-semibold">{item.code}</td>
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.effectiveFrom ? `${item.effectiveFrom} to ${item.effectiveTo || 'Open Ended'}` : '-'}</td>
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
                      <td className="px-3 py-2">{item.version || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void applyStatus(item, ApprovalStatus.Approved)}
                            disabled={item.status !== ApprovalStatus.Pending}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => void applyStatus(item, ApprovalStatus.Rejected)}
                            disabled={item.status !== ApprovalStatus.Pending}
                            className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-40"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => void publishRateBook(item)}
                            disabled={item.sourceType !== 'rateBook' || item.status !== ApprovalStatus.Approved}
                            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40"
                          >
                            Publish
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterestApprovalsManager;
