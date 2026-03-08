import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDatabase, onValue, orderByChild, query, ref } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { AuditLog } from '../types';

const InterestAuditManager: React.FC = () => {
  const { currentUser, effectiveTenantId } = useAuth();
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedLogId, setSelectedLogId] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadLogs = () => {
    setLoading(true);
    const database = getDatabase();
    const auditRef = query(ref(database, 'auditLogs'), orderByChild('timestamp'));

    return onValue(auditRef, (snapshot) => {
      if (!snapshot.exists()) {
        setAllLogs([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();
      const logs: AuditLog[] = Object.keys(data).map((id) => ({ id, ...data[id] }));

      const scopedLogs = logs.filter((log) => {
        const tenantFromRoot = (log as any).tenantId;
        const tenantFromMeta = (log.metadata as any)?.tenantId;
        const tenantMatch = tenantFromRoot === effectiveTenantId || tenantFromMeta === effectiveTenantId;
        const domainMatch = (log.metadata as any)?.domain === 'banking-interest-mvp';
        return tenantMatch && domainMatch;
      });

      scopedLogs.sort((a, b) => {
        const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(String(a.timestamp)).getTime();
        const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(String(b.timestamp)).getTime();
        return bTime - aTime;
      });

      setAllLogs(scopedLogs);
      setLoading(false);
    });
  };

  useEffect(() => {
    const unsub = loadLogs();
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [effectiveTenantId]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (entityFilter !== 'all' && log.entityType !== entityFilter) return false;

      if (!term) return true;
      const entityName = (log.entityName || '').toLowerCase();
      const userName = (log.userName || '').toLowerCase();
      const userEmail = (log.userEmail || '').toLowerCase();
      const action = (log.action || '').toLowerCase();
      const meta = JSON.stringify(log.metadata || {}).toLowerCase();
      return entityName.includes(term) || userName.includes(term) || userEmail.includes(term) || action.includes(term) || meta.includes(term);
    });
  }, [allLogs, searchTerm, actionFilter, entityFilter]);

  const selectedLog = useMemo(() => {
    return filteredLogs.find((log) => log.id === selectedLogId) || null;
  }, [filteredLogs, selectedLogId]);

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(String(timestamp));
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      alert('No audit logs to export.');
      return;
    }

    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'User', 'Email', 'Metadata'];
    const lines = [headers.join(',')];

    filteredLogs.forEach((log) => {
      const row = [
        `"${formatTimestamp(log.timestamp)}"`,
        log.action,
        log.entityType,
        `"${log.entityName || ''}"`,
        `"${log.userName || ''}"`,
        `"${log.userEmail || ''}"`,
        `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
      ];
      lines.push(row.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interest-audit-${new Date().toISOString().split('T')[0]}.csv`;
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
        const unsub = loadLogs();
        if (typeof unsub === 'function') {
          setTimeout(() => unsub(), 2000);
        }
        return;
      }
      if (key === 't') {
        event.preventDefault();
        if (filteredLogs.length > 0 && !selectedLogId) {
          setSelectedLogId(filteredLogs[0].id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredLogs, selectedLogId]);

  if (!currentUser) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">Access Denied</h1>
        <p className="text-gray-600">Please log in to view the audit trail.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Interest Audit Trail</h1>
        <p className="text-gray-600">
          Tenant-scoped, immutable event history for banking interest setup, approvals, and release operations.
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
              placeholder="Entity, user, email, metadata"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="delete">Delete</option>
              <option value="initialize">Initialize</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="all">All</option>
              <option value="reference">Reference</option>
              <option value="pricing">Pricing</option>
              <option value="service">Service</option>
              <option value="audit">Audit</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => loadLogs()} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Refresh (Alt+R)</button>
          <button onClick={exportCsv} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800">Export CSV (Alt+X)</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Audit Events ({filteredLogs.length})</h2>

          {loading ? (
            <p className="text-gray-600">Loading audit events...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-gray-600">No audit events found for current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Timeline</th>
                    <th className="px-3 py-2 text-left">Timestamp</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Entity</th>
                    <th className="px-3 py-2 text-left">User</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className={`border-t border-gray-200 ${selectedLogId === log.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => setSelectedLogId(log.id)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">View (Alt+T)</button>
                      </td>
                      <td className="px-3 py-2">{formatTimestamp(log.timestamp)}</td>
                      <td className="px-3 py-2">{log.action}</td>
                      <td className="px-3 py-2">{log.entityName || log.entityType}</td>
                      <td className="px-3 py-2">{log.userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Event Details</h2>
          {!selectedLog ? (
            <p className="text-gray-600">Select an event from the timeline to view details.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Timestamp:</span> {formatTimestamp(selectedLog.timestamp)}</div>
              <div><span className="font-semibold">Action:</span> {selectedLog.action}</div>
              <div><span className="font-semibold">Entity:</span> {selectedLog.entityName || '-'}</div>
              <div><span className="font-semibold">Type:</span> {selectedLog.entityType}</div>
              <div><span className="font-semibold">User:</span> {selectedLog.userName} ({selectedLog.userEmail})</div>
              <div>
                <span className="font-semibold">Changes:</span>
                <pre className="mt-1 bg-gray-100 rounded p-2 overflow-auto text-xs">{JSON.stringify(selectedLog.changes || [], null, 2)}</pre>
              </div>
              <div>
                <span className="font-semibold">Metadata:</span>
                <pre className="mt-1 bg-gray-100 rounded p-2 overflow-auto text-xs">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterestAuditManager;
