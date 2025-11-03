import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import CreateEntityModal from '../../components/admin/CreateEntityModal';
import EditEntityModal from '../../components/admin/EditEntityModal';
import EntityDetailsModal from '../../components/admin/EntityDetailsModal';
import { getEntityTypeDisplayName, getEntityTypeBadgeColor } from '../../utils/validation';

const ExternalEntityManagement = () => {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntities, setTotalEntities] = useState(0);
  const limit = 10;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Entity types for filter dropdown
  const ENTITY_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'hospital', label: 'Hospital' },
    { value: 'lab', label: 'Laboratory' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'insurance_company', label: 'Insurance Company' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchEntities();
  }, [currentPage, searchTerm, typeFilter]);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit,
        search: searchTerm || undefined,
        type: typeFilter || undefined
      };

      const response = await apiService.externalEntities.list(params);
      
      setEntities(response.data.entities || []);
      setTotalPages(response.data.pagination.totalPages || 1);
      setTotalEntities(response.data.pagination.total || 0);
    } catch (err) {
      console.error('Error fetching entities:', err);
      setError(err.response?.data?.message || 'Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleCreateEntity = () => {
    setShowCreateModal(true);
  };

  const handleEditEntity = (entity) => {
    setSelectedEntity(entity);
    setShowEditModal(true);
  };

  const handleViewDetails = (entity) => {
    setSelectedEntity(entity);
    setShowDetailsModal(true);
  };

  const handleDeleteEntity = async (entityId, entityName) => {
    if (!window.confirm(`Are you sure you want to delete "${entityName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError('');
      await apiService.externalEntities.delete(entityId);
      setSuccessMessage(`Entity "${entityName}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh list
      fetchEntities();
    } catch (err) {
      console.error('Error deleting entity:', err);
      setError(err.response?.data?.message || 'Failed to delete entity');
    }
  };

  const handleCreateSubmit = async (formData) => {
    try {
      await apiService.externalEntities.create(formData);
      handleCreateSuccess();
    } catch (err) {
      throw err; // Let modal handle the error
    }
  };

  const handleEditSubmit = async (formData) => {
    try {
      await apiService.externalEntities.update(selectedEntity.id, formData);
      handleEditSuccess();
    } catch (err) {
      throw err; // Let modal handle the error
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    setSuccessMessage('Entity created successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchEntities();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedEntity(null);
    setSuccessMessage('Entity updated successfully');
    setTimeout(() => setSuccessMessage(''), 3000);
    fetchEntities();
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatContactInfo = (contactInfo) => {
    if (!contactInfo) return 'N/A';
    
    const parts = [];
    if (contactInfo.phone) parts.push(contactInfo.phone);
    if (contactInfo.email) parts.push(contactInfo.email);
    
    return parts.length > 0 ? parts.join(' | ') : 'N/A';
  };

  if (loading && entities.length === 0) {
    return (
      <div className="container mt-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>External Entity Management</h2>
        <button className="btn btn-primary" onClick={handleCreateEntity}>
          <i className="bi bi-plus-circle me-2"></i>
          Create Entity
        </button>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError('')} />}
      
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="searchInput" className="form-label">Search</label>
              <input
                type="text"
                id="searchInput"
                className="form-control"
                placeholder="Search by name, phone, email..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="typeFilter" className="form-label">Type</label>
              <select
                id="typeFilter"
                className="form-select"
                value={typeFilter}
                onChange={handleTypeFilterChange}
              >
                {ENTITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-3">
        <p className="text-muted">
          Showing {entities.length} of {totalEntities} entities
          {searchTerm && ` matching "${searchTerm}"`}
          {typeFilter && ` (${getEntityTypeDisplayName(typeFilter)})`}
        </p>
      </div>

      {/* Entities Table */}
      <div className="card">
        <div className="card-body">
          {entities.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="mt-3 text-muted">No entities found</p>
              {(searchTerm || typeFilter) && (
                <button
                  className="btn btn-link"
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('');
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
                    <th>Name</th>
                    <th>Type</th>
                    <th>Contact Info</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map(entity => (
                    <tr key={entity.id}>
                      <td>
                        <strong>{entity.name}</strong>
                      </td>
                      <td>
                        <span 
                          className="entity-type-badge"
                          style={{ backgroundColor: getEntityTypeBadgeColor(entity.type) }}
                        >
                          {getEntityTypeDisplayName(entity.type)}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatContactInfo(entity.contactInfo)}
                        </small>
                      </td>
                      <td>
                        <small className="text-muted">
                          {new Date(entity.createdAt).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => handleViewDetails(entity)}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => handleEditEntity(entity)}
                            title="Edit"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleDeleteEntity(entity.id, entity.name)}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                    // Show first, last, current, and adjacent pages
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
        <CreateEntityModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {showEditModal && selectedEntity && (
        <EditEntityModal
          isOpen={showEditModal}
          entity={selectedEntity}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEntity(null);
          }}
          onSubmit={handleEditSubmit}
        />
      )}

      {showDetailsModal && selectedEntity && (
        <EntityDetailsModal
          isOpen={showDetailsModal}
          entity={selectedEntity}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedEntity(null);
          }}
          onEdit={(entity) => {
            setShowDetailsModal(false);
            handleEditEntity(entity);
          }}
        />
      )}
    </div>
  );
};

export default ExternalEntityManagement;
