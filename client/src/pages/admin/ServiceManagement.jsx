import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import CreateServiceModal from '../../components/admin/CreateServiceModal';
import EditServiceModal from '../../components/admin/EditServiceModal';

const ServiceManagement = () => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    is_active: '',
    search: '',
    min_price: '',
    max_price: '',
    page: 1,
    limit: 20
  });

  // Check permissions
  const hasPermission = user?.role === 'admin' || user?.role === 'super_admin' || 
                        (user?.role === 'staff' && user?.permissions?.includes('process_payments'));

  useEffect(() => {
    if (hasPermission) {
      fetchServices();
      fetchStats();
    }
  }, [filters, hasPermission]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.services.getAllServices(filters);
      setServices(response.data.services || []);
      setPagination(response.data.pagination || null);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiService.services.getServiceStats();
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleCreateService = async (serviceData) => {
    try {
      await apiService.services.createService(serviceData);
      setShowCreateModal(false);
      fetchServices();
      fetchStats();
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateService = async (serviceId, serviceData) => {
    try {
      await apiService.services.updateService(serviceId, serviceData);
      setShowEditModal(false);
      setSelectedService(null);
      fetchServices();
      fetchStats();
    } catch (err) {
      throw err;
    }
  };

  const handleDeactivate = async (serviceId) => {
    if (!window.confirm('Are you sure you want to deactivate this service?')) return;
    
    try {
      await apiService.services.deactivateService(serviceId);
      fetchServices();
      fetchStats();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to deactivate service');
    }
  };

  const handleReactivate = async (serviceId) => {
    try {
      await apiService.services.reactivateService(serviceId);
      fetchServices();
      fetchStats();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to reactivate service');
    }
  };

  const handleEdit = (service) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  const getCategoryDisplayName = (category) => {
    const categoryMap = {
      consultation: 'Consultation',
      procedure: 'Procedure',
      lab_test: 'Lab Test',
      room_charge: 'Room Charge',
      service_charge: 'Service Charge',
      other: 'Other'
    };
    return categoryMap[category] || category;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!hasPermission) {
    return (
      <div className="service-management-container">
        <ErrorMessage message="You do not have permission to access service management." />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="service-management-container">
      <div className="service-management-header">
        <h1>Service Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Add Service
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Statistics */}
      {stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Services</h3>
              <p className="stat-value">{stats.totalServices}</p>
            </div>
            <div className="stat-card">
              <h3>Active Services</h3>
              <p className="stat-value">{stats.activeServices}</p>
            </div>
            <div className="stat-card">
              <h3>Inactive Services</h3>
              <p className="stat-value">{stats.totalServices - stats.activeServices}</p>
            </div>
          </div>

          {/* Category Breakdown */}
          {stats.servicesByCategory && stats.servicesByCategory.length > 0 && (
            <div className="category-breakdown">
              <h3>Services by Category</h3>
              <div className="category-grid">
                {stats.servicesByCategory.map((cat) => (
                  <div key={cat.category} className="category-card">
                    <div className="category-name">{getCategoryDisplayName(cat.category)}</div>
                    <div className="category-count">{cat.count} services</div>
                    <div className="category-avg">Avg: {formatCurrency(cat.avgPrice || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          placeholder="Search by name or description..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="filter-input"
        />

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="filter-select"
        >
          <option value="">All Categories</option>
          <option value="consultation">Consultation</option>
          <option value="procedure">Procedure</option>
          <option value="lab_test">Lab Test</option>
          <option value="room_charge">Room Charge</option>
          <option value="service_charge">Service Charge</option>
          <option value="other">Other</option>
        </select>

        <select
          value={filters.is_active}
          onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <input
          type="number"
          placeholder="Min Price"
          value={filters.min_price}
          onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
          className="filter-input filter-input-small"
        />

        <input
          type="number"
          placeholder="Max Price"
          value={filters.max_price}
          onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
          className="filter-input filter-input-small"
        />
      </div>

      {/* Services Table */}
      <div className="table-container">
        <table className="data-table service-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Service Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">No services found</td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id}>
                  <td>{service.id}</td>
                  <td>
                    <div className="service-name">{service.name}</div>
                    {service.description && (
                      <div className="service-description">{service.description}</div>
                    )}
                  </td>
                  <td>
                    <span className="category-badge">
                      {getCategoryDisplayName(service.serviceCategory)}
                    </span>
                  </td>
                  <td className="price-cell">{formatCurrency(service.price)}</td>
                  <td>
                    <span className={`status-badge ${service.isActive ? 'status-active' : 'status-inactive'}`}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(service)}
                      >
                        Edit
                      </button>
                      {service.isActive ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeactivate(service.id)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleReactivate(service.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total services)
          </span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= pagination.totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Create Service Modal */}
      {showCreateModal && (
        <CreateServiceModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateService}
        />
      )}

      {/* Edit Service Modal */}
      {showEditModal && selectedService && (
        <EditServiceModal
          service={selectedService}
          onClose={() => {
            setShowEditModal(false);
            setSelectedService(null);
          }}
          onSubmit={handleUpdateService}
        />
      )}
    </div>
  );
};

export default ServiceManagement;
