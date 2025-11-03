import React from 'react';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to perform this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default', // 'default', 'danger', 'warning', 'success'
  isLoading = false,
  children
}) => {
  
  // Handle confirm action
  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  // Handle cancel action
  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, isLoading, onClose]);

  // Get button classes based on type
  const getConfirmButtonClass = () => {
    const baseClass = 'btn';
    switch (type) {
      case 'danger':
        return `${baseClass} btn-danger`;
      case 'warning':
        return `${baseClass} btn-warning`;
      case 'success':
        return `${baseClass} btn-success`;
      default:
        return `${baseClass} btn-primary`;
    }
  };

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return '❓';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="dialog-icon-title">
            <span className="dialog-icon">{getIcon()}</span>
            <h3>{title}</h3>
          </div>
          <button 
            onClick={handleCancel}
            className="modal-close"
            disabled={isLoading}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {children ? (
            <div className="dialog-content">
              {children}
            </div>
          ) : (
            <p className="dialog-message">{message}</p>
          )}
        </div>

        <div className="modal-footer">
          <button 
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            className={getConfirmButtonClass()}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-text">
                <span className="spinner-small"></span>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Specific dialog variations for common use cases
export const DeleteConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  itemName = 'item',
  itemType = 'item',
  isLoading = false 
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Confirmation"
      confirmText="Delete"
      cancelText="Cancel"
      type="danger"
      isLoading={isLoading}
    >
      <div className="delete-confirmation">
        <p>
          Are you sure you want to delete the {itemType} <strong>{itemName}</strong>?
        </p>
        <div className="warning-text">
          <strong>Warning:</strong> This action cannot be undone.
        </div>
      </div>
    </ConfirmDialog>
  );
};

export const DeactivateConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  userName = 'user',
  isLoading = false 
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Deactivate User"
      confirmText="Deactivate"
      cancelText="Cancel"
      type="warning"
      isLoading={isLoading}
    >
      <div className="deactivate-confirmation">
        <p>
          Are you sure you want to deactivate <strong>{userName}</strong>?
        </p>
        <div className="info-text">
          The user will no longer be able to log in, but their data will be preserved. 
          You can reactivate them later if needed.
        </div>
      </div>
    </ConfirmDialog>
  );
};

export const ReactivateConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  userName = 'user',
  isLoading = false 
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Reactivate User"
      confirmText="Reactivate"
      cancelText="Cancel"
      type="success"
      isLoading={isLoading}
    >
      <div className="reactivate-confirmation">
        <p>
          Are you sure you want to reactivate <strong>{userName}</strong>?
        </p>
        <div className="info-text">
          The user will be able to log in and access the system again.
        </div>
      </div>
    </ConfirmDialog>
  );
};

export const BulkActionConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  action = 'perform action on',
  selectedCount = 0,
  itemType = 'items',
  isLoading = false,
  type = 'default'
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Bulk Action Confirmation"
      confirmText="Proceed"
      cancelText="Cancel"
      type={type}
      isLoading={isLoading}
    >
      <div className="bulk-action-confirmation">
        <p>
          Are you sure you want to <strong>{action}</strong> {selectedCount} {itemType}?
        </p>
        {type === 'danger' && (
          <div className="warning-text">
            <strong>Warning:</strong> This action cannot be undone.
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
};

export const UnsavedChangesDialog = ({ 
  isOpen, 
  onClose, 
  onDiscard, 
  onSave,
  isLoading = false 
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onDiscard}
      title="Unsaved Changes"
      confirmText="Discard Changes"
      cancelText="Continue Editing"
      type="warning"
      isLoading={isLoading}
    >
      <div className="unsaved-changes-confirmation">
        <p>You have unsaved changes. What would you like to do?</p>
        <div className="action-buttons">
          <button 
            type="button"
            onClick={onSave}
            className="btn btn-primary"
            disabled={isLoading}
          >
            Save Changes
          </button>
        </div>
      </div>
    </ConfirmDialog>
  );
};

export default ConfirmDialog;