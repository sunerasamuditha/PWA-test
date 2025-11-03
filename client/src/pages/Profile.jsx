import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateFullName, validatePhoneNumber, formatDisplayName, formatPhoneNumber } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const Profile = () => {
  // State management
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: ''
  });
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState(null);

  // Hooks
  const { user, isLoading, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Initialize profile data when user is loaded
  useEffect(() => {
    if (user) {
      const userData = {
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
        address: user.address || '',
        emergencyContact: user.emergencyContact || ''
      };
      setProfileData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
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
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    const nameValidation = validateFullName(profileData.fullName);
    if (!nameValidation.isValid) {
      newErrors.fullName = nameValidation.errors[0];
    }

    // Phone number validation (optional)
    if (profileData.phoneNumber) {
      const phoneValidation = validatePhoneNumber(profileData.phoneNumber);
      if (!phoneValidation.isValid) {
        newErrors.phoneNumber = phoneValidation.errors[0];
      }
    }

    // Date of birth validation
    if (profileData.dateOfBirth) {
      const birthDate = new Date(profileData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        newErrors.dateOfBirth = 'Age must be between 13 and 120 years';
      }
    }

    // Address validation
    if (profileData.address && profileData.address.length > 500) {
      newErrors.address = 'Address must be less than 500 characters';
    }

    // Emergency contact validation
    if (profileData.emergencyContact && profileData.emergencyContact.length > 255) {
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

    setIsUpdating(true);
    setMessage(null);

    try {
      // Only send changed fields
      const updatedFields = {};
      Object.keys(profileData).forEach(key => {
        if (key !== 'email' && profileData[key] !== originalData[key]) {
          updatedFields[key] = profileData[key].trim() || null;
        }
      });

      if (Object.keys(updatedFields).length > 0) {
        const result = await updateProfile(updatedFields);
        
        if (result.success) {
          setMessage({
            type: 'success',
            text: 'Profile updated successfully!'
          });
          setIsEditing(false);
          setOriginalData({ ...profileData });
        } else {
          setMessage({
            type: 'error',
            text: result.error || 'Failed to update profile'
          });
        }
      } else {
        setMessage({
          type: 'info',
          text: 'No changes to save'
        });
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setProfileData({ ...originalData });
    setErrors({});
    setMessage(null);
  };

  // Get role display name
  const getRoleDisplayName = (role) => {
    const roleMap = {
      patient: 'Patient',
      partner: 'Partner (Guide/Driver)',
      staff: 'Staff Member',
      admin: 'Administrator',
      super_admin: 'Super Administrator'
    };
    return roleMap[role] || role;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading profile..." />;
  }

  if (!user) {
    return <LoadingSpinner fullScreen message="Redirecting..." />;
  }

  return (
    <div className="profile-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">Profile</span>
      </nav>

      {/* Page Header */}
      <div className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your personal information and account settings</p>
      </div>

      {/* Messages */}
      {message && (
        <ErrorMessage 
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}

      <div className="profile-sections">
        {/* Personal Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Personal Information</h2>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="btn btn-secondary"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="section-content">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleInputChange}
                    className={errors.fullName ? 'error' : ''}
                    required
                  />
                  {errors.fullName && (
                    <span className="error-text">{errors.fullName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profileData.email}
                    className="readonly"
                    disabled
                    title="Email cannot be changed"
                  />
                  <small className="field-note">Email address cannot be changed</small>
                </div>

                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={profileData.phoneNumber}
                    onChange={handleInputChange}
                    className={errors.phoneNumber ? 'error' : ''}
                    placeholder="Enter phone number"
                  />
                  {errors.phoneNumber && (
                    <span className="error-text">{errors.phoneNumber}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="dateOfBirth">Date of Birth</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={profileData.dateOfBirth}
                    onChange={handleInputChange}
                    className={errors.dateOfBirth ? 'error' : ''}
                  />
                  {errors.dateOfBirth && (
                    <span className="error-text">{errors.dateOfBirth}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    className={errors.address ? 'error' : ''}
                    placeholder="Enter your address"
                    rows="3"
                  />
                  {errors.address && (
                    <span className="error-text">{errors.address}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="emergencyContact">Emergency Contact</label>
                  <input
                    type="text"
                    id="emergencyContact"
                    name="emergencyContact"
                    value={profileData.emergencyContact}
                    onChange={handleInputChange}
                    className={errors.emergencyContact ? 'error' : ''}
                    placeholder="Enter emergency contact information"
                  />
                  {errors.emergencyContact && (
                    <span className="error-text">{errors.emergencyContact}</span>
                  )}
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    disabled={isUpdating}
                    className="btn btn-primary"
                  >
                    {isUpdating ? (
                      <>
                        <LoadingSpinner size="small" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleCancelEdit}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-fields">
                <div className="profile-field">
                  <label>Full Name</label>
                  <span className="value">{formatDisplayName(user.fullName)}</span>
                </div>
                
                <div className="profile-field">
                  <label>Email Address</label>
                  <span className="value">{user.email}</span>
                </div>
                
                <div className="profile-field">
                  <label>Phone Number</label>
                  <span className="value">
                    {user.phoneNumber ? formatPhoneNumber(user.phoneNumber) : 'Not provided'}
                  </span>
                </div>
                
                <div className="profile-field">
                  <label>Date of Birth</label>
                  <span className="value">
                    {user.dateOfBirth ? 
                      new Date(user.dateOfBirth).toLocaleDateString() : 
                      'Not provided'
                    }
                  </span>
                </div>
                
                <div className="profile-field">
                  <label>Address</label>
                  <span className="value">{user.address || 'Not provided'}</span>
                </div>
                
                <div className="profile-field">
                  <label>Emergency Contact</label>
                  <span className="value">{user.emergencyContact || 'Not provided'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Account Information</h2>
          </div>
          
          <div className="section-content">
            <div className="profile-fields">
              <div className="profile-field">
                <label>Account Role</label>
                <span className="value">
                  <span className={`role-badge role-${user.role}`}>
                    {getRoleDisplayName(user.role)}
                  </span>
                </span>
              </div>
              
              <div className="profile-field">
                <label>Account Status</label>
                <span className="value">
                  <span className={`status-badge ${user.isActive !== false ? 'active' : 'inactive'}`}>
                    {user.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
              
              <div className="profile-field">
                <label>Member Since</label>
                <span className="value">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              
              <div className="profile-field">
                <label>Last Updated</label>
                <span className="value">
                  {new Date(user.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Security & Privacy</h2>
          </div>
          
          <div className="section-content">
            <div className="security-actions">
              <div className="security-item">
                <div className="security-info">
                  <h3>Password</h3>
                  <p>Change your account password to keep your account secure</p>
                </div>
                <Link to="/change-password" className="btn btn-secondary">
                  Change Password
                </Link>
              </div>
              
              <div className="security-item">
                <div className="security-info">
                  <h3>Privacy Settings</h3>
                  <p>Manage your privacy preferences and data sharing settings</p>
                </div>
                <Link to="/privacy" className="btn btn-secondary">
                  Privacy Settings
                </Link>
              </div>
              
              <div className="security-item">
                <div className="security-info">
                  <h3>Account Data</h3>
                  <p>Download or request deletion of your account data</p>
                </div>
                <Link to="/data-export" className="btn btn-secondary">
                  Manage Data
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;