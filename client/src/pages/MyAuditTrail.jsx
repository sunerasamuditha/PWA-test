import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

/**
 * MyAuditTrail Component
 * Allows users to view their own activity history
 */
const MyAuditTrail = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    total: 1,
    totalRecords: 0,
    limit: 20
  });

  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  /**
   * Fetch user's audit trail
   */
  const fetchMyTrail = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: pagination.limit
      };

      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;

      const response = await apiService.auditLogs.getMyTrail(params);

      if (response.success) {
        setLogs(response.data || []);
        setPagination(response.pagination);
      }
    } catch (err) {
      console.error('Error fetching audit trail:', err);
      setError(err.response?.data?.message || 'Failed to load your activity history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply date filters
   */
  const applyFilters = () => {
    fetchMyTrail(1);
  };

  /**
   * Reset filters
   */
  const resetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  /**
   * Get action description
   */
  const getActionDescription = (log) => {
    const { action, targetEntity, targetId } = log;
    
    switch (action) {
      case 'login':
        return 'You logged in to the system';
      case 'logout':
        return 'You logged out';
      case 'create':
        return `You created a ${targetEntity} record${targetId ? ` (ID: ${targetId})` : ''}`;
      case 'update':
        return `You updated a ${targetEntity} record${targetId ? ` (ID: ${targetId})` : ''}`;
      case 'delete':
        return `You deleted a ${targetEntity} record${targetId ? ` (ID: ${targetId})` : ''}`;
      case 'access':
        return `You accessed a ${targetEntity} resource${targetId ? ` (ID: ${targetId})` : ''}`;
      default:
        return `You performed a ${action} action on ${targetEntity || 'a resource'}`;
    }
  };

  /**
   * Get action icon
   */
  const getActionIcon = (action) => {
    const icons = {
      login: '🔐',
      logout: '🚪',
      create: '✨',
      update: '✏️',
      delete: '🗑️',
      access: '👁️'
    };
    return icons[action] || '📝';
  };

  /**
   * Get action color
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

  /**
   * Get relative time
   */
  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) return formatTimestamp(timestamp);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  useEffect(() => {
    fetchMyTrail();
  }, []);

  if (loading && logs.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="my-audit-trail">
      <div className="trail-header">
        <div>
          <h1>My Activity History</h1>
          <p>View your account activity and system interactions</p>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="trail-filters">
        <div className="trail-filter-row">
          <input
            type="datetime-local"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="trail-input"
            placeholder="Start Date"
          />
          <input
            type="datetime-local"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="trail-input"
            placeholder="End Date"
          />
          <button className="trail-btn trail-btn-primary" onClick={applyFilters}>
            Apply Filter
          </button>
          <button className="trail-btn trail-btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Activity Timeline */}
      <div className="trail-timeline">
        {logs.length === 0 ? (
          <div className="trail-empty">
            <div className="trail-empty-icon">📋</div>
            <h3>No Activity Found</h3>
            <p>You don't have any recorded activity yet.</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`trail-item trail-item-${getActionColor(log.action)}`}>
              <div className="trail-item-icon">
                <span>{getActionIcon(log.action)}</span>
              </div>
              <div className="trail-item-content">
                <div className="trail-item-header">
                  <h3>{getActionDescription(log)}</h3>
                  <span className="trail-item-time">{getRelativeTime(log.timestamp)}</span>
                </div>
                <div className="trail-item-details">
                  <div className="trail-detail-item">
                    <span className="trail-detail-label">IP Address:</span>
                    <span className="trail-detail-value">{log.ipAddress || 'Unknown'}</span>
                  </div>
                  <div className="trail-detail-item">
                    <span className="trail-detail-label">Date & Time:</span>
                    <span className="trail-detail-value">{formatTimestamp(log.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 1 && (
        <div className="trail-pagination">
          <button
            className="trail-page-btn"
            disabled={pagination.current === 1}
            onClick={() => fetchMyTrail(pagination.current - 1)}
          >
            Previous
          </button>
          <span className="trail-page-info">
            Page {pagination.current} of {pagination.total}
          </span>
          <button
            className="trail-page-btn"
            disabled={pagination.current === pagination.total}
            onClick={() => fetchMyTrail(pagination.current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default MyAuditTrail;
