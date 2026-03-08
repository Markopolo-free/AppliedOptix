import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { InterestAccrualResult, InterestPayoutResult } from '../types';
import { queryInterestAccrualsByTenant, queryInterestPayoutsByTenant } from '../services/multiTenantService';

type ResultTab = 'accruals' | 'payouts';

const InterestResultsManager: React.FC = () => {
  const { effectiveTenantId } = useAuth();

  const [tab, setTab] = useState<ResultTab>('accruals');
  const [accruals, setAccruals] = useState<InterestAccrualResult[]>([]);
  const [payouts, setPayouts] = useState<InterestPayoutResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accrualRows, payoutRows] = await Promise.all([
        queryInterestAccrualsByTenant(effectiveTenantId),
        queryInterestPayoutsByTenant(effectiveTenantId),
      ]);

      const typedAccruals = (accrualRows as InterestAccrualResult[]).sort((a, b) => {
        const aTime = new Date(a.asOfDate || a.lastModifiedAt || '').getTime();
        const bTime = new Date(b.asOfDate || b.lastModifiedAt || '').getTime();
        return bTime - aTime;
      });

      const typedPayouts = (payoutRows as InterestPayoutResult[]).sort((a, b) => {
        const aTime = new Date(a.payoutDate || a.lastModifiedAt || '').getTime();
        const bTime = new Date(b.payoutDate || b.lastModifiedAt || '').getTime();
        return bTime - aTime;
      });

      setAccruals(typedAccruals);
      setPayouts(typedPayouts);
    } catch (error) {
      console.error('Failed loading interest results:', error);
      setAccruals([]);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accrualProducts = useMemo(() => {
    return Array.from(new Set(accruals.map((r) => r.productCode).filter(Boolean))).sort();
  }, [accruals]);

  const payoutProducts = useMemo(() => {
    return Array.from(new Set(payouts.map((r) => r.productCode).filter(Boolean))).sort();
  }, [payouts]);

  const filteredAccruals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return accruals.filter((row) => {
      if (statusFilter !== 'all' && (row.status || 'calculated').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (productFilter !== 'all' && (row.productCode || '') !== productFilter) return false;
      if (fromDate && row.asOfDate < fromDate) return false;
      if (toDate && row.asOfDate > toDate) return false;
      if (!term) return true;

      return (
        (row.accountId || '').toLowerCase().includes(term) ||
        (row.productCode || '').toLowerCase().includes(term) ||
        (row.rateBookCode || '').toLowerCase().includes(term) ||
        (row.calculationTraceId || '').toLowerCase().includes(term)
      );
    });
  }, [accruals, fromDate, productFilter, searchTerm, statusFilter, toDate]);

  const filteredPayouts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return payouts.filter((row) => {
      if (statusFilter !== 'all' && (row.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (productFilter !== 'all' && (row.productCode || '') !== productFilter) return false;
      if (fromDate && row.payoutDate < fromDate) return false;
      if (toDate && row.payoutDate > toDate) return false;
      if (!term) return true;

      return (
        (row.accountId || '').toLowerCase().includes(term) ||
        (row.productCode || '').toLowerCase().includes(term) ||
        (row.rateBookCode || '').toLowerCase().includes(term) ||
        (row.status || '').toLowerCase().includes(term)
      );
    });
  }, [fromDate, payouts, productFilter, searchTerm, statusFilter, toDate]);

  const selectedRecord = useMemo(() => {
    if (tab === 'accruals') {
      return filteredAccruals.find((row) => row.id === selectedId) || null;
    }
    return filteredPayouts.find((row) => row.id === selectedId) || null;
  }, [filteredAccruals, filteredPayouts, selectedId, tab]);

  const exportCsv = () => {
    const rows = tab === 'accruals' ? filteredAccruals : filteredPayouts;
    if (rows.length === 0) {
      alert('No rows available for export.');
      return;
    }

    const headers = tab === 'accruals'
      ? ['AccountId', 'AsOfDate', 'PrincipalForDay', 'AppliedRate', 'DayFraction', 'AccruedAmount', 'ProductCode', 'RateBookCode', 'TraceId', 'Status']
      : ['AccountId', 'PeriodStart', 'PeriodEnd', 'GrossInterest', 'TaxAmount', 'NetInterest', 'PayoutDate', 'Status', 'ProductCode', 'RateBookCode'];

    const lines = [headers.join(',')];

    rows.forEach((row: any) => {
      if (tab === 'accruals') {
        lines.push([
          row.accountId,
          row.asOfDate,
          row.principalForDay,
          row.appliedRate,
          row.dayFraction,
          row.accruedAmount,
          row.productCode || '',
          row.rateBookCode || '',
          row.calculationTraceId || '',
          row.status || 'calculated',
        ].join(','));
      } else {
        lines.push([
          row.accountId,
          row.periodStart,
          row.periodEnd,
          row.grossInterest,
          row.taxAmount,
          row.netInterest,
          row.payoutDate,
          row.status,
          row.productCode || '',
          row.rateBookCode || '',
        ].join(','));
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interest-${tab}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        exportCsv();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        void loadData();
        return;
      }
      if (key === 't') {
        event.preventDefault();
        const list = tab === 'accruals' ? filteredAccruals : filteredPayouts;
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredAccruals, filteredPayouts, loadData, selectedId, tab]);

  const activeRows = tab === 'accruals' ? filteredAccruals : filteredPayouts;
  const activeProducts = tab === 'accruals' ? accrualProducts : payoutProducts;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Accrual & Payout Results</h1>
        <p className="text-gray-600">
          Operational reporting for banking interest calculations with tenant-safe filters and export-ready outputs.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => { setTab('accruals'); setSelectedId(''); }} className={`px-4 py-2 rounded-lg ${tab === 'accruals' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            Accruals
          </button>
          <button onClick={() => { setTab('payouts'); setSelectedId(''); }} className={`px-4 py-2 rounded-lg ${tab === 'payouts' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
            Payouts
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input ref={searchInputRef} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Account, product, rate book, trace" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              <option value="calculated">Calculated</option>
              <option value="posted">Posted</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              {activeProducts.map((productCode) => (
                <option key={productCode} value={productCode}>{productCode}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setProductFilter('all'); setFromDate(''); setToDate(''); }} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Clear</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => void loadData()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Refresh (Alt+R)</button>
            <button onClick={exportCsv} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">Export CSV (Alt+X)</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{tab === 'accruals' ? 'Accrual Records' : 'Payout Records'} ({activeRows.length})</h2>

          {loading ? (
            <p className="text-gray-600">Loading results...</p>
          ) : activeRows.length === 0 ? (
            <p className="text-gray-600">No records found for current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  {tab === 'accruals' ? (
                    <tr>
                      <th className="px-3 py-2 text-left">Trace</th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">As Of</th>
                      <th className="px-3 py-2 text-left">Accrued Amount</th>
                      <th className="px-3 py-2 text-left">Rate %</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-3 py-2 text-left">Trace</th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Payout Date</th>
                      <th className="px-3 py-2 text-left">Gross</th>
                      <th className="px-3 py-2 text-left">Tax</th>
                      <th className="px-3 py-2 text-left">Net</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeRows.map((row: any) => (
                    <tr key={row.id} className={`border-t border-gray-200 ${selectedId === row.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => setSelectedId(row.id)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">View (Alt+T)</button>
                      </td>
                      <td className="px-3 py-2">{row.accountId}</td>
                      {tab === 'accruals' ? (
                        <>
                          <td className="px-3 py-2">{row.asOfDate}</td>
                          <td className="px-3 py-2">{Number(row.accruedAmount || 0).toFixed(6)}</td>
                          <td className="px-3 py-2">{Number(row.appliedRate || 0).toFixed(4)}</td>
                          <td className="px-3 py-2">{row.productCode || '-'}</td>
                          <td className="px-3 py-2">{row.status || 'calculated'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">{row.payoutDate}</td>
                          <td className="px-3 py-2">{Number(row.grossInterest || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{Number(row.taxAmount || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{Number(row.netInterest || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">{row.status || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Result Details</h2>
          {!selectedRecord ? (
            <p className="text-gray-600">Select a row to view full detail.</p>
          ) : (
            <pre className="bg-gray-100 rounded p-3 text-xs overflow-auto">{JSON.stringify(selectedRecord, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterestResultsManager;
