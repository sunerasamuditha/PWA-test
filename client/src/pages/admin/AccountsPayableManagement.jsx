import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import CreatePayableModal from '../../components/admin/CreatePayableModal';
import PayableDetailsModal from '../../components/admin/PayableDetailsModal';
import MarkPayableAsPaidModal from '../../components/admin/MarkPayableAsPaidModal';
import {
  getPayableStatusDisplayName,
  getPayableStatusBadgeColor,
  calculatePayableDaysOverdue,
  isDueWithinDays
} from '../../utils/validation';

const AccountsPayableManagement = () => {
  const location = useLocation();
  const [payables, setPayables] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Statistics for alerts
  const [stats, setStats] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayables, setTotalPayables] = useState(0);
  const limit = 10;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateField, setDateField] = useState('due_date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);

  const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'due', label: 'Due' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' }
  ];

  useEffect(() => {
    fetchEntities();
    fetchStats();
  }, []);

  // Parse URL query params on mount to apply deep-link filters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const entityIdParam = searchParams.get('entity_id') || searchParams.get('entity'); // Support both for backwards compatibility
    
    if (entityIdParam && entityIdParam !== entityFilter) {
      setEntityFilter(entityIdParam);
      setCurrentPage(1);
    }
  }, [location.search]); // Only run when URL changes

  useEffect(() => {
    fetchPayables();
  }, [currentPage, searchTerm, statusFilter, entityFilter, dateField, startDate, endDate]);

  const fetchEntities = async () => {
    try {
      const response = await apiService.externalEntities.list({ limit: 1000 });
      setEntities(response.data.entities || []);
    } catch (err) {
      console.error('Error fetching entities:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.accountsPayable.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchPayables = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        entity_id: entityFilter || undefined,
        dateField: dateField || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };

      const response = await apiService.accountsPayable.list(params);
      
      setPayables(response.data.payables || []);
      setTotalPages(response.data.pagination.totalPages || 1);
      setTotalPayables(response.data.pagination.total || 0);
    } catch (err) {
      console.error('Error fetching payables:', err);
      setError(err.response?.data?.message || 'Failed to fetch payables');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleEntityFilterChange = (e) => {
    setEntityFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleDateFieldChange = (e) => {
    setDateField(e.target.value);
    setCurrentPage(1);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setCurrentPage(1);
  };

  const handleCreatePayable = () => {
    setShowCreateModal(true);
  };

  const handleViewDetails = (payable) => {
    setSelectedPayable(payable);
    setShowDetailsModal(true);
  };

  const handleMarkAsPaid = (payable) => {
    setSelectedPayable(payable);
    setShowMarkPaidModal(true);
  };

  const handleCreateSubmit = async (formData) => {
    try {
      await apiService.accountsPayable.create(formData);
      handleCreateSuccess();
    } catch (err) {
      throw err; // Let modal handle the error
    }
  };

  const handleMarkPaidSubmit = async (id, formData) => {
    try {
      await apiService.accountsPayable.markAsPaid(id, formData);
      handleMarkPaidSuccess();
    } catch (err) {
      throw err; // Let modal handle the error
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setSuccessMessage('Payable created successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchPayables();
    fetchStats();
  };

  const handleMarkPaidSuccess = () => {
    setShowMarkPaidModal(false);
    setSelectedPayable(null);
    setSuccessMessage('Payable marked as paid successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchPayables();
    fetchStats();
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadgeClass = (status) => {
    const baseClass = 'status-badge';
    switch (status) {
      case 'due':
        return `${baseClass} status-due`;
      case 'paid':
        return `${baseClass} status-paid`;
      case 'overdue':
        return `${baseClass} status-overdue`;
      default:
        return baseClass;
    }
  };

  if (loading && payables.length === 0) {
    return (
      <div className="container mt-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Accounts Payable Management</h2>
        <button className="btn btn-primary" onClick={handleCreatePayable}>
          <i className="bi bi-plus-circle me-2"></i>
          Create Payable
        </button>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
      
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Alert Banners */}
      {stats && (
        <>
          {stats.overdueCount > 0 && (
            <div className="alert-banner alert-danger mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Overdue Payables:</strong> {stats.overdueCount} payable{stats.overdueCount !== 1 ? 's' : ''} totaling {formatCurrency(stats.overdueAmount)} are overdue
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => {
                    setStatusFilter('overdue');
                    setCurrentPage(1);
                  }}
                >
                  View Overdue
                </button>
              </div>
            </div>
          )}

          {stats.dueSoonCount > 0 && (
            <div className="alert-banner alert-warning mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <i className="bi bi-clock-fill me-2"></i>
                  <strong>Due Soon:</strong> {stats.dueSoonCount} payable{stats.dueSoonCount !== 1 ? 's' : ''} totaling {formatCurrency(stats.dueSoonAmount)} due within 7 days
                </div>
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={async () => {
                    try {
                      const response = await apiService.accountsPayable.getDueSoon(7);
                      setPayables(response.data.payables || []);
                      setTotalPages(1);
                      setTotalPayables(response.data.payables?.length || 0);
                      setStatusFilter('');
                      setEntityFilter('');
                      setStartDate('');
                      setEndDate('');
                    } catch (err) {
                      console.error('Error fetching due soon payables:', err);
                    }
                  }}
                >
                  View Due Soon
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label htmlFor="searchInput" className="form-label">Search</label>
              <input
                type="text"
                id="searchInput"
                className="form-control"
                placeholder="Search by description, reference..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div className="col-md-4">
              <label htmlFor="statusFilter" className="form-label">Status</label>
              <select
                id="statusFilter"
                className="form-select"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="entityFilter" className="form-label">Entity</label>
              <select
                id="entityFilter"
                className="form-select"
                value={entityFilter}
                onChange={handleEntityFilterChange}
              >
                <option value="">All Entities</option>
                {entities.map(entity => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row g-3 mt-2">
            <div className="col-md-4">
              <label htmlFor="dateField" className="form-label">Date Field</label>
              <select
                id="dateField"
                className="form-select"
                value={dateField}
                onChange={handleDateFieldChange}
              >
                <option value="due_date">Due Date</option>
                <option value="paid_date">Paid Date</option>
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="startDate" className="form-label">Start Date</label>
              <input
                type="date"
                id="startDate"
                className="form-control"
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>
            <div className="col-md-4">
              <label htmlFor="endDate" className="form-label">End Date</label>
              <input
                type="date"
                id="endDate"
                className="form-control"
                value={endDate}
                onChange={handleEndDateChange}
              />
            </div>
          </div>

          {(searchTerm || statusFilter || entityFilter || startDate || endDate) && (
            <div className="mt-3">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setEntityFilter('');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-3">
        <p className="text-muted">
          Showing {payables.length} of {totalPayables} payables
          {searchTerm && ` matching "${searchTerm}"`}
          {statusFilter && ` (${getPayableStatusDisplayName(statusFilter)})`}
        </p>
      </div>

      {/* Payables Table */}
      <div className="card">
        <div className="card-body">
          {payables.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="mt-3 text-muted">No payables found</p>
              {(searchTerm || statusFilter || entityFilter || startDate || endDate) && (
                <button
                  className="btn btn-link"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setEntityFilter('');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map(payable => {
                    const daysOverdue = calculatePayableDaysOverdue(payable);
                    const isDueSoon = isDueWithinDays(payable, 7);

                    return (
                      <tr key={payable.id}>
                        <td>
                          <strong>{payable.entityName}</strong>
                          {payable.referenceCode && (
                            <div>
                              <small className="text-muted">Ref: {payable.referenceCode}</small>
                            </div>
                          )}
                        </td>
                        <td>
                          {payable.description ? (
                            <span>{payable.description.substring(0, 50)}{payable.description.length > 50 ? '...' : ''}</span>
                          ) : (
                            <span className="text-muted">No description</span>
                          )}
                        </td>
                        <td>
                          <strong>{formatCurrency(payable.totalAmount)}</strong>
                        </td>
                        <td>
                          <div>
                            {new Date(payable.dueDate).toLocaleDateString()}
                          </div>
                          {payable.status === 'overdue' && daysOverdue > 0 && (
                            <small className="text-danger">
                              {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                            </small>
                          )}
                          {payable.status === 'due' && isDueSoon && (
                            <small className="text-warning">
                              Due soon
                            </small>
                          )}
                          {payable.paidDate && (
                            <div>
                              <small className="text-muted">
                                Paid: {new Date(payable.paidDate).toLocaleDateString()}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          <span 
                            className={getStatusBadgeClass(payable.status)}
                            style={{ backgroundColor: getPayableStatusBadgeColor(payable.status) }}
                          >
                            {getPayableStatusDisplayName(payable.status)}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleViewDetails(payable)}
                              title="View Details"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            {payable.status !== 'paid' && (
                              <button
                                className="btn btn-outline-success"
                                onClick={() => handleMarkAsPaid(payable)}
                                title="Mark as Paid"
                              >
                                <i className="bi bi-check-circle"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <nav>
                <ul className="pagination">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                  </li>
                  
                  {[...Array(totalPages)].map((_, index) => {
                    const page = index + 1;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <li
                          key={page}
                          className={`page-item ${currentPage === page ? 'active' : ''}`}
                        >
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </button>
                        </li>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return (
                        <li key={page} className="page-item disabled">
                          <span className="page-link">...</span>
                        </li>
                      );
                    }
                    return null;
                  })}
                  
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreatePayableModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {showDetailsModal && selectedPayable && (
        <PayableDetailsModal
          isOpen={showDetailsModal}
          payable={selectedPayable}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPayable(null);
          }}
          onMarkAsPaid={(payable) => {
            setShowDetailsModal(false);
            handleMarkAsPaid(payable);
          }}
        />
      )}

      {showMarkPaidModal && selectedPayable && (
        <MarkPayableAsPaidModal
          isOpen={showMarkPaidModal}
          payable={selectedPayable}
          onClose={() => {
            setShowMarkPaidModal(false);
            setSelectedPayable(null);
          }}
          onSubmit={handleMarkPaidSubmit}
        />
      )}
    </div>
  );
};

export default AccountsPayableManagement;
