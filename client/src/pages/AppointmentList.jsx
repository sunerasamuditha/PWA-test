import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import AppointmentDetails from '../components/AppointmentDetails';
import ConfirmDialog from '../components/ConfirmDialog';

const AppointmentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    appointment_type: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [stats, setStats] = useState(null);

  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(user?.role);

  useEffect(() => {
    fetchAppointments();
    if (user?.role === 'patient') {
      fetchStats();
    }
  }, [filters, pagination.page]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };

      if (user.role === 'patient') {
        params.patient_user_id = user.id;
      }

      const response = await apiService.appointments.getAppointments(params);

      if (response.success) {
        setAppointments(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
          totalPages: response.pagination?.totalPages || 0
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Calculate stats from appointments
      const upcoming = appointments.filter(apt => 
        apt.status === 'scheduled' && new Date(apt.appointmentDatetime) > new Date()
      ).length;
      const completed = appointments.filter(apt => apt.status === 'completed').length;
      const cancelled = appointments.filter(apt => apt.status === 'cancelled').length;

      setStats({
        total: appointments.length,
        upcoming,
        completed,
        cancelled
      });
    } catch (err) {
      console.error('Error calculating stats:', err);
    }
  };

  useEffect(() => {
    if (appointments.length > 0) {
      fetchStats();
    }
  }, [appointments]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleCancelClick = (appointment) => {
    setAppointmentToCancel(appointment);
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = async () => {
    if (!appointmentToCancel) return;

    try {
      const response = await apiService.appointments.cancelAppointment(appointmentToCancel.id);
      if (response.success) {
        setShowCancelConfirm(false);
        setAppointmentToCancel(null);
        fetchAppointments();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel appointment');
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      const response = await apiService.appointments.checkInAppointment(appointmentId);
      if (response.success) {
        fetchAppointments();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check in appointment');
    }
  };

  const handleComplete = async (appointmentId, notes) => {
    try {
      const response = await apiService.appointments.completeAppointment(appointmentId, notes);
      if (response.success) {
        fetchAppointments();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete appointment');
    }
  };

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      scheduled: 'status-badge-scheduled',
      checked_in: 'status-badge-checked-in',
      completed: 'status-badge-completed',
      cancelled: 'status-badge-cancelled'
    };
    return classes[status] || '';
  };

  const getTypeBadgeClass = (type) => {
    return type === 'opd' ? 'type-badge-opd' : 'type-badge-admission';
  };

  return (
    <div className="appointment-list-container">
      <div className="page-header">
        <h1>{user.role === 'patient' ? 'My Appointments' : 'Appointment Management'}</h1>
        <button
          className="btn-primary"
          onClick={() => navigate('/appointments/book')}
        >
          + Book Appointment
        </button>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError('')} />}

      {/* Statistics Summary */}
      {stats && user.role === 'patient' && (
        <div className="stats-summary">
          <div className="stat-card">
            <h3>{stats.total}</h3>
            <p>Total Appointments</p>
          </div>
          <div className="stat-card">
            <h3>{stats.upcoming}</h3>
            <p>Upcoming</p>
          </div>
          <div className="stat-card">
            <h3>{stats.completed}</h3>
            <p>Completed</p>
          </div>
          <div className="stat-card">
            <h3>{stats.cancelled}</h3>
            <p>Cancelled</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-container">
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="checked_in">Checked In</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          name="appointment_type"
          value={filters.appointment_type}
          onChange={handleFilterChange}
          className="filter-select"
        >
          <option value="">All Types</option>
          <option value="opd">OPD</option>
          <option value="admission">Admission</option>
        </select>

        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleFilterChange}
          className="filter-input"
          placeholder="Start Date"
        />

        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleFilterChange}
          className="filter-input"
          placeholder="End Date"
        />

        {isStaffOrAdmin && (
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            className="filter-input"
            placeholder="Search by patient name..."
          />
        )}
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <LoadingSpinner />
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p>No appointments found</p>
          <button
            className="btn-primary"
            onClick={() => navigate('/appointments/book')}
          >
            Book Your First Appointment
          </button>
        </div>
      ) : (
        <>
          <div className="appointment-table">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  {isStaffOrAdmin && <th>Patient</th>}
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{formatDateTime(appointment.appointmentDatetime)}</td>
                    {isStaffOrAdmin && <td>{appointment.patientName}</td>}
                    <td>
                      <span className={`type-badge ${getTypeBadgeClass(appointment.appointmentType)}`}>
                        {appointment.appointmentType.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(appointment.status)}`}>
                        {appointment.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-sm btn-secondary"
                        onClick={() => handleViewDetails(appointment)}
                      >
                        View
                      </button>
                      {appointment.status === 'scheduled' && (
                        <>
                          <button
                            className="btn-sm btn-danger"
                            onClick={() => handleCancelClick(appointment)}
                          >
                            Cancel
                          </button>
                          {isStaffOrAdmin && (
                            <button
                              className="btn-sm btn-success"
                              onClick={() => handleCheckIn(appointment.id)}
                            >
                              Check In
                            </button>
                          )}
                        </>
                      )}
                      {appointment.status === 'checked_in' && isStaffOrAdmin && (
                        <button
                          className="btn-sm btn-success"
                          onClick={() => handleComplete(appointment.id, null)}
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-secondary"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetails
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onUpdate={fetchAppointments}
          userRole={user.role}
        />
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          isOpen={showCancelConfirm}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment? This action cannot be undone."
          onConfirm={handleCancelConfirm}
          onCancel={() => {
            setShowCancelConfirm(false);
            setAppointmentToCancel(null);
          }}
        />
      )}
    </div>
  );
};

export default AppointmentList;
