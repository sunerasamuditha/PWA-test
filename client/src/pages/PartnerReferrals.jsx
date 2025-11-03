import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PartnerReferrals = () => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });

  const fetchReferrals = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = {
        page,
        limit: pagination.limit
      };

      if (filters.startDate) {
        queryParams.startDate = filters.startDate;
      }
      if (filters.endDate) {
        queryParams.endDate = filters.endDate;
      }

      const response = await apiService.partners.getReferrals(queryParams);
      
      if (response.success) {
        setReferrals(response.data.referrals || []);
        setPagination({
          ...pagination,
          ...response.data.pagination,
          currentPage: page
        });
      } else {
        throw new Error(response.message || 'Failed to fetch referrals');
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
      setError(error.message);
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReferrals(1); // Reset to page 1 when filtering
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchReferrals(newPage);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCommission = (amount) => {
    return `${parseFloat(amount || 0).toFixed(2)} pts`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Referrals</h1>
        <p>Track your referral history and commission earnings</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <h2>Filter Referrals</h2>
        </div>
        <form onSubmit={handleFilterSubmit} className="form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <button type="submit" className="btn btn-primary">
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Referrals List */}
      <div className="card">
        <div className="card-header">
          <h2>Referral History</h2>
          {pagination.totalCount > 0 && (
            <span className="text-muted">
              Total: {pagination.totalCount} referrals
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading referrals...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p className="error-text">Error: {error}</p>
            <button 
              onClick={() => fetchReferrals(pagination.currentPage)} 
              className="btn btn-secondary"
            >
              Retry
            </button>
          </div>
        ) : referrals.length === 0 ? (
          <div className="empty-state">
            <p>No referrals found.</p>
            {(filters.startDate || filters.endDate) && (
              <button 
                onClick={() => {
                  setFilters({ startDate: '', endDate: '' });
                  fetchReferrals(1);
                }}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Patient Email</th>
                    <th>Referred Date</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id}>
                      <td>
                        <div className="patient-info">
                          <strong>{referral.patientName || 'N/A'}</strong>
                        </div>
                      </td>
                      <td>{referral.patientEmail || 'N/A'}</td>
                      <td>{formatDate(referral.referredAt)}</td>
                      <td>
                        <span className="commission-amount">
                          {formatCommission(referral.commissionAmount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination-wrapper">
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage <= 1}
                    className="btn btn-secondary"
                  >
                    Previous
                  </button>
                  
                  <span className="page-info">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage >= pagination.totalPages}
                    className="btn btn-secondary"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PartnerReferrals;