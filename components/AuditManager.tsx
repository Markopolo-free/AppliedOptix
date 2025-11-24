import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue, query, orderByChild } from 'firebase/database';
import { AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';

const AuditManager: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<keyof AuditLog>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch audit logs from Firebase
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const database = getDatabase();
    const auditLogsRef = query(ref(database, 'auditLogs'), orderByChild('timestamp'));

    const unsubscribe = onValue(auditLogsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logsArray: AuditLog[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));
        
        // Sort by timestamp descending (newest first) by default
        logsArray.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setAuditLogs(logsArray);
        setFilteredLogs(logsArray);
      } else {
        setAuditLogs([]);
        setFilteredLogs([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Apply filters
  useEffect(() => {
    let filtered = [...auditLogs];

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // Include the entire day
      filtered = filtered.filter(log => new Date(log.timestamp) <= endDate);
    }

    // User filter
    if (selectedUser) {
      filtered = filtered.filter(log => log.userId === selectedUser);
    }

    // Entity type filter
    if (selectedEntity) {
      filtered = filtered.filter(log => log.entityType === selectedEntity);
    }

    // Action filter
    if (selectedAction) {
      filtered = filtered.filter(log => log.action === selectedAction);
    }

    // Search term filter (searches in entity name and user name)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.entityName?.toLowerCase().includes(term) ||
        log.userName.toLowerCase().includes(term) ||
        log.userEmail.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredLogs(filtered);
  }, [auditLogs, dateFrom, dateTo, selectedUser, selectedEntity, selectedAction, searchTerm, sortField, sortDirection]);

  const handleSort = (field: keyof AuditLog) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Timestamp', 'User', 'Email', 'Action', 'Entity Type', 'Entity Name', 'Changes'];
    const csvRows = [headers.join(',')];

    filteredLogs.forEach(log => {
      const changesStr = log.changes?.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ') || '';
      const row = [
        new Date(log.timestamp).toLocaleString(),
        `"${log.userName}"`,
        log.userEmail,
        log.action,
        log.entityType,
        `"${log.entityName || ''}"`,
        `"${changesStr}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedUser('');
    setSelectedEntity('');
    setSelectedAction('');
    setSearchTerm('');
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'approve': return 'bg-purple-100 text-purple-800';
      case 'reject': return 'bg-orange-100 text-orange-800';
      case 'initialize': return 'bg-indigo-100 text-indigo-800';
      case 'login': return 'bg-green-600 text-white';
      case 'logout': return 'bg-red-600 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const uniqueUsers = Array.from(new Set(auditLogs.map(log => log.userId)))
    .map(userId => {
      const log = auditLogs.find(l => l.userId === userId);
      return { id: userId, name: log?.userName || 'Unknown', email: log?.userEmail || '' };
    });

  const entityTypes = ['user', 'service', 'zone', 'pricing', 'campaign', 'loyalty', 'bundle', 'reference', 'auth'];
  const actionTypes = ['create', 'update', 'delete', 'approve', 'reject', 'login', 'logout', 'initialize'];

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
        <p className="text-gray-600">Only administrators can view audit logs.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-2 py-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        <button
          onClick={exportToCSV}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          📊 Export to CSV
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Date From */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Date To */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          {/* Entity Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {/* Action Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Actions</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by entity name, user name, or email..."
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          Showing {filteredLogs.length} of {auditLogs.length} entries
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-blue-600 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700 border-b-2 border-blue-700" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center">Timestamp{sortField === 'timestamp' && (<span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}</div>
                </th>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700 border-b-2 border-blue-700" onClick={() => handleSort('userName')}>
                  <div className="flex items-center">User{sortField === 'userName' && (<span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}</div>
                </th>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700 border-b-2 border-blue-700" onClick={() => handleSort('action')}>
                  <div className="flex items-center">Action{sortField === 'action' && (<span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}</div>
                </th>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700 border-b-2 border-blue-700" onClick={() => handleSort('entityType')}>
                  <div className="flex items-center">Entity Type{sortField === 'entityType' && (<span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}</div>
                </th>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700 border-b-2 border-blue-700" onClick={() => handleSort('entityName')}>
                  <div className="flex items-center">Entity Name{sortField === 'entityName' && (<span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}</div>
                </th>
                <th className="px-3 py-2 text-left font-bold text-white uppercase tracking-wider border-b-2 border-blue-700">Changes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">No audit logs found</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>{log.userName}</div>
                      <div className="text-xs text-gray-500">{log.userEmail}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{log.entityType}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{log.entityName || '-'}</td>
                    <td className="px-3 py-2">
                      {log.changes && log.changes.length > 0 ? (
                        <div className="max-w-xs">
                          {log.changes.map((change, idx) => (
                            <div key={idx} className="text-xs mb-1">
                              <span className="font-medium">{change.field}:</span>{' '}
                              <span className="text-red-600">{JSON.stringify(change.oldValue)}</span>{' → '}
                              <span className="text-green-600">{JSON.stringify(change.newValue)}</span>
                            </div>
                          ))}
                        </div>
                      ) : ('-')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditManager;
