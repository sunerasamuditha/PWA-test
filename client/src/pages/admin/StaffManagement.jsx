import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import PermissionEditor from '../../components/admin/PermissionEditor';

const StaffManagement = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    userData: {
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      dateOfBirth: '',
      address: '',
      emergencyContact: ''
    },
    staffData: {
      staff_role: 'front_desk',
      permissions: []
    }
  });

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

  // Fetch staff with filters and pagination
  const fetchStaff = useCallback(async (page = 1, search = '', role = '', sort = 'created_at', order = 'desc') => {
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

      if (role) params.staff_role = role;

      const response = await apiService.staff.getAllStaff(params);
      
      if (response.success) {
        setStaff(response.data.staff || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        throw new Error(response.message || 'Failed to fetch staff');
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError(err.message || 'Failed to load staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((search, role, sort, order) => {
      setCurrentPage(1);
      fetchStaff(1, search, role, sort, order);
    }, 500),
    [fetchStaff]
  );

  // Initial load
  useEffect(() => {
    fetchStaff(currentPage, searchTerm, roleFilter, sortBy, sortOrder);
  }, [fetchStaff, currentPage]);

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value, roleFilter, sortBy, sortOrder);
  };

  // Handle filter changes
  const handleRoleFilterChange = (e) => {
    const value = e.target.value;
    setRoleFilter(value);
    setCurrentPage(1);
    fetchStaff(1, searchTerm, value, sortBy, sortOrder);
  };

  // Handle sorting
  const handleSort = (field) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    setCurrentPage(1);
    fetchStaff(1, searchTerm, roleFilter, field, newOrder);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle edit permissions
  const handleEditPermissions = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowPermissionEditor(true);
  };

  // Handle create staff
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      const response = await apiService.staff.createStaff(createFormData);
      
      if (response.success) {
        alert('Staff member created successfully!');
        setShowCreateForm(false);
        setCreateFormData({
          userData: {
            fullName: '',
            email: '',
            password: '',
            phoneNumber: '',
            dateOfBirth: '',
            address: '',
            emergencyContact: ''
          },
          staffData: {
            staff_role: 'front_desk',
            permissions: []
          }
        });
        fetchStaff(1, searchTerm, roleFilter, sortBy, sortOrder);
      } else {
        throw new Error(response.message || 'Failed to create staff member');
      }
    } catch (err) {
      alert(`Error creating staff member: ${err.message}`);
    }
  };

  // Handle form input changes
  const handleUserDataChange = (field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      userData: {
        ...prev.userData,
        [field]: value
      }
    }));
  };

  const handleStaffDataChange = (field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      staffData: {
        ...prev.staffData,
        [field]: value
      }
    }));
  };

  // Format staff role
  const formatStaffRole = (role) => {
    const roleMap = {
      'front_desk': 'Front Desk',
      'back_office': 'Back Office',
      'admin': 'Administrator'
    };
    return roleMap[role] || role || 'Unknown';
  };

  // Get status badge class
  const getStatusBadgeClass = (isActive) => {
    return isActive ? 'status-badge status-active' : 'status-badge status-inactive';
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
        <div>
          <h1>Staff Management</h1>
          <p>Manage staff members, roles, and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          Add New Staff
        </button>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search staff by name, email, or phone..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={roleFilter}
            onChange={handleRoleFilterChange}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="front_desk">Front Desk</option>
            <option value="back_office">Back Office</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      {!loading && (
        <div className="results-summary">
          Found {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      {/* Main Content */}
      <div className="content-section">
        {error && <ErrorMessage message={error} />}
        
        {loading ? (
          <LoadingSpinner message="Loading staff..." />
        ) : staff.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👨‍💼</div>
            <h3>No Staff Found</h3>
            <p>
              {searchTerm || roleFilter
                ? 'Try adjusting your search criteria or filters.'
                : 'No staff members have been added yet.'}
            </p>
            {!searchTerm && !roleFilter && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary"
              >
                Add First Staff Member
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Staff Table */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Staff Role</th>
                    <th>Permissions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((staffMember) => (
                    <tr key={staffMember.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {staffMember.fullName?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{staffMember.fullName || 'Unknown'}</div>
                            <div className="user-id">ID: {staffMember.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="email-cell">
                          {staffMember.email || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <div className="phone-cell">
                          {staffMember.phoneNumber || 'Not provided'}
                        </div>
                      </td>
                      <td>
                        <span className="role-badge">
                          {formatStaffRole(staffMember.staffRole)}
                        </span>
                      </td>
                      <td>
                        <div className="permissions-cell">
                          <span className="permission-count">
                            {staffMember.permissions?.length || 0} permission{(staffMember.permissions?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(staffMember.isActive)}>
                          {staffMember.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEditPermissions(staffMember)}
                            className="btn btn-sm btn-primary"
                            title="Edit Permissions"
                          >
                            Permissions
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

      {/* Create Staff Form Modal */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Staff Member</h2>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateStaff} className="staff-form">
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={createFormData.userData.fullName}
                      onChange={(e) => handleUserDataChange('fullName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={createFormData.userData.email}
                      onChange={(e) => handleUserDataChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={createFormData.userData.password}
                      onChange={(e) => handleUserDataChange('password', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={createFormData.userData.phoneNumber}
                      onChange={(e) => handleUserDataChange('phoneNumber', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={createFormData.userData.dateOfBirth}
                      onChange={(e) => handleUserDataChange('dateOfBirth', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Emergency Contact</label>
                    <input
                      type="text"
                      value={createFormData.userData.emergencyContact}
                      onChange={(e) => handleUserDataChange('emergencyContact', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    value={createFormData.userData.address}
                    onChange={(e) => handleUserDataChange('address', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Staff Information</h3>
                <div className="form-group">
                  <label>Staff Role *</label>
                  <select
                    value={createFormData.staffData.staff_role}
                    onChange={(e) => handleStaffDataChange('staff_role', e.target.value)}
                    required
                  >
                    <option value="front_desk">Front Desk</option>
                    <option value="back_office">Back Office</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Editor Modal */}
      {showPermissionEditor && selectedStaff && (
        <PermissionEditor
          staff={selectedStaff}
          isOpen={showPermissionEditor}
          onClose={() => {
            setShowPermissionEditor(false);
            setSelectedStaff(null);
          }}
          onSave={() => {
            fetchStaff(currentPage, searchTerm, roleFilter, sortBy, sortOrder);
          }}
        />
      )}
    </div>
  );
};

export default StaffManagement;