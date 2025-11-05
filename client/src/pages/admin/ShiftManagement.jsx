import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EditShiftModal from '../../components/admin/EditShiftModal';
import ShiftDetailsModal from '../../components/ShiftDetailsModal';
import {
  formatShiftTime,
  getShiftTypeDisplayName,
  getShiftTypeBadgeColor,
  isShiftActive,
  getLiveDuration,
  formatShiftDuration
} from '../../utils/validation';

const ShiftManagement = () => {
  const [shifts, setShifts] = useState([]);
  const [currentlyOnShift, setCurrentlyOnShift] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [filters, setFilters] = useState({
    staff_user_id: '',
    shift_type: '',
    startDate: '',
    endDate: '',
    logout_at: '' // '' = all, 'null' = active only
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchShifts();
    fetchCurrentlyOnShift();
  }, [filters, pagination.page]);

  // Refresh currently on shift every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCurrentlyOnShift();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.staff_user_id && { staff_user_id: filters.staff_user_id }),
        ...(filters.shift_type && { shift_type: filters.shift_type }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.logout_at === 'null' && { logout_at: null })
      };

      const response = await apiService.shifts.getAllShifts(params);
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

  const fetchCurrentlyOnShift = async () => {
    try {
      const response = await apiService.shifts.getCurrentlyOnShift();
      if (response.success) {
        setCurrentlyOnShift(response.data.shifts);
      }
    } catch (err) {
      console.error('Failed to fetch currently on shift:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleEditShift = (shift) => {
    setSelectedShift(shift);
    setShowEditModal(true);
  };

  const handleViewDetails = (shift) => {
    setSelectedShift(shift);
    setShowDetailsModal(true);
  };

  const handleShiftUpdated = () => {
    fetchShifts();
    fetchCurrentlyOnShift();
    setSuccessMessage('Shift updated successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleExportCSV = async () => {
    try {
      // Build query params for server-side CSV export
      const params = new URLSearchParams({
        ...(filters.staff_user_id && { staff_user_id: filters.staff_user_id }),
        ...(filters.shift_type && { shift_type: filters.shift_type }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });

      // Get auth token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch CSV from server
      const response = await fetch(`/api/shifts/export/csv?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'shifts-export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccessMessage('CSV exported successfully');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err) {
      setError('Failed to export shifts: ' + (err.message || 'Unknown error'));
    }
  };

  const filteredShifts = searchTerm
    ? shifts.filter(shift =>
        shift.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.shiftType.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : shifts;

  if (isLoading && shifts.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="shift-management-container">
      <div className="page-header">
        <h1>Shift Management</h1>
        <nav className="breadcrumb">
          <a href="/admin/dashboard">Admin Dashboard</a> &gt; <span>Shift Management</span>
        </nav>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {/* Currently On Shift Section */}
      {currentlyOnShift.length > 0 && (
        <div className="currently-on-shift-section">
          <h2>Currently On Shift ({currentlyOnShift.length})</h2>
          <div className="on-shift-grid">
            {currentlyOnShift.map(shift => (
              <div key={shift.id} className="on-shift-card">
                <div className="card-header">
                  <div className="pulse-dot"></div>
                  <h3>{shift.staffName}</h3>
                </div>
                <div className="card-body">
                  <div className="shift-detail">
                    <span className="shift-type-badge" style={{ backgroundColor: getShiftTypeBadgeColor(shift.shiftType) }}>
                      {getShiftTypeDisplayName(shift.shiftType)}
                    </span>
                  </div>
                  <div className="shift-detail">
                    <strong>Started:</strong> {formatShiftTime(shift.loginAt)}
                  </div>
                  <div className="shift-detail">
                    <strong>Duration:</strong> {formatShiftDuration(getLiveDuration(shift.loginAt))}
                  </div>
                  {shift.notes && (
                    <div className="shift-detail">
                      <strong>Notes:</strong> {shift.notes.substring(0, 50)}
                      {shift.notes.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>
                <div className="card-actions">
                  <button className="btn-small" onClick={() => handleViewDetails(shift)}>
                    View Details
                  </button>
                  <button className="btn-small btn-secondary" onClick={() => handleEditShift(shift)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="shift-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by staff name or shift type..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

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
            <label>Status:</label>
            <select name="logout_at" value={filters.logout_at} onChange={handleFilterChange}>
              <option value="">All Shifts</option>
              <option value="null">Active Only</option>
            </select>
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

          <button className="btn-secondary" onClick={handleExportCSV}>
            Export to CSV
          </button>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="shifts-table-container">
        {filteredShifts.length === 0 ? (
          <div className="empty-state">
            <p>No shift records found.</p>
          </div>
        ) : (
          <table className="shifts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Staff Name</th>
                <th>Shift Type</th>
                <th>Login Time</th>
                <th>Logout Time</th>
                <th>Total Hours</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map((shift) => (
                <tr key={shift.id} className={isShiftActive(shift) ? 'active-row' : ''}>
                  <td>{shift.id}</td>
                  <td>{shift.staffName || 'N/A'}</td>
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
                      <span title={shift.notes}>
                        {shift.notes.substring(0, 30)}
                        {shift.notes.length > 30 ? '...' : ''}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="actions-cell">
                    <button className="btn-icon" onClick={() => handleViewDetails(shift)} title="View Details">
                      👁️
                    </button>
                    <button className="btn-icon" onClick={() => handleEditShift(shift)} title="Edit Shift">
                      ✏️
                    </button>
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

      {/* Modals */}
      {showEditModal && selectedShift && (
        <EditShiftModal
          shift={selectedShift}
          onClose={() => setShowEditModal(false)}
          onShiftUpdated={handleShiftUpdated}
        />
      )}

      {showDetailsModal && selectedShift && (
        <ShiftDetailsModal
          shift={selectedShift}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default ShiftManagement;
