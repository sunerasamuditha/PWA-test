import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import ConfirmDialog from '../../components/ConfirmDialog';
import CreateUserModal from '../../components/admin/CreateUserModal';
import EditUserModal from '../../components/admin/EditUserModal';

const UserManagement = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize] = useState(10);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Modals and dialogs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // Hooks
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Check if user has admin access
  useEffect(() => {
    if (authUser && !['admin', 'super_admin'].includes(authUser.role)) {
      navigate('/unauthorized');
    }
  }, [authUser, navigate]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: pageSize
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      
      if (roleFilter) {
        params.role = roleFilter;
      }
      
      if (statusFilter) {
        params.isActive = statusFilter;
      }

      const response = await apiService.users.getAllUsers(params);
      
      if (response.success) {
        setUsers(response.data.users);
        setTotalPages(response.data.totalPages);
        setTotalUsers(response.data.total);
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, roleFilter, statusFilter]);

  // Fetch users when dependencies change
  useEffect(() => {
    if (authUser && ['admin', 'super_admin'].includes(authUser.role)) {
      fetchUsers();
    }
  }, [fetchUsers, authUser]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle role filter change
  const handleRoleFilterChange = (e) => {
    setRoleFilter(e.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle user creation
  const handleUserCreated = () => {
    setShowCreateModal(false);
    fetchUsers(); // Refresh user list
  };

  // Handle user edit
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  // Handle user update
  const handleUserUpdated = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    fetchUsers(); // Refresh user list
  };

  // Handle user deactivation/reactivation
  const handleToggleUserStatus = async (user) => {
    const action = user.isActive ? 'deactivate' : 'reactivate';
    const actionText = user.isActive ? 'deactivate' : 'reactivate';
    
    setConfirmAction({
      type: action,
      user,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`,
      message: `Are you sure you want to ${actionText} ${user.fullName}? ${
        user.isActive ? 'They will no longer be able to access their account.' : 'They will regain access to their account.'
      }`,
      confirmText: actionText.charAt(0).toUpperCase() + actionText.slice(1),
      variant: user.isActive ? 'danger' : 'info'
    });
    
    setShowConfirmDialog(true);
  };

  // Execute confirmed action
  const executeConfirmAction = async () => {
    try {
      setLoading(true);
      
      if (confirmAction.type === 'deactivate') {
        await apiService.users.deactivate(confirmAction.user.id);
      } else {
        await apiService.users.reactivate(confirmAction.user.id);
      }
      
      setShowConfirmDialog(false);
      setConfirmAction(null);
      fetchUsers(); // Refresh user list
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError(error.message || 'Failed to update user status');
      setShowConfirmDialog(false);
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  };

  // Get role display name and styling
  const getRoleInfo = (role) => {
    const roleMap = {
      patient: { name: 'Patient', className: 'role-patient' },
      partner: { name: 'Partner', className: 'role-partner' },
      staff: { name: 'Staff', className: 'role-staff' },
      admin: { name: 'Admin', className: 'role-admin' },
      super_admin: { name: 'Super Admin', className: 'role-super-admin' }
    };
    return roleMap[role] || { name: role, className: 'role-default' };
  };

  // Generate pagination pages
  const getPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  if (loading && users.length === 0) {
    return <LoadingSpinner fullScreen message="Loading users..." />;
  }

  return (
    <div className="user-management-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
        <span className="breadcrumb-separator">›</span>
        <span className="breadcrumb-current">User Management</span>
      </nav>

      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage user accounts, roles, and permissions</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create User
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage 
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <select
          value={roleFilter}
          onChange={handleRoleFilterChange}
          className="filter-select"
        >
          <option value="">All Roles</option>
          <option value="patient">Patient</option>
          <option value="partner">Partner</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <span>Showing {users.length} of {totalUsers} users</span>
        {(debouncedSearch || roleFilter || statusFilter) && (
          <button 
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('');
              setStatusFilter('');
            }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        {loading && <LoadingSpinner overlay />}
        
        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(rowUser => {
                const roleInfo = getRoleInfo(rowUser.role);
                return (
                  <tr key={rowUser.id}>
                    <td>
                      <div className="user-info">
                        <div className="user-details">
                          <span className="user-name">{rowUser.fullName}</span>
                          <span className="user-email">{rowUser.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${roleInfo.className}`}>
                        {roleInfo.name}
                      </span>
                    </td>
                    <td>
                      <span className="phone-number">
                        {rowUser.phoneNumber || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${rowUser.isActive ? 'active' : 'inactive'}`}>
                        {rowUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className="join-date">
                        {new Date(rowUser.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleEditUser(rowUser)}
                          className="btn btn-sm btn-secondary"
                          title={rowUser.id === authUser?.id ? 'Cannot edit your own account' : 'Edit User'}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(rowUser)}
                          className={`btn btn-sm ${rowUser.isActive ? 'btn-danger' : 'btn-success'}`}
                          title={rowUser.id === authUser?.id ? 'Cannot change your own account status' : (rowUser.isActive ? 'Deactivate User' : 'Reactivate User')}
                          disabled={rowUser.id === authUser?.id}
                        >
                          {rowUser.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {users.length === 0 && !loading && (
            <div className="no-results">
              <p>No users found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>

          <div className="pagination-pages">
            {getPaginationPages().map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        variant={confirmAction?.variant}
        onConfirm={executeConfirmAction}
        onCancel={() => {
          setShowConfirmDialog(false);
          setConfirmAction(null);
        }}
      />
    </div>
  );
};

export default UserManagement;