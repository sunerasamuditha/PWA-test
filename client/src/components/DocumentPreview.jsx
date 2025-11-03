import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const DocumentPreview = ({ isOpen, onClose, document }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (isOpen && document) {
      loadPreview();
    }
    
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, document]);

  const loadPreview = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Revoke previous URL to prevent memory leak
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const blob = await apiService.documents.viewDocument(document.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const result = await apiService.documents.downloadDocument(document.id);
      const blob = result.blob || result; // Support both new and old format
      const filename = result.filename || document.originalFilename || `document-${document.id}`;
      
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download document');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${document.originalFilename}"?`)) {
      return;
    }

    try {
      const response = await apiService.documents.deleteDocument(document.id);
      
      if (response.success) {
        alert('Document deleted successfully');
        onClose(true); // Pass true to indicate document was deleted
      } else {
        throw new Error(response.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete document');
    }
  };

  const isImage = document?.mimeType?.startsWith('image/');
  const isPDF = document?.mimeType === 'application/pdf';

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content document-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{document?.originalFilename || 'Document Preview'}</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {error && <ErrorMessage message={error} />}
          
          {isLoading ? (
            <LoadingSpinner message="Loading preview..." />
          ) : (
            <div className="preview-container">
              {isImage && previewUrl && (
                <div className="image-preview">
                  <img src={previewUrl} alt={document.originalFilename} />
                </div>
              )}

              {isPDF && previewUrl && (
                <div className="pdf-preview">
                  <iframe
                    src={previewUrl}
                    title={document.originalFilename}
                    width="100%"
                    height="600px"
                  />
                </div>
              )}

              {!isImage && !isPDF && (
                <div className="no-preview">
                  <div className="no-preview-icon">📄</div>
                  <h3>Preview Not Available</h3>
                  <p>This file type cannot be previewed in the browser.</p>
                  <p>Click the download button below to view the file.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={handleDownload} className="btn btn-primary">
            Download
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            Delete
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
