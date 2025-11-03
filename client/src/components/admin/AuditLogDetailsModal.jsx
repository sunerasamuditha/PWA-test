import React, { useState } from 'react';
import JSONDiffViewer from '../JSONDiffViewer.jsx';

/**
 * AuditLogDetailsModal Component
 * Displays detailed information about a single audit log entry
 */
const AuditLogDetailsModal = ({ log, onClose }) => {
  const [showRawData, setShowRawData] = useState(false);

  if (!log) return null;

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

  /**
   * Parse user agent string
   */
  const parseUserAgent = (userAgent) => {
    if (!userAgent) return 'Unknown';
    
    // Simple parsing - in production, consider using a library like ua-parser-js
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  const hasChanges = log.detailsBefore || log.detailsAfter;

  return (
    <div className="audit-modal-overlay" onClick={onClose}>
      <div className="audit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="audit-modal-header">
          <h2>Audit Log Details</h2>
          <button className="audit-modal-close" onClick={onClose}>
            <span>×</span>
          </button>
        </div>

        <div className="audit-modal-body">
          {/* Basic Information */}
          <section className="audit-section">
            <h3>Basic Information</h3>
            <div className="audit-info-grid">
              <div className="audit-info-item">
                <label>Log ID:</label>
                <span>{log.id}</span>
              </div>
              <div className="audit-info-item">
                <label>Action:</label>
                <span className={`audit-action-badge audit-action-${getActionColor(log.action)}`}>
                  {log.action.toUpperCase()}
                </span>
              </div>
              <div className="audit-info-item">
                <label>Entity:</label>
                <span>{log.targetEntity || 'N/A'}</span>
              </div>
              <div className="audit-info-item">
                <label>Entity ID:</label>
                <span>{log.targetId || 'N/A'}</span>
              </div>
              <div className="audit-info-item">
                <label>Timestamp:</label>
                <span>{formatTimestamp(log.timestamp)}</span>
              </div>
            </div>
          </section>

          {/* User Information */}
          {log.user && (
            <section className="audit-section">
              <h3>User Information</h3>
              <div className="audit-info-grid">
                <div className="audit-info-item">
                  <label>User:</label>
                  <span>{log.user.name}</span>
                </div>
                <div className="audit-info-item">
                  <label>Email:</label>
                  <span>{log.user.email}</span>
                </div>
                <div className="audit-info-item">
                  <label>Role:</label>
                  <span className="audit-role-badge">{log.user.role}</span>
                </div>
                <div className="audit-info-item">
                  <label>User ID:</label>
                  <span>{log.userId}</span>
                </div>
              </div>
            </section>
          )}

          {/* Request Information */}
          <section className="audit-section">
            <h3>Request Information</h3>
            <div className="audit-info-grid">
              <div className="audit-info-item">
                <label>IP Address:</label>
                <span className="audit-mono">{log.ipAddress || 'Unknown'}</span>
              </div>
              <div className="audit-info-item">
                <label>Browser:</label>
                <span>{parseUserAgent(log.userAgent)}</span>
              </div>
              <div className="audit-info-item audit-info-item-full">
                <label>User Agent:</label>
                <span className="audit-mono audit-text-small">{log.userAgent || 'Unknown'}</span>
              </div>
            </div>
          </section>

          {/* Changes Section */}
          {hasChanges && (
            <section className="audit-section">
              <div className="audit-section-header">
                <h3>Changes</h3>
                <button 
                  className="audit-toggle-btn"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  {showRawData ? 'Show Visual Diff' : 'Show Raw JSON'}
                </button>
              </div>

              {showRawData ? (
                <div className="audit-raw-data">
                  {log.detailsBefore && (
                    <div className="audit-raw-section">
                      <h4>Before</h4>
                      <pre>{JSON.stringify(log.detailsBefore, null, 2)}</pre>
                    </div>
                  )}
                  {log.detailsAfter && (
                    <div className="audit-raw-section">
                      <h4>After</h4>
                      <pre>{JSON.stringify(log.detailsAfter, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="audit-diff-container">
                  {log.detailsBefore || log.detailsAfter ? (
                    <JSONDiffViewer 
                      before={log.detailsBefore} 
                      after={log.detailsAfter} 
                    />
                  ) : (
                    <p className="audit-no-changes">No change details available</p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="audit-modal-footer">
          <button className="audit-btn audit-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogDetailsModal;
