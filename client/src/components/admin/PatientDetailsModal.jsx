import React, { useState, useEffect } from 'react';
import ErrorMessage from '../ErrorMessage';

const PatientDetailsModal = ({ patient, isOpen, onClose }) => {
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setActiveTab('personal');
    }
  }, [isOpen]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'active': 'status-badge status-active',
      'inactive': 'status-badge status-inactive',
      'pending': 'status-badge status-pending',
      'suspended': 'status-badge status-warning'
    };
    return statusClasses[status] || 'status-badge status-default';
  };

  // Get passport status badge
  const getPassportStatusBadge = (hasPassport) => {
    return hasPassport ? 
      <span className="status-badge status-active">Has Passport</span> : 
      <span className="status-badge status-inactive">No Passport</span>;
  };

  // Get insurance status badge
  const getInsuranceStatusBadge = (hasInsurance) => {
    return hasInsurance ? 
      <span className="status-badge status-active">Insured</span> : 
      <span className="status-badge status-warning">Uninsured</span>;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h2>Patient Details</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {error && <ErrorMessage message={error} />}
          
          {patient ? (
            <div className="patient-details">
              {/* Patient Summary */}
              <div className="patient-summary">
                <div className="patient-avatar">
                  {patient.fullName?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div className="patient-info">
                  <h3>{patient.fullName || 'Unknown Patient'}</h3>
                  <p>Patient ID: {patient.id}</p>
                  <div className="patient-badges">
                    <span className={getStatusBadgeClass(patient.status)}>
                      {patient.status || 'Unknown'}
                    </span>
                    {getPassportStatusBadge(patient.hasPassport)}
                    {getInsuranceStatusBadge(patient.hasInsurance)}
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="tab-navigation">
                <button
                  className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
                  onClick={() => setActiveTab('personal')}
                >
                  Personal Information
                </button>
                <button
                  className={`tab-btn ${activeTab === 'medical' ? 'active' : ''}`}
                  onClick={() => setActiveTab('medical')}
                >
                  Medical Information
                </button>
                <button
                  className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setActiveTab('documents')}
                >
                  Documents & Travel
                </button>
                <button
                  className={`tab-btn ${activeTab === 'financial' ? 'active' : ''}`}
                  onClick={() => setActiveTab('financial')}
                >
                  Financial Information
                </button>
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {activeTab === 'personal' && (
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>Full Name</label>
                      <span>{patient.fullName || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Email</label>
                      <span>{patient.email || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Phone Number</label>
                      <span>{patient.phoneNumber || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Date of Birth</label>
                      <span>{formatDate(patient.dateOfBirth)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Gender</label>
                      <span>{patient.gender || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Nationality</label>
                      <span>{patient.nationality || 'Not provided'}</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Address</label>
                      <span>{patient.address || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Emergency Contact</label>
                      <span>{patient.emergencyContact || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Registration Date</label>
                      <span>{formatDate(patient.createdAt)}</span>
                    </div>
                  </div>
                )}

                {activeTab === 'medical' && (
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>Blood Type</label>
                      <span>{patient.bloodType || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Height</label>
                      <span>{patient.height ? `${patient.height} cm` : 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Weight</label>
                      <span>{patient.weight ? `${patient.weight} kg` : 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Medical Conditions</label>
                      <span>{patient.medicalConditions || 'None reported'}</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Allergies</label>
                      <span>{patient.allergies || 'None reported'}</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Current Medications</label>
                      <span>{patient.currentMedications || 'None reported'}</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Medical History</label>
                      <span>{patient.medicalHistory || 'No history recorded'}</span>
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>Passport Status</label>
                      <span>{getPassportStatusBadge(patient.hasPassport)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Passport Number</label>
                      <span>{patient.passportNumber || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Passport Expiry</label>
                      <span>{formatDate(patient.passportExpiry)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Visa Status</label>
                      <span>{patient.visaStatus || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Preferred Destination</label>
                      <span>{patient.preferredDestination || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Travel Budget</label>
                      <span>{patient.travelBudget ? formatCurrency(patient.travelBudget) : 'Not specified'}</span>
                    </div>
                    <div className="detail-item full-width">
                      <label>Special Requirements</label>
                      <span>{patient.specialRequirements || 'None specified'}</span>
                    </div>
                  </div>
                )}

                {activeTab === 'financial' && (
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>Insurance Status</label>
                      <span>{getInsuranceStatusBadge(patient.hasInsurance)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Insurance Provider</label>
                      <span>{patient.insuranceProvider || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Insurance Policy Number</label>
                      <span>{patient.insurancePolicyNumber || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Insurance Coverage</label>
                      <span>{patient.insuranceCoverage ? formatCurrency(patient.insuranceCoverage) : 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Payment Method</label>
                      <span>{patient.preferredPaymentMethod || 'Not specified'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Account Status</label>
                      <span className={getStatusBadgeClass(patient.status)}>
                        {patient.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Patient not found or no data available.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailsModal;