import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApprovalStatus } from '../enums';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../services/auditService';
import {
  InterestAssignment,
  InterestProduct,
  InterestRateBook,
} from '../types';
import {
  queryInterestAssignmentsByTenant,
  queryInterestProductsByTenant,
  queryInterestRateBooksByTenant,
} from '../services/multiTenantService';
import {
  calculateInterestPreview,
  InterestCalculationTraceRow,
} from '../services/interestCalculatorService';

type TraceRow = InterestCalculationTraceRow;

interface CalcResult {
  assignment: InterestAssignment;
  product: InterestProduct;
  rateBook: InterestRateBook;
  days: number;
  totalInterest: number;
  closingPrincipal: number;
  annualNominalRate: number;
  trace: TraceRow[];
}

const InterestCalculatorManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();

  const [assignments, setAssignments] = useState<InterestAssignment[]>([]);
  const [products, setProducts] = useState<InterestProduct[]>([]);
  const [rateBooks, setRateBooks] = useState<InterestRateBook[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [principalInput, setPrincipalInput] = useState('10000');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentRows, productRows, rateBookRows] = await Promise.all([
        queryInterestAssignmentsByTenant(effectiveTenantId),
        queryInterestProductsByTenant(effectiveTenantId),
        queryInterestRateBooksByTenant(effectiveTenantId),
      ]);

      setAssignments((assignmentRows as InterestAssignment[]).filter((a) => a.status === ApprovalStatus.Approved));
      setProducts((productRows as InterestProduct[]).filter((p) => p.status === ApprovalStatus.Approved));
      setRateBooks((rateBookRows as InterestRateBook[]).filter((r) => r.status === ApprovalStatus.Approved));
    } catch (error) {
      console.error('Failed loading calculator data:', error);
      setAssignments([]);
      setProducts([]);
      setRateBooks([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAssignments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter((item) => {
      return (
        item.accountId.toLowerCase().includes(term) ||
        (item.customerId || '').toLowerCase().includes(term) ||
        item.productCode.toLowerCase().includes(term) ||
        (item.rateBookCode || '').toLowerCase().includes(term)
      );
    });
  }, [assignments, searchTerm]);

  const runCalculation = useCallback(async () => {
    setErrorMessage('');
    setResult(null);

    const assignment = assignments.find((item) => item.id === selectedAssignmentId);
    if (!assignment) {
      setErrorMessage('Please select an approved assignment.');
      return;
    }

    const product = products.find((item) => item.id === assignment.productId);
    if (!product) {
      setErrorMessage('No approved product found for selected assignment.');
      return;
    }

    const principalStart = Number(principalInput);

    if (!Number.isFinite(principalStart) || principalStart < 0) {
      setErrorMessage('Principal must be a valid non-negative number.');
      return;
    }
    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks,
      principalStart,
      startDateIso: startDate,
      endDateIso: endDate,
      maxDays: 366,
    });

    if (preview.error || !preview.result) {
      setErrorMessage(preview.error || 'Unable to run calculation preview.');
      return;
    }

    const core = preview.result;
    const calcResult: CalcResult = {
      assignment,
      product,
      rateBook: core.rateBookAtEnd,
      days: core.days,
      totalInterest: core.totalInterest,
      closingPrincipal: core.closingPrincipal,
      annualNominalRate: core.annualNominalRate,
      trace: core.trace,
    };

    setResult(calcResult);

    if (currentUser) {
      await logAudit({
        userId: currentUser.email,
        userName: currentUser.name,
        userEmail: currentUser.email,
        action: 'update',
        entityType: 'reference',
        entityId: assignment.id,
        entityName: `calc-preview-${assignment.accountId}`,
        metadata: {
          tenantId: effectiveTenantId,
          domain: 'banking-interest-mvp',
          operation: 'calculator-preview',
          startDate,
          endDate,
          principal: principalStart,
          days: calcResult.days,
          totalInterest: calcResult.totalInterest,
        },
      }).catch((error) => {
        console.warn('Audit log failed for calculator preview:', error);
      });
    }
  }, [assignments, currentUser, effectiveTenantId, endDate, principalInput, products, rateBooks, selectedAssignmentId, startDate]);

  const exportTraceCsv = () => {
    if (!result || result.trace.length === 0) {
      alert('Run a calculation first.');
      return;
    }

    const headers = ['Date', 'OpeningPrincipal', 'AppliedRate', 'DayFraction', 'DayInterest', 'ClosingPrincipal'];
    const lines = [headers.join(',')];
    result.trace.forEach((row) => {
      lines.push([
        row.date,
        row.openingPrincipal,
        row.appliedRate,
        row.dayFraction,
        row.dayInterest,
        row.closingPrincipal,
      ].join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interest-trace-${new Date().toISOString().split('T')[0]}.csv`;
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
      if (key === 'c') {
        event.preventDefault();
        void runCalculation();
        return;
      }
      if (key === 'd') {
        event.preventDefault();
        const start = window.prompt('Start date (YYYY-MM-DD):', startDate);
        const end = window.prompt('End date (YYYY-MM-DD):', endDate);
        if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) setStartDate(start);
        if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) setEndDate(end);
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        exportTraceCsv();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [endDate, runCalculation, startDate, result]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Calculator</h1>
        <p className="text-gray-600">
          Preview deterministic accrual calculations for approved assignments and rate books with trace-level transparency.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Find Account (Alt+F)</label>
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Account, customer, product"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Principal</label>
            <input type="number" step="0.01" value={principalInput} onChange={(e) => setPrincipalInput(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment</label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select approved assignment</option>
              {filteredAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.accountId} | {assignment.productCode} | {assignment.rateBookCode || 'Auto rate book'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void runCalculation()} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            Run Preview (Alt+C)
          </button>
          <button onClick={exportTraceCsv} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">
            Export Trace (Alt+E)
          </button>
          <button onClick={() => void loadData()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
            Refresh
          </button>
        </div>

        {errorMessage && <p className="text-sm text-red-600 mt-3">{errorMessage}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="text-sm text-gray-500">Days</div>
              <div className="text-2xl font-bold text-gray-800">{result.days}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="text-sm text-gray-500">Average Annual Rate %</div>
              <div className="text-2xl font-bold text-blue-700">{result.annualNominalRate.toFixed(4)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="text-sm text-gray-500">Total Interest</div>
              <div className="text-2xl font-bold text-green-700">{result.totalInterest.toFixed(result.product.roundingScale || 6)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <div className="text-sm text-gray-500">Closing Principal</div>
              <div className="text-2xl font-bold text-purple-700">{result.closingPrincipal.toFixed(result.product.roundingScale || 6)}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Calculation Trace</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Opening Principal</th>
                    <th className="px-3 py-2 text-left">Rate %</th>
                    <th className="px-3 py-2 text-left">Day Fraction</th>
                    <th className="px-3 py-2 text-left">Day Interest</th>
                    <th className="px-3 py-2 text-left">Closing Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trace.map((row) => (
                    <tr key={row.date} className="border-t border-gray-200">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.openingPrincipal.toFixed(result.product.roundingScale || 6)}</td>
                      <td className="px-3 py-2">{row.appliedRate.toFixed(4)}</td>
                      <td className="px-3 py-2">{row.dayFraction.toFixed(8)}</td>
                      <td className="px-3 py-2">{row.dayInterest.toFixed(result.product.roundingScale || 6)}</td>
                      <td className="px-3 py-2">{row.closingPrincipal.toFixed(result.product.roundingScale || 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InterestCalculatorManager;
