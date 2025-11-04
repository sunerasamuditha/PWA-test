import React from 'react';
import ReactDOM from 'react-dom';
import './ConfirmDialog.css';

/**
 * ConfirmDialog Component
 * A reusable confirmation dialog for destructive or important actions
 * 
 * @param {boolean} isOpen - Whether the dialog is visible
 * @param {function} onClose - Function to call when dialog is closed/cancelled
 * @param {function} onConfirm - Function to call when user confirms the action
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message/description
 * @param {string} confirmText - Text for the confirm button (default: "Confirm")
 * @param {string} cancelText - Text for the cancel button (default: "Cancel")
 * @param {string} variant - Dialog variant: 'danger', 'warning', 'info' (default: 'warning')
 * @param {boolean} isLoading - Whether the confirm action is in progress
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isLoading && onConfirm) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (!isLoading && onClose) {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleCancel();
    }
  };

  const dialogContent = (
    <div className="confirm-dialog-overlay" onClick={handleBackdropClick}>
      <div className={`confirm-dialog confirm-dialog--${variant}`}>
        <div className="confirm-dialog__header">
          <h3 className="confirm-dialog__title">{title}</h3>
          {!isLoading && (
            <button
              className="confirm-dialog__close"
              onClick={handleCancel}
              aria-label="Close dialog"
            >
              ×
            </button>
          )}
        </div>

        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
        </div>

        <div className="confirm-dialog__footer">
          <button
            className="confirm-dialog__button confirm-dialog__button--cancel"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-dialog__button confirm-dialog__button--confirm confirm-dialog__button--${variant}`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="confirm-dialog__spinner"></span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialogContent, document.body);
};

export default ConfirmDialog;
