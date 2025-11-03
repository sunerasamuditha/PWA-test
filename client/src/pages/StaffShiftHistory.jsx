import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  formatShiftTime,
  formatShiftDateTime,
  getShiftTypeDisplayName,
  getShiftTypeBadgeColor,
  isShiftActive,
  getLiveDuration,
  formatShiftDuration
} from '../utils/validation';

const StaffShiftHistory = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftStats, setShiftStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    shift_type: '',
    startDate: '',
    endDate: '',
    month: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [liveDuration, setLiveDuration] = useState(0);

  useEffect(() => {
    fetchShifts();
    fetchActiveShift();
    fetchShiftStats();
  }, [filters, pagination.page]);

  // Update live duration every minute
  useEffect(() => {
    if (activeShift) {
      const interval = setInterval(() => {
        setLiveDuration(getLiveDuration(activeShift.loginAt));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [activeShift]);

  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.shift_type && { shift_type: filters.shift_type }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      };

      const response = await apiService.shifts.getMyShifts(params);
      if (response.success) {
        setShifts(response.data.shifts);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch shifts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveShift = async () => {
    try {
      const response = await apiService.shifts.getMyActiveShift();
      if (response.success && response.data.shift) {
        setActiveShift(response.data.shift);
        setLiveDuration(getLiveDuration(response.data.shift.loginAt));
      }
    } catch (err) {
      console.error('Failed to fetch active shift:', err);
    }
  };

  const fetchShiftStats = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const response = await apiService.shifts.getMyShiftStats({
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      });
      if (response.success) {
        setShiftStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch shift stats:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleMonthSelect = (e) => {
    const month = e.target.value;
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      setFilters({
        ...filters,
        month,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    } else {
      setFilters({ ...filters, month: '', startDate: '', endDate: '' });
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDownloadReport = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const blob = await apiService.shifts.downloadMonthlyReportPDF({
        year,
        month
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shift-report-${year}-${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download report: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (isLoading && shifts.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="shift-history-container">
      <div className="page-header">
        <h1>My Shift History</h1>
        <nav className="breadcrumb">
          <a href="/dashboard">Dashboard</a> &gt; <span>My Shifts</span>
        </nav>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

      {/* Active Shift Banner */}
      {activeShift && (
        <div className="active-shift-banner">
          <div className="shift-status-indicator">
            <div className="pulse-dot"></div>
            <span className="status-text">Currently On Shift</span>
          </div>
          <div className="active-shift-details">
            <div className="shift-info">
              <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(activeShift.shiftType) }}>
                {getShiftTypeDisplayName(activeShift.shiftType)}
              </span>
              <span className="login-time">Started: {formatShiftTime(activeShift.loginAt)}</span>
            </div>
            <div className="live-duration">
              <span className="duration-label">Duration:</span>
              <span className="duration-value">{formatShiftDuration(liveDuration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      {shiftStats && (
        <div className="shift-stats-summary">
          <h2>This Month's Summary</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{shiftStats.totalShifts}</div>
              <div className="stat-label">Total Shifts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{shiftStats.totalHours.toFixed(2)}</div>
              <div className="stat-label">Total Hours</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{shiftStats.avgHoursPerShift.toFixed(2)}</div>
              <div className="stat-label">Avg Hours/Shift</div>
            </div>
          </div>

          {/* Hours by Shift Type */}
          {Object.keys(shiftStats.hoursByShiftType).length > 0 && (
            <div className="shift-type-breakdown">
              <h3>Hours by Shift Type</h3>
              {Object.entries(shiftStats.hoursByShiftType).map(([type, data]) => (
                <div key={type} className="shift-type-bar">
                  <div className="bar-label">
                    <span className="type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(type) }}>
                      {getShiftTypeDisplayName(type)}
                    </span>
                    <span className="hours">{data.hours.toFixed(2)} hrs</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(data.hours / shiftStats.totalHours) * 100}%`,
                        backgroundColor: getShiftTypeBadgeColor(type)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="shift-filters">
        <div className="filter-group">
          <label>Shift Type:</label>
          <select name="shift_type" value={filters.shift_type} onChange={handleFilterChange}>
            <option value="">All Types</option>
            <option value="full_night">Full Night</option>
            <option value="day">Day</option>
            <option value="intermediate">Intermediate</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Month:</label>
          <input
            type="month"
            name="month"
            value={filters.month}
            onChange={handleMonthSelect}
          />
        </div>

        <div className="filter-group">
          <label>Start Date:</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <label>End Date:</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>

        <button className="btn-primary" onClick={handleDownloadReport}>
          Download Monthly Report
        </button>
      </div>

      {/* Shifts Table */}
      <div className="shifts-table-container">
        {shifts.length === 0 ? (
          <div className="empty-state">
            <p>No shift records found.</p>
            <p>Your shifts will appear here once you log in and start working.</p>
          </div>
        ) : (
          <table className="shifts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift Type</th>
                <th>Login Time</th>
                <th>Logout Time</th>
                <th>Total Hours</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className={isShiftActive(shift) ? 'active-row' : ''}>
                  <td>{new Date(shift.loginAt).toLocaleDateString()}</td>
                  <td>
                    <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(shift.shiftType) }}>
                      {getShiftTypeDisplayName(shift.shiftType)}
                    </span>
                  </td>
                  <td>{formatShiftTime(shift.loginAt)}</td>
                  <td>
                    {shift.logoutAt ? (
                      formatShiftTime(shift.logoutAt)
                    ) : (
                      <span className="in-progress">In Progress</span>
                    )}
                  </td>
                  <td>
                    {shift.totalHours ? (
                      `${shift.totalHours.toFixed(2)} hrs`
                    ) : (
                      <span className="in-progress">-</span>
                    )}
                  </td>
                  <td className="notes-cell">
                    {shift.notes ? (
                      <span title={shift.notes}>{shift.notes.substring(0, 50)}{shift.notes.length > 50 ? '...' : ''}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="btn-secondary"
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffShiftHistory;
