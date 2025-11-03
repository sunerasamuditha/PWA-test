import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import DocumentUpload from '../components/DocumentUpload';
import DocumentPreview from '../components/DocumentPreview';
import { 
  validateFullName, 
  validatePhoneNumber, 
  formatDisplayName, 
  formatPhoneNumber,
  formatPassportNumber,
  formatPolicyNumber,
  isExpiringWithinMonths,
  validatePassportNumber,
  validatePassportExpiry
} from '../utils/validation';

const PatientProfile = () => {
  // State management
  const [profileData, setProfileData] = useState({
    // User fields
    fullName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    // Patient-specific fields
    passportInfo: null,
    insuranceInfo: null,
    currentAddress: ''
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState({
    personal: false,
    passport: false,
    insurance: false,
    address: false
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);
  
  // Document upload state
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [documentUploadType, setDocumentUploadType] = useState(null);
  const [passportDocuments, setPassportDocuments] = useState([]);
  const [insuranceDocuments, setInsuranceDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Hooks
  const { user } = useAuth();

  // Check if user is a patient
  useEffect(() => {
    if (user && user.role !== 'patient') {
      // Redirect non-patients
      window.location.href = '/dashboard';
      return;
    }
  }, [user]);

  // Fetch patient profile on mount
  useEffect(() => {
    fetchPatientProfile();
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      // Fetch passport documents
      const passportResponse = await apiService.documents.getDocuments({
        type: 'passport',
        limit: 10
      });
      if (passportResponse.success) {
        setPassportDocuments(passportResponse.data.documents || []);
      }

      // Fetch insurance documents
      const insuranceResponse = await apiService.documents.getDocuments({
        type: 'insurance_card',
        limit: 10
      });
      if (insuranceResponse.success) {
        setInsuranceDocuments(insuranceResponse.data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchPatientProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.patients.getPatientInfo();
      
      if (response.success) {
        const data = response.data;
        setProfileData({
          fullName: data.fullName || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
          address: data.address || '',
          emergencyContact: data.emergencyContact || '',
          passportInfo: data.passportInfo || null,
          insuranceInfo: data.insuranceInfo || null,
          currentAddress: data.currentAddress || ''
        });
      }
    } catch (error) {
      console.error('Error fetching patient profile:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load patient profile. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field-specific error
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleNestedChange = (section, field, value) => {
    setProfileData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleContactInfoChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      insuranceInfo: {
        ...prev.insuranceInfo,
        contactInfo: {
          ...prev.insuranceInfo?.contactInfo,
          [field]: value
        }
      }
    }));
  };

  const validateSection = (section) => {
    const newErrors = {};

    if (section === 'personal') {
      const nameValidation = validateFullName(profileData.fullName);
      if (!nameValidation.isValid) {
        newErrors.fullName = nameValidation.errors[0];
      }

      if (profileData.phoneNumber) {
        const phoneValidation = validatePhoneNumber(profileData.phoneNumber);
        if (!phoneValidation.isValid) {
          newErrors.phoneNumber = phoneValidation.errors[0];
        }
      }

      if (profileData.dateOfBirth) {
        const birthDate = new Date(profileData.dateOfBirth);
        const today = new Date();
        if (birthDate > today) {
          newErrors.dateOfBirth = 'Date of birth cannot be in the future';
        }
      }
    }

    if (section === 'passport' && profileData.passportInfo) {
      const { number, country, expiryDate } = profileData.passportInfo;
      
      if (!number) {
        newErrors.passportNumber = 'Passport number is required';
      } else {
        const passportValidation = validatePassportNumber(number);
        if (!passportValidation.isValid) {
          newErrors.passportNumber = passportValidation.errors[0];
        }
      }
      
      if (!country || country.length < 2 || country.length > 100) {
        newErrors.passportCountry = 'Country must be 2-100 characters';
      }
      
      if (expiryDate) {
        const expiryValidation = validatePassportExpiry(expiryDate);
        if (!expiryValidation.isValid) {
          newErrors.passportExpiry = expiryValidation.errors[0];
        }
      }
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveSection = async (section) => {
    if (!validateSection(section)) {
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      let updateData = {};

      if (section === 'personal') {
        updateData = {
          fullName: profileData.fullName,
          phoneNumber: profileData.phoneNumber,
          dateOfBirth: profileData.dateOfBirth,
          address: profileData.address,
          emergencyContact: profileData.emergencyContact
        };
      } else if (section === 'passport') {
        updateData = {
          passportInfo: profileData.passportInfo
        };
      } else if (section === 'insurance') {
        updateData = {
          insuranceInfo: profileData.insuranceInfo
        };
      } else if (section === 'address') {
        updateData = {
          currentAddress: profileData.currentAddress
        };
      }

      const response = await apiService.patients.updatePatientInfo(updateData);

      if (response.success) {
        setMessage({
          type: 'success',
          text: `${section.charAt(0).toUpperCase() + section.slice(1)} information updated successfully!`
        });
        
        setIsEditing(prev => ({
          ...prev,
          [section]: false
        }));
        
        // Refresh profile data
        await fetchPatientProfile();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentUpload = (type) => {
    setDocumentUploadType(type);
    setShowDocumentUpload(true);
  };

  const handleUploadSuccess = (document) => {
    setShowDocumentUpload(false);
    setDocumentUploadType(null);
    fetchDocuments(); // Refresh document list
    setMessage({
      type: 'success',
      text: 'Document uploaded successfully!'
    });
  };

  const handleViewDocument = (document) => {
    setSelectedDocument(document);
  };

  const handlePreviewClose = (documentDeleted) => {
    setSelectedDocument(null);
    if (documentDeleted) {
      // Refresh document lists and potentially profile/stats
      fetchDocuments();
      fetchPatientProfile();
    }
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const result = await apiService.documents.downloadDocument(doc.id);
      const blob = result.blob || result; // Support both new and old format
      const filename = result.filename || doc.originalFilename || `document-${doc.id}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      setMessage({
        type: 'error',
        text: 'Failed to download document'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="patient-profile-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="patient-profile-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <span className="separator">›</span>
        <span className="current">Patient Profile</span>
      </nav>

      {/* Page Header */}
      <div className="page-header">
        <h1>Patient Profile</h1>
        <p>Manage your personal information, passport details, and insurance coverage</p>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="profile-sections">
        {/* Personal Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Personal Information</h2>
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditing(prev => ({ ...prev, personal: !prev.personal }))}
            >
              {isEditing.personal ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="section-content">
            {isEditing.personal ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSection('personal'); }}>
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
                  {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={profileData.email}
                    disabled
                    className="disabled"
                  />
                  <small>Email cannot be changed. Contact support if needed.</small>
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
                  />
                  {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
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
                  {errors.dateOfBirth && <span className="error-text">{errors.dateOfBirth}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emergencyContact">Emergency Contact</label>
                  <input
                    type="text"
                    id="emergencyContact"
                    name="emergencyContact"
                    value={profileData.emergencyContact}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <div className="info-item">
                  <label>Full Name</label>
                  <span>{profileData.fullName || 'Not provided'}</span>
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <span>{profileData.email}</span>
                </div>
                <div className="info-item">
                  <label>Phone Number</label>
                  <span>{profileData.phoneNumber || 'Not provided'}</span>
                </div>
                <div className="info-item">
                  <label>Date of Birth</label>
                  <span>{profileData.dateOfBirth || 'Not provided'}</span>
                </div>
                <div className="info-item">
                  <label>Address</label>
                  <span>{profileData.address || 'Not provided'}</span>
                </div>
                <div className="info-item">
                  <label>Emergency Contact</label>
                  <span>{profileData.emergencyContact || 'Not provided'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Passport Information Section */}
        <div className="profile-section passport-section">
          <div className="section-header">
            <h2>Passport Information</h2>
            <div className="header-actions">
              <button
                className="btn btn-secondary"
                onClick={() => handleDocumentUpload('passport')}
              >
                📤 Upload Passport
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditing(prev => ({ ...prev, passport: !prev.passport }))}
              >
                {isEditing.passport ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="section-content">
            {profileData.passportInfo ? (
              <>
                {isExpiringWithinMonths(profileData.passportInfo.expiryDate) && (
                  <div className="expiry-warning">
                    ⚠️ Your passport is expiring within 6 months. Please renew it soon.
                  </div>
                )}

                {isEditing.passport ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSection('passport'); }}>
                    <div className="form-group">
                      <label>Passport Number *</label>
                      <input
                        type="text"
                        value={profileData.passportInfo.number || ''}
                        onChange={(e) => handleNestedChange('passportInfo', 'number', e.target.value)}
                        className={errors.passportNumber ? 'error' : ''}
                        required
                      />
                      {errors.passportNumber && <span className="error-text">{errors.passportNumber}</span>}
                    </div>

                    <div className="form-group">
                      <label>Country *</label>
                      <input
                        type="text"
                        value={profileData.passportInfo.country || ''}
                        onChange={(e) => handleNestedChange('passportInfo', 'country', e.target.value)}
                        className={errors.passportCountry ? 'error' : ''}
                        required
                      />
                      {errors.passportCountry && <span className="error-text">{errors.passportCountry}</span>}
                    </div>

                    <div className="form-group">
                      <label>Expiry Date *</label>
                      <input
                        type="date"
                        value={profileData.passportInfo.expiryDate || ''}
                        onChange={(e) => handleNestedChange('passportInfo', 'expiryDate', e.target.value)}
                        className={errors.passportExpiry ? 'error' : ''}
                        required
                      />
                      {errors.passportExpiry && <span className="error-text">{errors.passportExpiry}</span>}
                    </div>

                    <div className="form-group">
                      <label>Issue Date</label>
                      <input
                        type="date"
                        value={profileData.passportInfo.issueDate || ''}
                        onChange={(e) => handleNestedChange('passportInfo', 'issueDate', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Place of Issue</label>
                      <input
                        type="text"
                        value={profileData.passportInfo.placeOfIssue || ''}
                        onChange={(e) => handleNestedChange('passportInfo', 'placeOfIssue', e.target.value)}
                      />
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="passport-card">
                    <div className="info-item">
                      <label>Passport Number</label>
                      <span className="masked-field">{formatPassportNumber(profileData.passportInfo.number)}</span>
                    </div>
                    <div className="info-item">
                      <label>Country</label>
                      <span>{profileData.passportInfo.country}</span>
                    </div>
                    <div className="info-item">
                      <label>Expiry Date</label>
                      <span className={isExpiringWithinMonths(profileData.passportInfo.expiryDate) ? 'expiry-warning' : ''}>
                        {profileData.passportInfo.expiryDate || 'Not provided'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Issue Date</label>
                      <span>{profileData.passportInfo.issueDate || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Place of Issue</label>
                      <span>{profileData.passportInfo.placeOfIssue || 'Not provided'}</span>
                    </div>
                  </div>
                )}
                
                {/* Uploaded Passport Documents */}
                {passportDocuments.length > 0 && !isEditing.passport && (
                  <div className="uploaded-documents">
                    <h4>Uploaded Passport Documents</h4>
                    <div className="document-list">
                      {passportDocuments.map(doc => (
                        <div key={doc.id} className="document-item">
                          <span className="doc-icon">📄</span>
                          <span className="doc-name">{doc.originalFilename}</span>
                          <div className="doc-actions">
                            <button
                              className="btn-icon"
                              onClick={() => handleViewDocument(doc)}
                              title="View"
                            >
                              👁️
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleDownloadDocument(doc)}
                              title="Download"
                            >
                              ⬇️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No passport information on file.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setProfileData(prev => ({
                      ...prev,
                      passportInfo: { number: '', country: '', expiryDate: '', issueDate: '', placeOfIssue: '' }
                    }));
                    setIsEditing(prev => ({ ...prev, passport: true }));
                  }}
                >
                  Add Passport Information
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Insurance Information Section */}
        <div className="profile-section insurance-section">
          <div className="section-header">
            <h2>Insurance Information</h2>
            <div className="header-actions">
              <button
                className="btn btn-secondary"
                onClick={() => handleDocumentUpload('insurance_card')}
              >
                📤 Upload Insurance
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsEditing(prev => ({ ...prev, insurance: !prev.insurance }))}
              >
                {isEditing.insurance ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="section-content">
            {profileData.insuranceInfo ? (
              <>
                {isExpiringWithinMonths(profileData.insuranceInfo.expiryDate) && (
                  <div className="expiry-warning">
                    ⚠️ Your insurance is expiring within 6 months. Please renew it soon.
                  </div>
                )}

                {isEditing.insurance ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSection('insurance'); }}>
                    <div className="form-group">
                      <label>Insurance Provider</label>
                      <input
                        type="text"
                        value={profileData.insuranceInfo.provider || ''}
                        onChange={(e) => handleNestedChange('insuranceInfo', 'provider', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Policy Number</label>
                      <input
                        type="text"
                        value={profileData.insuranceInfo.policyNumber || ''}
                        onChange={(e) => handleNestedChange('insuranceInfo', 'policyNumber', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Coverage Type</label>
                      <select
                        value={profileData.insuranceInfo.coverageType || ''}
                        onChange={(e) => handleNestedChange('insuranceInfo', 'coverageType', e.target.value)}
                      >
                        <option value="">Select coverage type</option>
                        <option value="comprehensive">Comprehensive</option>
                        <option value="basic">Basic</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Expiry Date</label>
                      <input
                        type="date"
                        value={profileData.insuranceInfo.expiryDate || ''}
                        onChange={(e) => handleNestedChange('insuranceInfo', 'expiryDate', e.target.value)}
                      />
                    </div>

                    <div className="contact-info-section">
                      <h4>Contact Information</h4>
                      <div className="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          value={profileData.insuranceInfo.contactInfo?.phone || ''}
                          onChange={(e) => handleContactInfoChange('phone', e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={profileData.insuranceInfo.contactInfo?.email || ''}
                          onChange={(e) => handleContactInfoChange('email', e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Emergency Hotline</label>
                        <input
                          type="tel"
                          value={profileData.insuranceInfo.contactInfo?.emergencyHotline || ''}
                          onChange={(e) => handleContactInfoChange('emergencyHotline', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="insurance-card">
                    <div className="info-item">
                      <label>Provider</label>
                      <span>{profileData.insuranceInfo.provider || 'Not provided'}</span>
                    </div>
                    <div className="info-item">
                      <label>Policy Number</label>
                      <span className="masked-field">{formatPolicyNumber(profileData.insuranceInfo.policyNumber)}</span>
                    </div>
                    <div className="info-item">
                      <label>Coverage Type</label>
                      <span className={`coverage-badge ${profileData.insuranceInfo.coverageType}`}>
                        {profileData.insuranceInfo.coverageType || 'Not specified'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Expiry Date</label>
                      <span className={isExpiringWithinMonths(profileData.insuranceInfo.expiryDate) ? 'expiry-warning' : ''}>
                        {profileData.insuranceInfo.expiryDate || 'Not provided'}
                      </span>
                    </div>
                    
                    {profileData.insuranceInfo.contactInfo && (
                      <div className="contact-info">
                        <h4>Contact Information</h4>
                        <div className="info-item">
                          <label>Phone</label>
                          <span>{profileData.insuranceInfo.contactInfo.phone || 'Not provided'}</span>
                        </div>
                        <div className="info-item">
                          <label>Email</label>
                          <span>{profileData.insuranceInfo.contactInfo.email || 'Not provided'}</span>
                        </div>
                        <div className="info-item">
                          <label>Emergency Hotline</label>
                          <span>{profileData.insuranceInfo.contactInfo.emergencyHotline || 'Not provided'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Uploaded Insurance Documents */}
                {!isEditing.insurance && insuranceDocuments.length > 0 && (
                  <div className="uploaded-documents-section">
                    <h4>Uploaded Insurance Documents</h4>
                    <div className="document-grid">
                      {insuranceDocuments.map((doc) => (
                        <div key={doc.id} className="document-item">
                          <div className="document-icon">
                            <i className="fas fa-file-alt"></i>
                          </div>
                          <div className="document-info">
                            <div className="document-name">{doc.originalFilename}</div>
                            <div className="document-meta">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="document-actions">
                            <button
                              className="btn-icon"
                              onClick={() => handleViewDocument(doc)}
                              title="View"
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleDownloadDocument(doc)}
                              title="Download"
                            >
                              <i className="fas fa-download"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No insurance information on file.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setProfileData(prev => ({
                      ...prev,
                      insuranceInfo: {
                        provider: '',
                        policyNumber: '',
                        coverageType: '',
                        expiryDate: '',
                        contactInfo: { phone: '', email: '', emergencyHotline: '' }
                      }
                    }));
                    setIsEditing(prev => ({ ...prev, insurance: true }));
                  }}
                >
                  Add Insurance Information
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Current Address Section */}
        <div className="profile-section address-section">
          <div className="section-header">
            <h2>Current Address</h2>
            <button
              className="btn btn-secondary"
              onClick={() => setIsEditing(prev => ({ ...prev, address: !prev.address }))}
            >
              {isEditing.address ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="section-content">
            {isEditing.address ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSection('address'); }}>
                <div className="form-group">
                  <label htmlFor="currentAddress">Current Address</label>
                  <textarea
                    id="currentAddress"
                    name="currentAddress"
                    value={profileData.currentAddress}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Enter your current address"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <div className="info-item">
                  <label>Address</label>
                  <span>{profileData.currentAddress || 'Not provided'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div className="modal-overlay" onClick={() => setShowDocumentUpload(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload {documentUploadType === 'passport' ? 'Passport' : 'Insurance Card'}</h3>
              <button
                className="modal-close"
                onClick={() => setShowDocumentUpload(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <DocumentUpload
                patientUserId={user?.id}
                onUploadSuccess={handleUploadSuccess}
                allowedTypes={[documentUploadType]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {selectedDocument && (
        <DocumentPreview
          isOpen={Boolean(selectedDocument)}
          document={selectedDocument}
          onClose={handlePreviewClose}
        />
      )}
    </div>
  );
};

export default PatientProfile;