import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validatePassword, calculatePasswordStrength, isCommonPassword } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const ChangePassword = () => {
  // State management
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [message, setMessage] = useState(null);

  // Hooks
  const { changePassword } = useAuth();
  const navigate = useNavigate();

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

    // Update password strength for new password
    if (name === 'newPassword') {
      const strength = getPasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  // Get password strength with color
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

    // Current password validation
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    // New password validation
    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.isValid) {
      newErrors.newPassword = passwordValidation.errors[0];
    } else {
      // Check if new password is the same as current
      if (formData.newPassword === formData.currentPassword) {
        newErrors.newPassword = 'New password must be different from current password';
      }
      
      // Check if password is common
      if (isCommonPassword(formData.newPassword)) {
        newErrors.newPassword = 'This password is too common. Please choose a more secure password.';
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const result = await changePassword(formData.currentPassword, formData.newPassword);

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Password changed successfully!'
        });
        
        // Clear form
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordStrength(null);
        
        // Navigate back to profile after delay
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to change password'
        });
      }
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    switch (field) {
      case 'current':
        setShowCurrentPassword(!showCurrentPassword);
        break;
      case 'new':
        setShowNewPassword(!showNewPassword);
        break;
      case 'confirm':
        setShowConfirmPassword(!showConfirmPassword);
        break;
    }
  };

  return (
    <div className="change-password-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
        <span className="breadcrumb-separator">›</span>
        <Link to="/profile" className="breadcrumb-link">Profile</Link>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">Change Password</span>
      </nav>

      <div className="change-password-card">
        {/* Header */}
        <div className="card-header">
          <h1>Change Password</h1>
          <p>Update your account password to keep your account secure</p>
        </div>

        {/* Messages */}
        {message && (
          <ErrorMessage 
            message={message.text}
            type={message.type}
            onClose={() => setMessage(null)}
          />
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="change-password-form">
          {/* Current Password */}
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password *</label>
            <div className="password-input-container">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className={errors.currentPassword ? 'error' : ''}
                placeholder="Enter your current password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('current')}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            {errors.currentPassword && (
              <span className="error-text">{errors.currentPassword}</span>
            )}
          </div>

          {/* New Password */}
          <div className="form-group">
            <label htmlFor="newPassword">New Password *</label>
            <div className="password-input-container">
              <input
                type={showNewPassword ? 'text' : 'password'}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className={errors.newPassword ? 'error' : ''}
                placeholder="Enter your new password"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('new')}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? '👁️‍🗨️' : '👁️'}
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
            
            {errors.newPassword && (
              <span className="error-text">{errors.newPassword}</span>
            )}
            
            {/* Password Requirements */}
            <div className="password-requirements">
              <p>Password must contain:</p>
              <ul>
                <li className={formData.newPassword.length >= 8 ? 'valid' : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(formData.newPassword) ? 'valid' : ''}>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(formData.newPassword) ? 'valid' : ''}>
                  One lowercase letter
                </li>
                <li className={/\d/.test(formData.newPassword) ? 'valid' : ''}>
                  One number
                </li>
                <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.newPassword) ? 'valid' : ''}>
                  One special character
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password *</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Confirm your new password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('confirm')}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Security Tips */}
          <div className="security-tips">
            <h3>Password Security Tips</h3>
            <ul>
              <li>Use a unique password that you don't use elsewhere</li>
              <li>Avoid using personal information like names or dates</li>
              <li>Consider using a password manager</li>
              <li>Change your password if you suspect it's been compromised</li>
            </ul>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="small" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
            
            <Link to="/profile" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;