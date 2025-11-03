import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { 
  validateDocumentFile, 
  formatFileSize, 
  getFileIcon,
  isImageFile 
} from '../utils/validation';

const DocumentUpload = ({ patientUserId, onUploadSuccess, allowedTypes = null }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('passport');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Server-provided config
  const [config, setConfig] = useState({
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
    maxFileSizeMB: 10,
    isLoaded: false
  });

  const documentTypes = [
    { value: 'passport', label: 'Passport' },
    { value: 'insurance_card', label: 'Insurance Card' },
    { value: 'test_result', label: 'Test Result' },
    { value: 'diagnosis_card', label: 'Diagnosis Card' },
    { value: 'lab_report', label: 'Lab Report' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'instruction_card', label: 'Instruction Card' },
    { value: 'insurance_agreement', label: 'Insurance Agreement' },
    { value: 'other', label: 'Other' }
  ];

  // Fetch server config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiService.documents.getConfig();
        if (response.success && response.data) {
          setConfig({
            allowedMimeTypes: response.data.allowedMimeTypes || config.allowedMimeTypes,
            allowedExtensions: response.data.allowedExtensions || config.allowedExtensions,
            maxFileSizeMB: response.data.maxFileSizeMB || config.maxFileSizeMB,
            isLoaded: true
          });
        }
      } catch (err) {
        console.warn('Failed to fetch document config, using defaults:', err);
        // Keep default config as fallback
        setConfig(prev => ({ ...prev, isLoaded: true }));
      }
    };

    fetchConfig();
  }, []);

  // Sync documentType with allowedTypes when it changes
  useEffect(() => {
    if (allowedTypes && allowedTypes.length > 0) {
      setDocumentType(allowedTypes[0]);
    }
  }, [allowedTypes]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect({ target: { files } });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    // Validate file using utility functions with server config
    const validation = validateDocumentFile(file, {
      maxSizeInMB: config.maxFileSizeMB,
      allowedTypes: config.allowedMimeTypes
    });

    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setSelectedFile(file);

    // Generate preview for images using utility function
    if (isImageFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    if (!patientUserId) {
      setError('Patient user ID is required');
      return;
    }

    // Guard: ensure selected documentType is in allowedTypes when provided
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(documentType)) {
      setError(`Invalid document type. Please select one of: ${allowedTypes.join(', ')}`);
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      // IMPORTANT: Append fields BEFORE file so Multer can access them in storage destination logic
      formData.append('patient_user_id', patientUserId);
      formData.append('type', documentType);
      formData.append('document', selectedFile);

      const response = await apiService.documents.uploadDocument(formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      if (response.success) {
        setMessage('Document uploaded successfully!');
        setSelectedFile(null);
        setPreviewUrl(null);
        setUploadProgress(0);
        
        // Call success callback
        if (onUploadSuccess) {
          onUploadSuccess(response.data);
        }

        // Clear form after 2 seconds
        setTimeout(() => {
          setMessage(null);
        }, 2000);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document. Please try again.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setMessage(null);
    setUploadProgress(0);
  };

  return (
    <div className="document-upload">
      <form onSubmit={handleUpload}>
        {/* Document Type Selection */}
        <div className="form-group">
          <label htmlFor="documentType">Document Type *</label>
          <select
            id="documentType"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="form-control"
            disabled={isUploading}
          >
            {documentTypes
              .filter(type => !allowedTypes || allowedTypes.includes(type.value))
              .map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
          </select>
        </div>

        {/* Drag and Drop Zone */}
        <div
          className={`drag-drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <>
              <div className="upload-icon">📤</div>
              <p className="upload-text">
                Drag and drop your file here or
              </p>
              <label htmlFor="fileInput" className="btn btn-secondary">
                Browse Files
              </label>
              <input
                type="file"
                id="fileInput"
                onChange={handleFileSelect}
                accept={config.allowedExtensions.join(',')}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
              <p className="upload-hint">
                Supported formats: {config.allowedExtensions.join(', ').toUpperCase()} (Max {config.maxFileSizeMB}MB)
              </p>
            </>
          ) : (
            <div className="file-preview">
              {previewUrl ? (
                <div className="image-preview">
                  <img src={previewUrl} alt="Preview" />
                </div>
              ) : (
                <div className="file-icon-preview">
                  <span className="file-icon">{getFileIcon(selectedFile)}</span>
                </div>
              )}
              <div className="file-info">
                <p className="file-name">{selectedFile.name}</p>
                <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                <p className="file-type">{selectedFile.type}</p>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-remove"
                  title="Remove file"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upload Progress Bar */}
        {isUploading && uploadProgress > 0 && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        {/* Error and Success Messages */}
        {error && <ErrorMessage message={error} />}
        {message && (
          <div className="success-message">
            ✓ {message}
          </div>
        )}

        {/* Upload Button */}
        {selectedFile && (
          <div className="upload-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <LoadingSpinner size="small" /> Uploading...
                </>
              ) : (
                'Upload Document'
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default DocumentUpload;
