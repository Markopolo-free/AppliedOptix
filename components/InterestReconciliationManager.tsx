import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { InterestAccrualResult, InterestPayoutResult } from '../types';
import { queryInterestAccrualsByTenant, queryInterestPayoutsByTenant } from '../services/multiTenantService';

interface ReconciliationRow {
  key: string;
  accountId: string;
  productCode: string;
  periodDate: string;
  accruedTotal: number;
  paidTotal: number;
  variance: number;
  variancePct: number;
  status: 'matched' | 'minor-variance' | 'major-variance' | 'unmatched';
  accrualCount: number;
  payoutCount: number;
}

const InterestReconciliationManager: React.FC = () => {
  const { effectiveTenantId } = useAuth();

  const [accruals, setAccruals] = useState<InterestAccrualResult[]>([]);
  const [payouts, setPayouts] = useState<InterestPayoutResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [businessDate, setBusinessDate] = useState(new Date().toISOString().split('T')[0]);
  const [varianceThreshold, setVarianceThreshold] = useState('0.50');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReconciliationRow['status']>('all');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accrualRows, payoutRows] = await Promise.all([
        queryInterestAccrualsByTenant(effectiveTenantId),
        queryInterestPayoutsByTenant(effectiveTenantId),
      ]);

      setAccruals(accrualRows as InterestAccrualResult[]);
      setPayouts(payoutRows as InterestPayoutResult[]);
    } catch (error) {
      console.error('Failed loading reconciliation data:', error);
      setAccruals([]);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const products = useMemo(() => {
    return Array.from(new Set([
      ...accruals.map((item) => item.productCode || ''),
      ...payouts.map((item) => item.productCode || ''),
    ].filter(Boolean))).sort();
  }, [accruals, payouts]);

  const reconciliationRows = useMemo<ReconciliationRow[]>(() => {
    const threshold = Number(varianceThreshold);
    const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 0;

    const bucket = new Map<string, {
      accountId: string;
      productCode: string;
      periodDate: string;
      accruedTotal: number;
      paidTotal: number;
      accrualCount: number;
      payoutCount: number;
    }>();

    accruals.forEach((item) => {
      const periodDate = item.asOfDate || '';
      const key = `${item.accountId}|${item.productCode || 'UNKNOWN'}|${periodDate}`;
      const existing = bucket.get(key) || {
        accountId: item.accountId,
        productCode: item.productCode || 'UNKNOWN',
        periodDate,
        accruedTotal: 0,
        paidTotal: 0,
        accrualCount: 0,
        payoutCount: 0,
      };
      existing.accruedTotal += Number(item.accruedAmount || 0);
      existing.accrualCount += 1;
      bucket.set(key, existing);
    });

    payouts.forEach((item) => {
      const periodDate = item.payoutDate || item.periodEnd || item.periodStart || '';
      const key = `${item.accountId}|${item.productCode || 'UNKNOWN'}|${periodDate}`;
      const existing = bucket.get(key) || {
        accountId: item.accountId,
        productCode: item.productCode || 'UNKNOWN',
        periodDate,
        accruedTotal: 0,
        paidTotal: 0,
        accrualCount: 0,
        payoutCount: 0,
      };
      existing.paidTotal += Number(item.netInterest || 0);
      existing.payoutCount += 1;
      bucket.set(key, existing);
    });

    return Array.from(bucket.entries()).map(([key, value]) => {
      const variance = value.paidTotal - value.accruedTotal;
      const denominator = value.accruedTotal === 0 ? 1 : Math.abs(value.accruedTotal);
      const variancePct = (Math.abs(variance) / denominator) * 100;

      let status: ReconciliationRow['status'] = 'matched';
      if (value.accrualCount === 0 || value.payoutCount === 0) {
        status = 'unmatched';
      } else if (Math.abs(variance) <= safeThreshold) {
        status = 'matched';
      } else if (Math.abs(variance) <= safeThreshold * 2) {
        status = 'minor-variance';
      } else {
        status = 'major-variance';
      }

      return {
        key,
        accountId: value.accountId,
        productCode: value.productCode,
        periodDate: value.periodDate,
        accruedTotal: value.accruedTotal,
        paidTotal: value.paidTotal,
        variance,
        variancePct,
        status,
        accrualCount: value.accrualCount,
        payoutCount: value.payoutCount,
      };
    }).sort((a, b) => {
      const aTime = new Date(a.periodDate || '').getTime();
      const bTime = new Date(b.periodDate || '').getTime();
      return bTime - aTime;
    });
  }, [accruals, payouts, varianceThreshold]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return reconciliationRows.filter((row) => {
      if (businessDate && row.periodDate !== businessDate) return false;
      if (productFilter !== 'all' && row.productCode !== productFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (exceptionsOnly && (row.status === 'matched')) return false;

      if (!term) return true;
      return (
        row.accountId.toLowerCase().includes(term) ||
        row.productCode.toLowerCase().includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    });
  }, [businessDate, exceptionsOnly, productFilter, reconciliationRows, searchTerm, statusFilter]);

  const selectedRow = useMemo(() => {
    return filteredRows.find((row) => row.key === selectedKey) || null;
  }, [filteredRows, selectedKey]);

  const summary = useMemo(() => {
    const totals = filteredRows.reduce((acc, row) => {
      acc.accrued += row.accruedTotal;
      acc.paid += row.paidTotal;
      acc.variance += row.variance;
      if (row.status !== 'matched') acc.exceptions += 1;
      return acc;
    }, { accrued: 0, paid: 0, variance: 0, exceptions: 0 });

    return {
      ...totals,
      totalRows: filteredRows.length,
      matchedRows: filteredRows.length - totals.exceptions,
    };
  }, [filteredRows]);

  const exportCsv = () => {
    if (filteredRows.length === 0) {
      alert('No reconciliation rows to export.');
      return;
    }

    const headers = [
      'PeriodDate',
      'AccountId',
      'ProductCode',
      'AccruedTotal',
      'PaidTotal',
      'Variance',
      'VariancePct',
      'Status',
      'AccrualCount',
      'PayoutCount',
    ];

    const lines = [headers.join(',')];

    filteredRows.forEach((row) => {
      lines.push([
        row.periodDate,
        row.accountId,
        row.productCode,
        row.accruedTotal.toFixed(6),
        row.paidTotal.toFixed(6),
        row.variance.toFixed(6),
        row.variancePct.toFixed(2),
        row.status,
        row.accrualCount,
        row.payoutCount,
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interest-reconciliation-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === 'd') {
        event.preventDefault();
        const input = window.prompt('Enter business date (YYYY-MM-DD):', businessDate);
        if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
          setBusinessDate(input);
        }
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        void loadData();
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        exportCsv();
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        setExceptionsOnly((prev) => !prev);
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [businessDate, loadData, filteredRows]);

  const statusBadgeClass = (status: ReconciliationRow['status']) => {
    if (status === 'matched') return 'bg-green-100 text-green-800';
    if (status === 'minor-variance') return 'bg-amber-100 text-amber-800';
    if (status === 'major-variance') return 'bg-red-100 text-red-800';
    return 'bg-purple-100 text-purple-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Reconciliation Dashboard</h1>
        <p className="text-gray-600">
          Monitor calculated-versus-paid variances and track operational exceptions for interest outcomes.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Date (Alt+D)</label>
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variance Threshold</label>
            <input type="number" step="0.01" value={varianceThreshold} onChange={(e) => setVarianceThreshold(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              {products.map((product) => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ReconciliationRow['status'])} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              <option value="matched">Matched</option>
              <option value="minor-variance">Minor Variance</option>
              <option value="major-variance">Major Variance</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input ref={searchInputRef} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Account/Product/Status" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setExceptionsOnly((v) => !v)} className={`px-4 py-2 rounded-lg ${exceptionsOnly ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            Exceptions Only (Alt+E)
          </button>
          <button onClick={() => void loadData()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            Run Reconciliation (Alt+R)
          </button>
          <button onClick={exportCsv} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">
            Export Variance Report (Alt+X)
          </button>
          <button
            onClick={() => {
              setProductFilter('all');
              setStatusFilter('all');
              setExceptionsOnly(false);
              setSearchTerm('');
              setSelectedKey('');
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">Rows</div>
          <div className="text-2xl font-bold text-gray-800">{summary.totalRows}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">Matched</div>
          <div className="text-2xl font-bold text-green-700">{summary.matchedRows}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">Exceptions</div>
          <div className="text-2xl font-bold text-red-700">{summary.exceptions}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">Accrued Total</div>
          <div className="text-2xl font-bold text-blue-700">{summary.accrued.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-500">Net Variance</div>
          <div className={`text-2xl font-bold ${Math.abs(summary.variance) <= Number(varianceThreshold || 0) ? 'text-green-700' : 'text-red-700'}`}>
            {summary.variance.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Variance Rows ({filteredRows.length})</h2>

          {loading ? (
            <p className="text-gray-600">Running reconciliation...</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-gray-600">No reconciliation rows for selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Exception</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Accrued</th>
                    <th className="px-3 py-2 text-left">Paid</th>
                    <th className="px-3 py-2 text-left">Variance</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.key} className={`border-t border-gray-200 ${selectedKey === row.key ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => setSelectedKey(row.key)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">View</button>
                      </td>
                      <td className="px-3 py-2">{row.periodDate || '-'}</td>
                      <td className="px-3 py-2">{row.accountId}</td>
                      <td className="px-3 py-2">{row.productCode}</td>
                      <td className="px-3 py-2">{row.accruedTotal.toFixed(6)}</td>
                      <td className="px-3 py-2">{row.paidTotal.toFixed(6)}</td>
                      <td className={`px-3 py-2 font-semibold ${Math.abs(row.variance) <= Number(varianceThreshold || 0) ? 'text-green-700' : 'text-red-700'}`}>
                        {row.variance.toFixed(6)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Exception Detail</h2>
          {!selectedRow ? (
            <p className="text-gray-600">Select a variance row to inspect exception detail.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Date:</span> {selectedRow.periodDate || '-'}</div>
              <div><span className="font-semibold">Account:</span> {selectedRow.accountId}</div>
              <div><span className="font-semibold">Product:</span> {selectedRow.productCode}</div>
              <div><span className="font-semibold">Accrual Count:</span> {selectedRow.accrualCount}</div>
              <div><span className="font-semibold">Payout Count:</span> {selectedRow.payoutCount}</div>
              <div><span className="font-semibold">Accrued Total:</span> {selectedRow.accruedTotal.toFixed(6)}</div>
              <div><span className="font-semibold">Paid Total:</span> {selectedRow.paidTotal.toFixed(6)}</div>
              <div><span className="font-semibold">Variance:</span> {selectedRow.variance.toFixed(6)}</div>
              <div><span className="font-semibold">Variance %:</span> {selectedRow.variancePct.toFixed(2)}%</div>
              <div>
                <span className="font-semibold">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(selectedRow.status)}`}>
                  {selectedRow.status}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterestReconciliationManager;
