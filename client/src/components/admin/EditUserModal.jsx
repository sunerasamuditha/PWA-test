import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { validateFullName, validateEmail, validatePhoneNumber } from '../../utils/validation';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';

const EditUserModal = ({ isOpen, onClose, onUserUpdated, user }) => {
  // Hooks
  const { user: currentUser } = useAuth();
  const isCurrentUser = currentUser && user && currentUser.id === user.id;
  
  // State management
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'patient',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    isActive: true
  });
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when user prop changes
  useEffect(() => {
    if (user && isOpen) {
      const dobStr = user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '';
      const userData = {
        fullName: user.fullName || '',
        email: user.email || '',
        role: user.role || 'patient',
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: dobStr,
        address: user.address || '',
        emergencyContact: user.emergencyContact || '',
        isActive: user.isActive !== undefined ? user.isActive : true
      };
      
      setFormData(userData);
      setOriginalData(userData);
      setHasChanges(false);
    }
  }, [user, isOpen]);

  // Check for changes
  useEffect(() => {
    const changed = Object.keys(formData).some(key => 
      formData[key] !== originalData[key]
    );
    setHasChanges(changed);
  }, [formData, originalData]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    const nameValidation = validateFullName(formData.fullName);
    if (!nameValidation.isValid) {
      newErrors.fullName = nameValidation.errors[0];
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone number validation (optional)
    if (formData.phoneNumber) {
      const phoneValidation = validatePhoneNumber(formData.phoneNumber);
      if (!phoneValidation.isValid) {
        newErrors.phoneNumber = phoneValidation.errors[0];
      }
    }

    // Date of birth validation (optional)
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        newErrors.dateOfBirth = 'Age must be between 13 and 120 years';
      }
    }

    // Address validation (optional)
    if (formData.address && formData.address.length > 500) {
      newErrors.address = 'Address must be less than 500 characters';
    }

    // Emergency contact validation (optional)
    if (formData.emergencyContact && formData.emergencyContact.length > 255) {
      newErrors.emergencyContact = 'Emergency contact must be less than 255 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasChanges) {
      setMessage({
        type: 'info',
        text: 'No changes were made to update.'
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      // Only send changed fields
      const changedFields = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== originalData[key]) {
          // Keep camelCase for API (server handles transformation)
          changedFields[key] = formData[key] === '' ? null : formData[key];
        }
      });

      const response = await apiService.users.updateUser(user.id, changedFields);

      if (response.success) {
        setMessage({
          type: 'success',
          text: 'User updated successfully!'
        });
        
        // Update original data to reflect changes
        setOriginalData({ ...formData });
        setHasChanges(false);
        
        // Call success callback after a delay to show success message
        setTimeout(() => {
          onUserUpdated(response.data.user);
        }, 1000);
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Failed to update user'
        });
      }
    } catch (error) {
      console.error('Update user error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (newStatus) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const action = newStatus ? 'reactivate' : 'deactivate';
      const response = await apiService.users[action](user.id);

      if (response.success) {
        setMessage({
          type: 'success',
          text: `User ${action}d successfully!`
        });
        
        // Update form data
        setFormData(prev => ({
          ...prev,
          isActive: newStatus
        }));
        
        // Call success callback after a delay
        setTimeout(() => {
          onUserUpdated({
            ...user,
            isActive: newStatus
          });
        }, 1000);
      } else {
        setMessage({
          type: 'error',
          text: response.message || `Failed to ${action} user`
        });
      }
    } catch (error) {
      console.error(`${action} user error:`, error);
      setMessage({
        type: 'error',
        text: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form when closing
      if (user) {
        const dobStr = user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '';
        const userData = {
          fullName: user.fullName || '',
          email: user.email || '',
          role: user.role || 'patient',
          phoneNumber: user.phoneNumber || '',
          dateOfBirth: dobStr,
          address: user.address || '',
          emergencyContact: user.emergencyContact || '',
          isActive: user.isActive !== undefined ? user.isActive : true
        };
        setFormData(userData);
        setOriginalData(userData);
      }
      setErrors({});
      setMessage(null);
      setHasChanges(false);
      onClose();
    }
  };

  // Handle discard changes
  const handleDiscardChanges = () => {
    setFormData({ ...originalData });
    setErrors({});
    setMessage(null);
    setHasChanges(false);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Edit User</h2>
            {isCurrentUser && (
              <p className="self-edit-warning" style={{ color: '#ff9800', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                ⚠️ You cannot change your own role or deactivate your account
              </p>
            )}
          </div>
          <button 
            onClick={handleClose}
            className="modal-close"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* User Info Header */}
          <div className="user-info-header">
            <div className="user-basic-info">
              <h3>{user.fullName}</h3>
              <p className="user-email">{user.email}</p>
              <div className="user-meta">
                <span className={`status-badge ${formData.isActive ? 'active' : 'inactive'}`}>
                  {formData.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`role-badge role-${formData.role}`}>
                  {formData.role.charAt(0).toUpperCase() + formData.role.slice(1).replace('_', ' ')}
                </span>
                <span className="user-id">ID: {user.id}</span>
              </div>
            </div>
            
            {/* Status Toggle */}
            <div className="status-actions">
              {formData.isActive ? (
                <button
                  type="button"
                  onClick={() => handleStatusToggle(false)}
                  className="btn btn-warning"
                  disabled={isSubmitting || isCurrentUser}
                  title={isCurrentUser ? 'You cannot deactivate your own account' : 'Deactivate User'}
                >
                  Deactivate User
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStatusToggle(true)}
                  className="btn btn-success"
                  disabled={isSubmitting || isCurrentUser}
                  title={isCurrentUser ? 'You cannot change your own account status' : 'Reactivate User'}
                >
                  Reactivate User
                </button>
              )}
            </div>
          </div>

          {/* Message */}
          {message && (
            <ErrorMessage 
              message={message.text}
              type={message.type}
              onClose={() => setMessage(null)}
            />
          )}

          {/* Change Indicator */}
          {hasChanges && (
            <div className="changes-indicator">
              <span className="changes-text">You have unsaved changes</span>
              <button 
                type="button"
                onClick={handleDiscardChanges}
                className="btn btn-link"
                disabled={isSubmitting}
              >
                Discard Changes
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="edit-user-form">
            <div className="form-row">
              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={errors.fullName ? 'error' : ''}
                  placeholder="Enter full name"
                  required
                />
                {errors.fullName && (
                  <span className="error-text">{errors.fullName}</span>
                )}
              </div>

              {/* Email */}
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="Enter email address"
                  required
                />
                {errors.email && (
                  <span className="error-text">{errors.email}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              {/* Role */}
              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={errors.role ? 'error' : ''}
                  disabled={isCurrentUser}
                  title={isCurrentUser ? 'You cannot change your own role' : ''}
                  required
                >
                  <option value="patient">Patient</option>
                  <option value="partner">Partner</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                {isCurrentUser && (
                  <span className="field-notice" style={{ fontSize: '0.85rem', color: '#ff9800' }}>Role cannot be changed for your account</span>
                )}
                {errors.role && (
                  <span className="error-text">{errors.role}</span>
                )}
              </div>

              {/* Phone Number */}
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={errors.phoneNumber ? 'error' : ''}
                  placeholder="Enter phone number"
                />
                {errors.phoneNumber && (
                  <span className="error-text">{errors.phoneNumber}</span>
                )}
              </div>
            </div>

            {/* Date of Birth */}
            <div className="form-group">
              <label htmlFor="dateOfBirth">Date of Birth</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={errors.dateOfBirth ? 'error' : ''}
              />
              {errors.dateOfBirth && (
                <span className="error-text">{errors.dateOfBirth}</span>
              )}
            </div>

            {/* Address */}
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={errors.address ? 'error' : ''}
                placeholder="Enter address"
                rows="2"
              />
              {errors.address && (
                <span className="error-text">{errors.address}</span>
              )}
            </div>

            {/* Emergency Contact */}
            <div className="form-group">
              <label htmlFor="emergencyContact">Emergency Contact</label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                className={errors.emergencyContact ? 'error' : ''}
                placeholder="Enter emergency contact"
              />
              {errors.emergencyContact && (
                <span className="error-text">{errors.emergencyContact}</span>
              )}
            </div>

            {/* Audit Information */}
            <div className="audit-info">
              <h4>Account Information</h4>
              <div className="audit-details">
                <div className="audit-item">
                  <label>Created:</label>
                  <span>{new Date(user.createdAt).toLocaleString()}</span>
                </div>
                <div className="audit-item">
                  <label>Last Updated:</label>
                  <span>{new Date(user.updatedAt).toLocaleString()}</span>
                </div>
                {user.lastLogin && (
                  <div className="audit-item">
                    <label>Last Login:</label>
                    <span>{new Date(user.lastLogin).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button 
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isSubmitting || !hasChanges}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                Updating User...
              </>
            ) : (
              'Update User'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;