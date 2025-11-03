import React, { useState, useEffect } from 'react';
import {
  formatShiftDateTime,
  getShiftTypeDisplayName,
  getShiftTypeBadgeColor,
  isShiftActive,
  getLiveDuration,
  formatShiftDuration
} from '../utils/validation';

const ShiftDetailsModal = ({ shift, onClose }) => {
  const [liveDuration, setLiveDuration] = useState(0);

  useEffect(() => {
    if (isShiftActive(shift)) {
      // Initial calculation
      setLiveDuration(getLiveDuration(shift.loginAt));

      // Update every second for live timer
      const interval = setInterval(() => {
        setLiveDuration(getLiveDuration(shift.loginAt));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [shift]);

  const isActive = isShiftActive(shift);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shift-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Shift Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Active Status Banner */}
          {isActive && (
            <div className="active-shift-indicator">
              <div className="pulse-dot"></div>
              <span>This shift is currently in progress</span>
            </div>
          )}

          {/* Shift Information */}
          <div className="detail-section">
            <h3>Shift Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Shift ID:</label>
                <span>{shift.id}</span>
              </div>

              <div className="detail-item">
                <label>Staff Member:</label>
                <span>{shift.staffName || 'N/A'}</span>
              </div>

              <div className="detail-item">
                <label>Shift Type:</label>
                <span>
                  <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(shift.shiftType) }}>
                    {getShiftTypeDisplayName(shift.shiftType)}
                  </span>
                </span>
              </div>

              <div className="detail-item">
                <label>Status:</label>
                <span className={isActive ? 'status-active' : 'status-completed'}>
                  {isActive ? 'In Progress' : 'Completed'}
                </span>
              </div>
            </div>
          </div>

          {/* Time Information */}
          <div className="detail-section">
            <h3>Time Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Login Time:</label>
                <span>{formatShiftDateTime(shift.loginAt)}</span>
              </div>

              <div className="detail-item">
                <label>Logout Time:</label>
                <span>
                  {shift.logoutAt ? (
                    formatShiftDateTime(shift.logoutAt)
                  ) : (
                    <span className="in-progress">Still on shift</span>
                  )}
                </span>
              </div>

              <div className="detail-item">
                <label>Duration:</label>
                <span>
                  {isActive ? (
                    <span className="live-timer">
                      {formatShiftDuration(liveDuration)}
                      <span className="timer-pulse"></span>
                    </span>
                  ) : shift.totalHours ? (
                    formatShiftDuration(shift.totalHours)
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>

              {!isActive && shift.totalHours && (
                <div className="detail-item">
                  <label>Total Hours:</label>
                  <span className="hours-value">{shift.totalHours.toFixed(2)} hrs</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          {shift.notes && (
            <div className="detail-section">
              <h3>Notes</h3>
              <div className="notes-content">
                {shift.notes}
              </div>
            </div>
          )}

          {/* Audit Information */}
          <div className="detail-section">
            <h3>Audit Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Created At:</label>
                <span>{new Date(shift.createdAt).toLocaleString()}</span>
              </div>

              <div className="detail-item">
                <label>Last Updated:</label>
                <span>{new Date(shift.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Live Duration Info for Active Shifts */}
          {isActive && (
            <div className="info-banner">
              <strong>ℹ️ Live Timer:</strong> This duration updates in real-time and will be saved when the staff member logs out.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftDetailsModal;
