import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { formatCommissionPoints, getPartnerTypeDisplayName, validatePartnerType } from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { validateEmail, validateFullName } from '../utils/validation';

const PartnerProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrCodeData, setQRCodeData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    partnerType: 'guide'
  });
  
  const [errors, setErrors] = useState({});

  // Load partner profile on component mount
  useEffect(() => {
    loadPartnerProfile();
  }, []);

  const loadPartnerProfile = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await apiService.partners.getPartnerInfo();
      
      if (response.success) {
        setProfile(response.data);
        setFormData({
          fullName: response.data.user.fullName || '',
          email: response.data.user.email || '',
          phoneNumber: response.data.user.phoneNumber || '',
          partnerType: response.data.partner.type || 'guide'
        });
      } else {
        setError('Failed to load partner profile');
      }
    } catch (error) {
      console.error('Error loading partner profile:', error);
      setError('Failed to load partner profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Full name validation
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

    // Phone number validation
    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    // Partner type validation
    if (!formData.partnerType) {
      newErrors.partnerType = 'Partner type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsUpdating(true);
      setError('');
      setSuccess('');

      const response = await apiService.partners.updatePartnerInfo({
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber.trim() || null,
        partnerType: formData.partnerType
      });

      if (response.success) {
        setProfile(response.data);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        
        // Update user context if needed
        if (user && (user.fullName !== formData.fullName || user.phoneNumber !== formData.phoneNumber)) {
          updateUser({
            ...user,
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber
          });
        }
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateQR = async () => {
    try {
      setIsGeneratingQR(true);
      setError('');

      const response = await apiService.partners.getQRCode();

      if (response.success) {
        setQRCodeData(response.data);
      } else {
        setError(response.error || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        fullName: profile.user.fullName || '',
        email: profile.user.email || '',
        phoneNumber: profile.user.phoneNumber || '',
        partnerType: profile.partner.type || 'guide'
      });
    }
    setIsEditing(false);
    setErrors({});
    setError('');
    setSuccess('');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { text: 'Active', className: 'status-active' },
      pending: { text: 'Pending Review', className: 'status-pending' },
      inactive: { text: 'Inactive', className: 'status-inactive' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`status-badge ${config.className}`}>
        {config.text}
      </span>
    );
  };

  const formatPartnerType = (type) => {
    const typeMap = {
      'guide': 'Guide',
      'driver': 'Driver', 
      'hotel': 'Hotel',
      'villa': 'Villa',
      'guest_house': 'Guest House',
      'other': 'Other'
    };
    return typeMap[type] || type;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading partner profile..." />;
  }

  if (!profile) {
    return (
      <div className="profile-error">
        <ErrorMessage message="Failed to load partner profile" />
        <button onClick={loadPartnerProfile} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="partner-profile">
      <div className="profile-header">
        <h1>Partner Profile</h1>
        <div className="profile-status">
          {getStatusBadge(profile.partner.status)}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <ErrorMessage 
          message={error} 
          onClose={() => setError('')}
        />
      )}
      
      {success && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          {success}
          <button 
            className="close-button"
            onClick={() => setSuccess('')}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      <div className="profile-content">
        {/* Profile Information Card */}
        <div className="profile-card">
          <div className="card-header">
            <h2>Profile Information</h2>
            {!isEditing && profile.partner.status === 'active' && (
              <button 
                onClick={() => setIsEditing(true)}
                className="edit-button"
              >
                <span className="edit-icon">✏️</span>
                Edit Profile
              </button>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  value={formData.email}
                  disabled={true}
                  className="disabled"
                  title="Email cannot be changed"
                />
                <small className="help-text">Email cannot be changed</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={errors.phoneNumber ? 'error' : ''}
                  placeholder="Enter phone number"
                />
                {errors.phoneNumber && (
                  <span className="error-text">{errors.phoneNumber}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="partnerType">Partner Type *</label>
                <select
                  id="partnerType"
                  name="partnerType"
                  value={formData.partnerType}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={errors.partnerType ? 'error' : ''}
                  required
                >
                  <option value="guide">Guide</option>
                  <option value="driver">Driver</option>
                  <option value="hotel">Hotel</option>
                  <option value="villa">Villa</option>
                  <option value="guest_house">Guest House</option>
                  <option value="other">Other</option>
                </select>
                {errors.partnerType && (
                  <span className="error-text">{errors.partnerType}</span>
                )}
              </div>
            </div>



            {isEditing && (
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="cancel-button"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-button"
                  disabled={isUpdating}
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
              </div>
            )}
          </form>
        </div>

        {/* Partner Statistics Card */}
        <div className="stats-card">
          <div className="card-header">
            <h2>Partner Statistics</h2>
          </div>
          
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{profile.partner.commissionPoints}</div>
              <div className="stat-label">Commission Points</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-value">{profile.stats?.totalReferrals || 0}</div>
              <div className="stat-label">Total Referrals</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-value">{profile.stats?.monthlyReferrals || 0}</div>
              <div className="stat-label">This Month</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-value">
                {new Date(profile.partner.createdAt).toLocaleDateString()}
              </div>
              <div className="stat-label">Member Since</div>
            </div>
          </div>
        </div>

        {/* QR Code Card */}
        {profile.partner.status === 'active' && (
          <div className="qr-card">
            <div className="card-header">
              <h2>Referral QR Code</h2>
              <button
                onClick={handleGenerateQR}
                disabled={isGeneratingQR}
                className="generate-button"
              >
                {isGeneratingQR ? (
                  <>
                    <LoadingSpinner size="small" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="qr-icon">📱</span>
                    Generate QR Code
                  </>
                )}
              </button>
            </div>

            {qrCodeData && (
              <div className="qr-content">
                <div className="qr-image">
                  <img 
                    src={qrCodeData.qrCode} 
                    alt="Partner Referral QR Code"
                    className="qr-code"
                  />
                </div>
                
                <div className="qr-info">
                  <p className="qr-description">
                    Share this QR code with potential patients. When they scan it and register, 
                    you'll earn commission points!
                  </p>
                  
                  <div className="referral-url">
                    <label>Referral URL:</label>
                    <div className="url-container">
                      <input
                        type="text"
                        value={qrCodeData.referralUrl}
                        readOnly
                        className="url-input"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(qrCodeData.referralUrl)}
                        className="copy-button"
                        title="Copy URL"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inactive Partner Notice */}
        {profile.partner.status !== 'active' && (
          <div className="inactive-notice">
            <div className="notice-icon">⚠️</div>
            <div className="notice-content">
              <h3>
                {profile.partner.status === 'pending' ? 'Application Under Review' : 'Account Suspended'}
              </h3>
              <p>
                {profile.partner.status === 'pending'
                  ? 'Your partner application is currently being reviewed. You\'ll be notified via email once approved.'
                  : 'Your account has been suspended. Please contact support for assistance.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerProfile;