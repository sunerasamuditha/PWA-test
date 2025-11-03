import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';

const PermissionEditor = ({ staff, isOpen, onClose, onSave }) => {
  const [permissions, setPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Available permissions (aligned with backend ALLOWED_PERMISSIONS)
  const availablePermissions = [
    {
      id: 'manage_appointments',
      label: 'Manage Appointments',
      description: 'Create, view, edit, and cancel patient appointments'
    },
    {
      id: 'process_payments',
      label: 'Process Payments',
      description: 'Handle patient payments, billing, and financial transactions'
    },
    {
      id: 'view_reports',
      label: 'View Reports',
      description: 'Access system reports and analytics dashboards'
    },
    {
      id: 'manage_documents',
      label: 'Manage Documents',
      description: 'Upload, view, and manage patient and system documents'
    },
    {
      id: 'manage_users',
      label: 'Manage Users',
      description: 'Create, edit, and manage user accounts and profiles'
    },
    {
      id: 'system_settings',
      label: 'System Settings',
      description: 'Configure system settings and administrative preferences'
    }
  ];

  // Load current permissions
  useEffect(() => {
    if (isOpen && staff) {
      loadPermissions();
    }
  }, [isOpen, staff]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Set current permissions
      const currentPermissions = staff.permissions || [];
      setSelectedPermissions(currentPermissions);

      // Set available permissions
      const allPermissions = availablePermissions.map(p => p.id);
      setPermissions(allPermissions);

    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Handle permission toggle
  const handlePermissionToggle = (permission) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission);
      } else {
        return [...prev, permission];
      }
    });
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    const allPermissionIds = availablePermissions.map(p => p.id);
    const allSelected = allPermissionIds.every(p => selectedPermissions.includes(p));
    
    setSelectedPermissions(allSelected ? [] : allPermissionIds);
  };

  // Save permissions
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await apiService.staff.updateStaffPermissions(staff.userId, selectedPermissions);

      if (response.success) {
        onSave();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update permissions');
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Check if all permissions are selected
  const isAllSelected = () => {
    const allPermissionIds = availablePermissions.map(p => p.id);
    return allPermissionIds.every(p => selectedPermissions.includes(p));
  };

  // Check if some permissions are selected (for indeterminate state)
  const isSomeSelected = () => {
    return selectedPermissions.length > 0 && !isAllSelected();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h2>Edit Permissions</h2>
          <div className="staff-info">
            <span className="staff-name">{staff.fullName}</span>
            <span className="staff-role">({staff.staffRole})</span>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {error && <ErrorMessage message={error} />}
          
          {loading ? (
            <LoadingSpinner message="Loading permissions..." />
          ) : (
            <div className="permissions-editor">
              <div className="permissions-summary">
                <div className="summary-item">
                  <span className="summary-label">Selected Permissions:</span>
                  <span className="summary-value">{selectedPermissions.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Available:</span>
                  <span className="summary-value">{permissions.length}</span>
                </div>
              </div>

              <div className="permissions-list">
                <div className="select-all-header">
                  <label className="select-all-checkbox">
                    <input
                      type="checkbox"
                      checked={isAllSelected()}
                      ref={input => {
                        if (input) {
                          input.indeterminate = isSomeSelected();
                        }
                      }}
                      onChange={handleSelectAll}
                    />
                    <span className="select-all-label">Select All Permissions</span>
                    <span className="select-all-count">
                      ({selectedPermissions.length}/{availablePermissions.length})
                    </span>
                  </label>
                </div>

                <div className="permissions-grid">
                  {availablePermissions.map(permission => (
                    <div key={permission.id} className="permission-item">
                      <label className="permission-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={() => handlePermissionToggle(permission.id)}
                        />
                        <div className="permission-details">
                          <span className="permission-name">
                            {permission.label}
                          </span>
                          <span className="permission-description">
                            {permission.description}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            onClick={onClose} 
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn btn-primary"
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionEditor;