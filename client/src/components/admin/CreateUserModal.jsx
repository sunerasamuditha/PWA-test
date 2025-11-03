import React, { useState } from 'react';
import { apiService } from '../../services/api';
import { validateFullName, validateEmail, validatePassword, validatePhoneNumber, calculatePasswordStrength } from '../../utils/validation';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
  // State management
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [message, setMessage] = useState(null);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Update password strength on password change
    if (name === 'password') {
      const strength = getPasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  // Get password strength
  const getPasswordStrength = (password) => {
    if (!password) return null;
    
    const score = calculatePasswordStrength(password);
    
    if (score < 2) return { level: 'weak', color: '#ff4444', score };
    if (score < 4) return { level: 'medium', color: '#ffaa00', score };
    return { level: 'strong', color: '#44ff44', score };
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

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm the password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const userData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        phoneNumber: formData.phoneNumber.trim() || null,
        dateOfBirth: formData.dateOfBirth || null,
        address: formData.address.trim() || null,
        emergencyContact: formData.emergencyContact.trim() || null
      };

      const response = await apiService.users.createUser(userData);

      if (response.success) {
        setMessage({
          type: 'success',
          text: 'User created successfully!'
        });
        
        // Reset form
        setFormData({
          fullName: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'patient',
          phoneNumber: '',
          dateOfBirth: '',
          address: '',
          emergencyContact: ''
        });
        setPasswordStrength(null);
        setErrors({});
        
        // Call success callback after a delay to show success message
        setTimeout(() => {
          onUserCreated(response.data.user);
        }, 1000);
      } else {
        setMessage({
          type: 'error',
          text: response.message || 'Failed to create user'
        });
      }
    } catch (error) {
      console.error('Create user error:', error);
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
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'patient',
        phoneNumber: '',
        dateOfBirth: '',
        address: '',
        emergencyContact: ''
      });
      setErrors({});
      setMessage(null);
      setPasswordStrength(null);
      onClose();
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else if (field === 'confirmPassword') {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New User</h2>
          <button 
            onClick={handleClose}
            className="modal-close"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Message */}
          {message && (
            <ErrorMessage 
              message={message.text}
              type={message.type}
              onClose={() => setMessage(null)}
            />
          )}

          <form onSubmit={handleSubmit} className="create-user-form">
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

            {/* Role */}
            <div className="form-group">
              <label htmlFor="role">Role *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={errors.role ? 'error' : ''}
                required
              >
                <option value="patient">Patient</option>
                <option value="partner">Partner</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              {errors.role && (
                <span className="error-text">{errors.role}</span>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? 'error' : ''}
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('password')}
                >
                  {showPassword ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {passwordStrength && (
                <div className="password-strength">
                  <div className="strength-bar-container">
                    <div 
                      className="strength-bar"
                      style={{ 
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: passwordStrength.color 
                      }}
                    ></div>
                  </div>
                  <span className="strength-text" style={{ color: passwordStrength.color }}>
                    Password strength: {passwordStrength.level}
                  </span>
                </div>
              )}
              
              {errors.password && (
                <span className="error-text">{errors.password}</span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? 'error' : ''}
                  placeholder="Confirm password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('confirmPassword')}
                >
                  {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-text">{errors.confirmPassword}</span>
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
                placeholder="Enter phone number (optional)"
              />
              {errors.phoneNumber && (
                <span className="error-text">{errors.phoneNumber}</span>
              )}
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
                placeholder="Enter address (optional)"
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
                placeholder="Enter emergency contact (optional)"
              />
              {errors.emergencyContact && (
                <span className="error-text">{errors.emergencyContact}</span>
              )}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                Creating User...
              </>
            ) : (
              'Create User'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;