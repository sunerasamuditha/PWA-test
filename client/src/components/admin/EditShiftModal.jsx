import React, { useState } from 'react';
import { apiService } from '../../services/api';
import ErrorMessage from '../ErrorMessage';
import {
  validateShiftTimes,
  calculateShiftDuration,
  formatShiftDuration
} from '../../utils/validation';

const EditShiftModal = ({ shift, onClose, onShiftUpdated }) => {
  const [formData, setFormData] = useState({
    login_at: shift.loginAt ? new Date(shift.loginAt).toISOString().slice(0, 16) : '',
    logout_at: shift.logoutAt ? new Date(shift.logoutAt).toISOString().slice(0, 16) : '',
    notes: shift.notes || ''
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewHours, setPreviewHours] = useState(shift.totalHours || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);

    // Update preview hours when both times are set
    if (updatedData.login_at && updatedData.logout_at) {
      try {
        const loginAt = new Date(updatedData.login_at);
        const logoutAt = new Date(updatedData.logout_at);
        const hours = calculateShiftDuration(loginAt.toISOString(), logoutAt.toISOString());
        setPreviewHours(hours);
      } catch (err) {
        setPreviewHours(0);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate times
    if (formData.login_at && formData.logout_at) {
      const loginAt = new Date(formData.login_at);
      const logoutAt = new Date(formData.logout_at);

      const validation = validateShiftTimes(loginAt.toISOString(), logoutAt.toISOString());
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const updateData = {};
      if (formData.login_at) {
        updateData.login_at = new Date(formData.login_at).toISOString();
      }
      if (formData.logout_at) {
        updateData.logout_at = new Date(formData.logout_at).toISOString();
      }
      if (formData.notes !== shift.notes) {
        updateData.notes = formData.notes;
      }

      const response = await apiService.shifts.updateShift(shift.id, updateData);

      if (response.success) {
        onShiftUpdated();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Shift</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="shift-info-summary">
              <p><strong>Staff:</strong> {shift.staffName || 'N/A'}</p>
              <p><strong>Original Shift Type:</strong> {shift.shiftType}</p>
              <p><strong>Original Total Hours:</strong> {shift.totalHours ? `${shift.totalHours.toFixed(2)} hrs` : 'N/A'}</p>
            </div>

            <div className="form-group">
              <label htmlFor="login_at">
                Login Time <span className="required">*</span>
              </label>
              <input
                type="datetime-local"
                id="login_at"
                name="login_at"
                value={formData.login_at}
                onChange={handleChange}
                required
              />
              <small className="help-text">
                Original: {shift.loginAt ? new Date(shift.loginAt).toLocaleString() : 'N/A'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="logout_at">
                Logout Time
              </label>
              <input
                type="datetime-local"
                id="logout_at"
                name="logout_at"
                value={formData.logout_at}
                onChange={handleChange}
              />
              <small className="help-text">
                Original: {shift.logoutAt ? new Date(shift.logoutAt).toLocaleString() : 'Still active'}
              </small>
            </div>

            {/* Hours Preview */}
            {formData.login_at && formData.logout_at && (
              <div className="hours-preview">
                <strong>Calculated Duration:</strong> {formatShiftDuration(previewHours)}
                {previewHours !== shift.totalHours && (
                  <span className="change-indicator">
                    {previewHours > shift.totalHours ? ' ↑' : ' ↓'}
                    {Math.abs(previewHours - (shift.totalHours || 0)).toFixed(2)} hrs
                  </span>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                placeholder="Add any notes about this shift correction..."
              />
            </div>

            <div className="warning-message">
              <strong>⚠️ Warning:</strong> Editing shift times will automatically recalculate the total hours.
              The shift type will be re-detected based on the new login time.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditShiftModal;
