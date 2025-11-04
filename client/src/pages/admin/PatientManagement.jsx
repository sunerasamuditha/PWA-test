import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import PatientDetailsModal from '../../components/admin/PatientDetailsModal';

const PatientManagement = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [passportFilter, setPassportFilter] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const itemsPerPage = 10;

  // Debounced search function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Fetch patients with filters and pagination
  const fetchPatients = useCallback(async (page = 1, search = '', passportStatus = '', insuranceStatus = '') => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: itemsPerPage,
        search,
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      if (passportStatus) params.passportStatus = passportStatus;
      if (insuranceStatus) params.insuranceStatus = insuranceStatus;

      const response = await apiService.patients.getAllPatients(params);
      
      if (response.success) {
        setPatients(response.data.patients || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        throw new Error(response.message || 'Failed to fetch patients');
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to load patients');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((search, passport, insurance) => {
      setCurrentPage(1);
      fetchPatients(1, search, passport, insurance);
    }, 500),
    [fetchPatients]
  );

  // Initial load
  useEffect(() => {
    fetchPatients(currentPage, searchTerm, passportFilter, insuranceFilter);
  }, [fetchPatients, currentPage]);

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value, passportFilter, insuranceFilter);
  };

  // Handle filter changes
  const handlePassportFilterChange = (e) => {
    const value = e.target.value;
    setPassportFilter(value);
    setCurrentPage(1);
    fetchPatients(1, searchTerm, value, insuranceFilter);
  };

  const handleInsuranceFilterChange = (e) => {
    const value = e.target.value;
    setInsuranceFilter(value);
    setCurrentPage(1);
    fetchPatients(1, searchTerm, passportFilter, value);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle view patient details
  const handleViewPatient = (patient) => {
    // Normalize patient data to match the structure expected by PatientDetailsModal
    const normalizedPatient = {
      ...patient,
      // Map passport info fields
      hasPassport: !!patient.passportInfo,
      passportNumber: patient.passportInfo?.number || patient.passportInfo?.passportNumber || null,
      passportExpiry: patient.passportInfo?.expiryDate || patient.passportInfo?.passportExpiry || null,
      visaStatus: patient.passportInfo?.visaStatus || null,
      // Map insurance info fields
      hasInsurance: !!patient.insuranceInfo,
      insuranceProvider: patient.insuranceInfo?.provider || patient.insuranceInfo?.insuranceProvider || null,
      insurancePolicyNumber: patient.insuranceInfo?.policyNumber || patient.insuranceInfo?.insurancePolicyNumber || null,
      insuranceCoverage: patient.insuranceInfo?.coverage || patient.insuranceInfo?.insuranceCoverage || null,
      // Keep original nested objects for other uses
      passportInfo: patient.passportInfo,
      insuranceInfo: patient.insuranceInfo
    };
    
    setSelectedPatient(normalizedPatient);
    setShowDetailsModal(true);
  };

  // Format passport status
  const formatPassportStatus = (patient) => {
    if (!patient.passportInfo) return 'Not Provided';
    
    const expiryDate = new Date(patient.passportInfo.expiryDate);
    const today = new Date();
    const monthsUntilExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsUntilExpiry < 0) return 'Expired';
    if (monthsUntilExpiry < 6) return 'Expiring Soon';
    return 'Valid';
  };

  // Format insurance status
  const formatInsuranceStatus = (patient) => {
    if (!patient.insuranceInfo) return 'Not Provided';
    
    if (!patient.insuranceInfo.expiryDate) return 'Valid';
    
    const expiryDate = new Date(patient.insuranceInfo.expiryDate);
    const today = new Date();
    const monthsUntilExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsUntilExpiry < 0) return 'Expired';
    if (monthsUntilExpiry < 6) return 'Expiring Soon';
    return 'Valid';
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Valid': return 'status-badge status-active';
      case 'Expiring Soon': return 'status-badge status-warning';
      case 'Expired': return 'status-badge status-inactive';
      case 'Not Provided': return 'status-badge status-pending';
      default: return 'status-badge';
    }
  };

  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return (
      <div className="admin-page">
        <ErrorMessage message="Access denied. Administrator privileges required." />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Patient Management</h1>
        <p>Manage patient accounts and documentation status</p>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search patients by name, email, or phone..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={passportFilter}
            onChange={handlePassportFilterChange}
            className="filter-select"
          >
            <option value="">All Passport Status</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="missing">Not Provided</option>
          </select>

          <select
            value={insuranceFilter}
            onChange={handleInsuranceFilterChange}
            className="filter-select"
          >
            <option value="">All Insurance Status</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="missing">Not Provided</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      {!loading && (
        <div className="results-summary">
          Found {patients.length} patient{patients.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      {/* Main Content */}
      <div className="content-section">
        {error && <ErrorMessage message={error} />}
        
        {loading ? (
          <LoadingSpinner message="Loading patients..." />
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No Patients Found</h3>
            <p>
              {searchTerm || passportFilter || insuranceFilter
                ? 'Try adjusting your search criteria or filters.'
                : 'No patients have been registered yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Patients Table */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Passport Status</th>
                    <th>Insurance Status</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {patient.fullName?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{patient.fullName || 'Unknown'}</div>
                            <div className="user-id">ID: {patient.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="email-cell">
                          {patient.email || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <div className="phone-cell">
                          {patient.phoneNumber || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(formatPassportStatus(patient))}>
                          {formatPassportStatus(patient)}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(formatInsuranceStatus(patient))}>
                          {formatInsuranceStatus(patient)}
                        </span>
                      </td>
                      <td>
                        <div className="address-cell">
                          {patient.address ? (
                            <span title={patient.address}>
                              {patient.address.length > 30 
                                ? `${patient.address.substring(0, 30)}...` 
                                : patient.address}
                            </span>
                          ) : (
                            'Not provided'
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleViewPatient(patient)}
                            className="btn btn-sm btn-primary"
                            title="View Details"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatient && (
        <PatientDetailsModal
          patient={selectedPatient}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPatient(null);
          }}
        />
      )}
    </div>
  );
};

export default PatientManagement;