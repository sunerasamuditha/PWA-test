import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import AuditLogDetailsModal from '../../components/admin/AuditLogDetailsModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

/**
 * AuditLogViewer Component
 * Admin interface for viewing and filtering audit logs
 */
const AuditLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    totalRecords: 0,
    limit: 50
  });

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    targetEntity: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  // Statistics
  const [stats, setStats] = useState(null);

  /**
   * Fetch audit logs with current filters
   */
  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: pagination.limit,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = filters.searchTerm
        ? await apiService.auditLogs.search({ q: filters.searchTerm, ...params })
        : await apiService.auditLogs.getAll(params);

      if (response.success) {
        setLogs(response.data || []);
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch statistics
   */
  const fetchStats = async () => {
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await apiService.auditLogs.getStatistics(params);
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  /**
   * Export logs
   */
  const handleExport = async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await apiService.auditLogs.exportLogs(params);
      if (response.success) {
        // Convert to CSV and download
        const csv = convertToCSV(response.data);
        downloadCSV(csv, `audit-logs-${new Date().toISOString()}.csv`);
      }
    } catch (err) {
      console.error('Error exporting logs:', err);
      setError(err.response?.data?.message || 'Failed to export logs');
    }
  };

  /**
   * Convert logs to CSV format
   */
  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = ['ID', 'Timestamp', 'User', 'Email', 'Role', 'Action', 'Entity', 'Entity ID', 'IP Address'];
    const rows = data.map(log => [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.user?.name || 'N/A',
      log.user?.email || 'N/A',
      log.user?.role || 'N/A',
      log.action,
      log.targetEntity || 'N/A',
      log.targetId || 'N/A',
      log.ipAddress || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  /**
   * Download CSV file
   */
  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Apply filters
   */
  const applyFilters = () => {
    fetchLogs(1);
  };

  /**
   * Reset filters
   */
  const resetFilters = () => {
    setFilters({
      action: '',
      targetEntity: '',
      startDate: '',
      endDate: '',
      searchTerm: ''
    });
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Get action badge color
   */
  const getActionColor = (action) => {
    const colors = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      login: 'purple',
      logout: 'gray',
      access: 'orange'
    };
    return colors[action] || 'gray';
  };

  // Load logs and stats on mount and filter change
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  if (loading && logs.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="audit-log-viewer">
      <div className="audit-header">
        <div>
          <h1>Audit Log Viewer</h1>
          <p>View and analyze system activity logs</p>
        </div>
        <button className="audit-export-btn" onClick={handleExport}>
          <span>📥</span> Export Logs
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="audit-stats-grid">
          {stats.byAction && stats.byAction.map(item => (
            <div key={item.action} className="audit-stat-card">
              <div className="audit-stat-label">{item.action.toUpperCase()}</div>
              <div className="audit-stat-value">{item.count.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="audit-filters">
        <div className="audit-filter-row">
          <input
            type="text"
            placeholder="Search by user name, email, or IP..."
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="audit-search-input"
          />
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="audit-select"
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="access">Access</option>
          </select>
          <input
            type="text"
            placeholder="Entity (e.g., Users, Patients)"
            value={filters.targetEntity}
            onChange={(e) => handleFilterChange('targetEntity', e.target.value)}
            className="audit-input"
          />
        </div>
        <div className="audit-filter-row">
          <input
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="audit-input"
            placeholder="Start Date"
          />
          <input
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="audit-input"
            placeholder="End Date"
          />
          <button className="audit-btn audit-btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
          <button className="audit-btn audit-btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Logs Table */}
      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>IP Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="audit-no-data">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>
                    <div className="audit-user-cell">
                      <div className="audit-user-name">{log.user?.name || 'Unknown'}</div>
                      <div className="audit-user-email">{log.user?.email || 'N/A'}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`audit-action-badge audit-action-${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.targetEntity || 'N/A'}</td>
                  <td>{log.targetId || 'N/A'}</td>
                  <td className="audit-ip-cell">{log.ipAddress || 'Unknown'}</td>
                  <td>
                    <button
                      className="audit-view-btn"
                      onClick={() => setSelectedLog(log)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.total > 1 && (
        <div className="audit-pagination">
          <button
            className="audit-page-btn"
            disabled={pagination.current === 1}
            onClick={() => fetchLogs(pagination.current - 1)}
          >
            Previous
          </button>
          <span className="audit-page-info">
            Page {pagination.current} of {pagination.total} ({pagination.totalRecords} total)
          </span>
          <button
            className="audit-page-btn"
            disabled={pagination.current === pagination.total}
            onClick={() => fetchLogs(pagination.current + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Details Modal */}
      {selectedLog && (
        <AuditLogDetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
};

export default AuditLogViewer;
