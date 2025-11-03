import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import PartnerReferralsModal from '../../components/admin/PartnerReferralsModal';

const PartnerManagement = () => {
  const { user } = useAuth();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showReferralsModal, setShowReferralsModal] = useState(false);

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

  // Fetch partners with filters and pagination
  const fetchPartners = useCallback(async (page = 1, search = '', status = '', type = '', sort = 'created_at', order = 'desc') => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: itemsPerPage,
        search,
        sortBy: sort,
        sortOrder: order
      };

      if (status) params.status = status;
      if (type) params.type = type;

      const response = await apiService.partners.getAllPartners(params);
      
      if (response.success) {
        setPartners(response.data.partners || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        throw new Error(response.message || 'Failed to fetch partners');
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
      setError(err.message || 'Failed to load partners');
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((search, status, type, sort, order) => {
      setCurrentPage(1);
      fetchPartners(1, search, status, type, sort, order);
    }, 500),
    [fetchPartners]
  );

  // Initial load
  useEffect(() => {
    fetchPartners(currentPage, searchTerm, statusFilter, typeFilter, sortBy, sortOrder);
  }, [fetchPartners, currentPage]);

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value, statusFilter, typeFilter, sortBy, sortOrder);
  };

  // Handle filter changes
  const handleStatusFilterChange = (e) => {
    const value = e.target.value;
    setStatusFilter(value);
    setCurrentPage(1);
    fetchPartners(1, searchTerm, value, typeFilter, sortBy, sortOrder);
  };

  const handleTypeFilterChange = (e) => {
    const value = e.target.value;
    setTypeFilter(value);
    setCurrentPage(1);
    fetchPartners(1, searchTerm, statusFilter, value, sortBy, sortOrder);
  };

  // Handle sorting
  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    setCurrentPage(1);
    fetchPartners(1, searchTerm, statusFilter, typeFilter, field, newOrder);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle view referrals
  const handleViewReferrals = (partner) => {
    setSelectedPartner(partner);
    setShowReferralsModal(true);
  };

  // Handle view QR code
  const handleViewQRCode = (partner) => {
    // Stub for QR code functionality
    alert(`QR Code for ${partner.fullName} - Feature coming soon!`);
  };

  // Format partner type
  const formatPartnerType = (type) => {
    const typeMap = {
      'guide': 'Guide',
      'driver': 'Driver',
      'both': 'Guide & Driver'
    };
    return typeMap[type] || type || 'Unknown';
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'status-badge status-active';
      case 'pending': return 'status-badge status-pending';
      case 'suspended': return 'status-badge status-inactive';
      case 'inactive': return 'status-badge status-inactive';
      default: return 'status-badge';
    }
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
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
        <h1>Partner Management</h1>
        <p>Manage partner accounts, referrals, and commissions</p>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search partners by name, email, or phone..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={typeFilter}
            onChange={handleTypeFilterChange}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="guide">Guide</option>
            <option value="driver">Driver</option>
            <option value="both">Guide & Driver</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      {!loading && (
        <div className="results-summary">
          Found {partners.length} partner{partners.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      {/* Main Content */}
      <div className="content-section">
        {error && <ErrorMessage message={error} />}
        
        {loading ? (
          <LoadingSpinner message="Loading partners..." />
        ) : partners.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤝</div>
            <h3>No Partners Found</h3>
            <p>
              {searchTerm || statusFilter || typeFilter
                ? 'Try adjusting your search criteria or filters.'
                : 'No partners have been registered yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Partners Table */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Partner Type</th>
                    <th>Status</th>
                    <th 
                      onClick={() => handleSort('total_referrals')}
                      className="sortable-header"
                      style={{ cursor: 'pointer' }}
                    >
                      Total Referrals {getSortIcon('total_referrals')}
                    </th>
                    <th 
                      onClick={() => handleSort('total_commission_earned')}
                      className="sortable-header"
                      style={{ cursor: 'pointer' }}
                    >
                      Commission Earned {getSortIcon('total_commission_earned')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {partner.fullName?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{partner.fullName || 'Unknown'}</div>
                            <div className="user-id">ID: {partner.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="email-cell">
                          {partner.email || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <div className="phone-cell">
                          {partner.phoneNumber || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <span className="partner-type-badge">
                          {formatPartnerType(partner.type)}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(partner.status)}>
                          {partner.status || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div className="metric-cell">
                          <span className="metric-value">
                            {partner.totalReferrals || 0}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="metric-cell">
                          <span className="metric-value">
                            ${(partner.totalCommissionEarned || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleViewReferrals(partner)}
                            className="btn btn-sm btn-primary"
                            title="View Referrals"
                          >
                            Referrals
                          </button>
                          <button
                            onClick={() => handleViewQRCode(partner)}
                            className="btn btn-sm btn-secondary"
                            title="View QR Code"
                          >
                            QR Code
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

      {/* Partner Referrals Modal */}
      {showReferralsModal && selectedPartner && (
        <PartnerReferralsModal
          partnerId={selectedPartner.id}
          partnerName={selectedPartner.fullName}
          isOpen={showReferralsModal}
          onClose={() => {
            setShowReferralsModal(false);
            setSelectedPartner(null);
          }}
        />
      )}
    </div>
  );
};

export default PartnerManagement;