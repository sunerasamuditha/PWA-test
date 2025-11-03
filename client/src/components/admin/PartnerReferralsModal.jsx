import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';

const PartnerReferralsModal = ({ partnerId, partnerName, isOpen, onClose }) => {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [summary, setSummary] = useState({
    totalReferrals: 0,
    totalCommission: 0,
    paidCommission: 0,
    pendingCommission: 0
  });

  const itemsPerPage = 10;

  // Load referrals when modal opens
  useEffect(() => {
    if (isOpen && partnerId) {
      fetchReferrals();
    }
  }, [isOpen, partnerId, currentPage, statusFilter, sortBy, sortOrder]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy,
        sortOrder
      };

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await apiService.partners.getReferralsByPartner(partnerId, params);
      
      if (response.success) {
        setReferrals(response.data.referrals || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setSummary(response.data.summary || {
          totalReferrals: 0,
          totalCommission: 0,
          paidCommission: 0,
          pendingCommission: 0
        });
      } else {
        throw new Error(response.message || 'Failed to fetch referrals');
      }
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError(err.message || 'Failed to load referrals');
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle status filter change
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Handle sorting
  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'pending': 'status-badge status-pending',
      'approved': 'status-badge status-active',
      'completed': 'status-badge status-success',
      'cancelled': 'status-badge status-inactive',
      'rejected': 'status-badge status-danger'
    };
    return statusClasses[status] || 'status-badge status-default';
  };

  // Get commission status badge
  const getCommissionStatusBadge = (status) => {
    const statusClasses = {
      'pending': 'status-badge status-warning',
      'paid': 'status-badge status-success',
      'cancelled': 'status-badge status-inactive'
    };
    return statusClasses[status] || 'status-badge status-default';
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content extra-large-modal">
        <div className="modal-header">
          <div>
            <h2>Partner Referrals</h2>
            <p className="partner-name">{partnerName}</p>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {error && <ErrorMessage message={error} />}
          
          {/* Summary Cards */}
          <div className="referrals-summary">
            <div className="summary-card">
              <div className="summary-value">{summary.totalReferrals}</div>
              <div className="summary-label">Total Referrals</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(summary.totalCommission)}</div>
              <div className="summary-label">Total Commission</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(summary.paidCommission)}</div>
              <div className="summary-label">Paid Commission</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(summary.pendingCommission)}</div>
              <div className="summary-label">Pending Commission</div>
            </div>
          </div>

          {/* Filters */}
          <div className="referrals-filters">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${statusFilter === '' ? 'active' : ''}`}
                onClick={() => handleStatusFilter('')}
              >
                All Status
              </button>
              <button
                className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => handleStatusFilter('pending')}
              >
                Pending
              </button>
              <button
                className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
                onClick={() => handleStatusFilter('approved')}
              >
                Approved
              </button>
              <button
                className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => handleStatusFilter('completed')}
              >
                Completed
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading referrals..." />
          ) : referrals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Referrals Found</h3>
              <p>
                {statusFilter
                  ? `No referrals found with status "${statusFilter}"`
                  : 'This partner has not made any referrals yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Referrals Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('patient_name')}>
                        Patient Name {getSortIcon('patient_name')}
                      </th>
                      <th onClick={() => handleSort('service_type')}>
                        Service Type {getSortIcon('service_type')}
                      </th>
                      <th onClick={() => handleSort('referral_status')}>
                        Referral Status {getSortIcon('referral_status')}
                      </th>
                      <th onClick={() => handleSort('commission_amount')}>
                        Commission {getSortIcon('commission_amount')}
                      </th>
                      <th onClick={() => handleSort('commission_status')}>
                        Commission Status {getSortIcon('commission_status')}
                      </th>
                      <th onClick={() => handleSort('created_at')}>
                        Referral Date {getSortIcon('created_at')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id}>
                        <td>
                          <div className="patient-cell">
                            <div className="patient-avatar">
                              {referral.patientName?.charAt(0)?.toUpperCase() || 'P'}
                            </div>
                            <div className="patient-info">
                              <div className="patient-name">{referral.patientName || 'Unknown'}</div>
                              <div className="patient-id">ID: {referral.patientId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="service-cell">
                            <span className="service-type">{referral.serviceType || 'General'}</span>
                            {referral.specialtyRequired && (
                              <span className="specialty-tag">{referral.specialtyRequired}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(referral.referralStatus)}>
                            {referral.referralStatus || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <div className="commission-cell">
                            <span className="commission-amount">
                              {formatCurrency(referral.commissionAmount)}
                            </span>
                            {referral.commissionRate && (
                              <span className="commission-rate">
                                ({referral.commissionRate}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={getCommissionStatusBadge(referral.commissionStatus)}>
                            {referral.commissionStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div className="date-cell">
                            <div className="date-primary">{formatDate(referral.createdAt)}</div>
                            {referral.completedAt && (
                              <div className="date-secondary">
                                Completed: {formatDate(referral.completedAt)}
                              </div>
                            )}
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

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerReferralsModal;