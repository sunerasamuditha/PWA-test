import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import DatePicker from 'react-datepicker';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import ConfirmDialog from './ConfirmDialog';
import 'react-datepicker/dist/react-datepicker.css';

const AppointmentDetails = ({ isOpen, onClose, appointment, onUpdate, userRole }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  
  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(appointment?.notes || '');
  
  // Edit mode state
  const [editData, setEditData] = useState({
    appointment_datetime: '',
    appointment_type: 'opd'
  });

  if (!isOpen || !appointment) return null;

  const isOwner = user.id === appointment.patientUserId;
  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
  const canEdit = (isOwner || isStaffOrAdmin) && appointment.status === 'scheduled';
  const canCancel = (isOwner || isStaffOrAdmin) && ['scheduled', 'checked_in'].includes(appointment.status);
  const canCheckIn = isStaffOrAdmin && appointment.status === 'scheduled';
  const canComplete = isStaffOrAdmin && appointment.status === 'checked_in';

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { label: 'Scheduled', className: 'status-badge-scheduled' },
      checked_in: { label: 'Checked In', className: 'status-badge-checked-in' },
      completed: { label: 'Completed', className: 'status-badge-completed' },
      cancelled: { label: 'Cancelled', className: 'status-badge-cancelled' }
    };
    const config = statusConfig[status] || { label: status, className: '' };
    return (
      <span className={`status-badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeConfig = {
      opd: { label: 'OPD - Outpatient Consultation', className: 'type-badge-opd' },
      admission: { label: 'Admission - Inpatient', className: 'type-badge-admission' }
    };
    const config = typeConfig[type] || { label: type, className: '' };
    return (
      <span className={`type-badge ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleCancel = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiService.appointments.cancelAppointment(appointment.id);
      if (response.success) {
        setShowCancelConfirm(false);
        onUpdate();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiService.appointments.checkInAppointment(appointment.id);
      if (response.success) {
        onUpdate();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check in appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiService.appointments.completeAppointment(
        appointment.id,
        completionNotes || null
      );
      if (response.success) {
        setShowCompleteDialog(false);
        onUpdate();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = () => {
    setEditData({
      appointment_datetime: appointment.appointmentDatetime,
      appointment_type: appointment.appointmentType
    });
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setError('');
  };

  const handleNotesSave = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      const response = await apiService.appointments.updateAppointment(appointment.id, { 
        notes: notesValue 
      });
      
      if (response.success) {
        setIsEditingNotes(false);
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Validate business hours and 30-minute increment
      const editDate = new Date(editData.appointment_datetime);
      const hour = editDate.getHours();
      const minutes = editDate.getMinutes();

      if (hour < 8 || hour >= 20) {
        setError('Appointment must be scheduled during business hours (8 AM - 8 PM)');
        return;
      }

      if (minutes !== 0 && minutes !== 30) {
        setError('Appointment must be scheduled in 30-minute increments');
        return;
      }

      const response = await apiService.appointments.updateAppointment(appointment.id, editData);
      if (response.success) {
        setIsEditing(false);
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const handleDateTimeChange = (date, time) => {
    if (date && time) {
      const [hours, minutes] = time.split(':');
      const datetime = new Date(date);
      datetime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      setEditData(prev => ({ ...prev, appointment_datetime: datetime.toISOString() }));
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content appointment-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Appointment Details</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {error && <ErrorMessage message={error} onClose={() => setError('')} />}

            {isEditing ? (
              /* Edit Mode */
              <div className="edit-mode">
                <h3>Edit Appointment</h3>
                
                {/* Date Picker */}
                <div className="form-group">
                  <label>Select Date:</label>
                  <DatePicker
                    selected={editData.appointment_datetime ? new Date(editData.appointment_datetime) : null}
                    onChange={(date) => {
                      const currentTime = editData.appointment_datetime 
                        ? new Date(editData.appointment_datetime).toTimeString().slice(0, 5)
                        : '09:00';
                      handleDateTimeChange(date, currentTime);
                    }}
                    minDate={new Date()}
                    maxDate={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)}
                    inline
                  />
                </div>

                {/* Time Slots */}
                {editData.appointment_datetime && (
                  <div className="form-group">
                    <label>Select Time:</label>
                    <div className="time-slots-grid">
                      {generateTimeSlots().map(time => {
                        const currentDateTime = new Date(editData.appointment_datetime);
                        const currentTime = `${currentDateTime.getHours().toString().padStart(2, '0')}:${currentDateTime.getMinutes().toString().padStart(2, '0')}`;
                        const isSelected = time === currentTime;
                        
                        return (
                          <button
                            key={time}
                            type="button"
                            className={`time-slot-button ${isSelected ? 'selected-slot' : 'available-slot'}`}
                            onClick={() => {
                              const date = new Date(editData.appointment_datetime);
                              handleDateTimeChange(date, time);
                            }}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Appointment Type */}
                <div className="form-group">
                  <label>Appointment Type:</label>
                  <div className="appointment-type-options">
                    <div
                      className={`type-option-card ${editData.appointment_type === 'opd' ? 'selected' : ''}`}
                      onClick={() => setEditData(prev => ({ ...prev, appointment_type: 'opd' }))}
                    >
                      <div className="type-icon">🏥</div>
                      <div className="type-name">OPD</div>
                      <div className="type-description">Outpatient Consultation</div>
                    </div>
                    <div
                      className={`type-option-card ${editData.appointment_type === 'admission' ? 'selected' : ''}`}
                      onClick={() => setEditData(prev => ({ ...prev, appointment_type: 'admission' }))}
                    >
                      <div className="type-icon">🏨</div>
                      <div className="type-name">Admission</div>
                      <div className="type-description">Inpatient Care</div>
                    </div>
                  </div>
                </div>

                {/* Edit Actions */}
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={handleEditCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleEditSave}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                {/* Appointment Information */}
                <div className="details-section">
                  <h3>Appointment Information</h3>
                  <div className="detail-row">
                    <span className="label">Date & Time:</span>
                    <span className="value">{formatDateTime(appointment.appointmentDatetime)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Type:</span>
                    <span className="value">{getTypeBadge(appointment.appointmentType)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className="value">{getStatusBadge(appointment.status)}</span>
                  </div>
                </div>

            {/* Patient Information (Staff/Admin Only) */}
            {isStaffOrAdmin && (
              <div className="details-section">
                <h3>Patient Information</h3>
                <div className="detail-row">
                  <span className="label">Name:</span>
                  <span className="value">{appointment.patientName}</span>
                </div>
                {appointment.patientEmail && (
                  <div className="detail-row">
                    <span className="label">Email:</span>
                    <span className="value">{appointment.patientEmail}</span>
                  </div>
                )}
                {appointment.patientPhone && (
                  <div className="detail-row">
                    <span className="label">Phone:</span>
                    <span className="value">{appointment.patientPhone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Staff Notes (Staff/Admin Only) */}
            {isStaffOrAdmin && !['completed', 'cancelled'].includes(appointment.status) && (
              <div className="details-section">
                <div className="section-header">
                  <h3>Staff Notes</h3>
                  {!isEditingNotes && (
                    <button 
                      className="btn-link"
                      onClick={() => {
                        setNotesValue(appointment.notes || '');
                        setIsEditingNotes(true);
                      }}
                      disabled={isSubmitting}
                    >
                      {appointment.notes ? 'Edit' : 'Add Notes'}
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="notes-edit-container">
                    <textarea
                      className="form-textarea"
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Add internal notes for staff (not visible to patients)..."
                      rows="4"
                      disabled={isSubmitting}
                    />
                    <div className="notes-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={handleNotesSave}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesValue(appointment.notes || '');
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="notes-content">
                    {appointment.notes || <em className="text-muted">No notes added yet</em>}
                  </div>
                )}
              </div>
            )}
            
            {/* Show read-only notes for completed/cancelled appointments */}
            {isStaffOrAdmin && ['completed', 'cancelled'].includes(appointment.status) && appointment.notes && (
              <div className="details-section">
                <h3>Staff Notes</h3>
                <div className="notes-content">
                  {appointment.notes}
                </div>
              </div>
            )}

            {/* Created By */}
            <div className="details-section">
              <h3>Booking Information</h3>
              <div className="detail-row">
                <span className="label">Created By:</span>
                <span className="value">
                  {appointment.creatorName || 'Self-booked'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Created At:</span>
                <span className="value">
                  {new Date(appointment.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Modal Actions for View Mode */}
            {!isEditing && (
              <div className="modal-actions">
                {canEdit && (
                  <button
                    className="btn-primary"
                    onClick={handleEditClick}
                    disabled={isSubmitting}
                  >
                    Edit Appointment
                  </button>
                )}
                
                {canCheckIn && (
                  <button
                    className="btn-success"
                    onClick={handleCheckIn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : 'Check In Patient'}
                  </button>
                )}
                
                {canComplete && (
                  <button
                    className="btn-success"
                    onClick={() => setShowCompleteDialog(true)}
                    disabled={isSubmitting}
                  >
                    Complete Appointment
                  </button>
                )}

                {canCancel && (
                  <button
                    className="btn-danger"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isSubmitting}
                  >
                    Cancel Appointment
                  </button>
                )}

                <button
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Close
                </button>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <ConfirmDialog
          isOpen={showCancelConfirm}
          title="Cancel Appointment"
          message="Are you sure you want to cancel this appointment? This action cannot be undone."
          onConfirm={handleCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {/* Complete Appointment Dialog */}
      {showCompleteDialog && (
        <div className="modal-overlay" onClick={() => setShowCompleteDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complete Appointment</h2>
            </div>
            <div className="modal-body">
              <label>Completion Notes (Optional):</label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Add any notes about the completed appointment..."
                rows="4"
                maxLength="1000"
                className="form-textarea"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-success"
                onClick={handleComplete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Completing...' : 'Complete'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowCompleteDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppointmentDetails;
