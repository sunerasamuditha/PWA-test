import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { formatFileSize } from '../utils/validation';

const DocumentGallery = ({ patientUserId, showFilters = true, onDocumentClick, refreshKey }) => {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  useEffect(() => {
    fetchDocuments();
  }, [patientUserId, pagination.page, filters.type, filters.search, filters.startDate, filters.endDate, refreshKey]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        patient_user_id: patientUserId,
        page: pagination.page,
        limit: pagination.limit
      };

      if (filters.type) params.type = filters.type;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await apiService.documents.getDocuments(params);

      if (response.success) {
        setDocuments(response.data.documents || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch documents');
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError(err.message || 'Failed to load documents');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Keep client-side filtering as secondary filter for immediate feedback
  const filteredDocuments = documents;

  const handleDownload = async (document) => {
    try {
      const result = await apiService.documents.downloadDocument(document.id);
      const blob = result.blob || result; // Support both new and old format
      const filename = result.filename || document.originalFilename || `document-${document.id}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download document');
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Are you sure you want to delete "${document.originalFilename}"?`)) {
      return;
    }

    try {
      const response = await apiService.documents.deleteDocument(document.id);
      
      if (response.success) {
        alert('Document deleted successfully');
        fetchDocuments();
      } else {
        throw new Error(response.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete document');
    }
  };

  const handleView = (document) => {
    if (onDocumentClick) {
      onDocumentClick(document);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDocumentIcon = (type) => {
    const icons = {
      passport: '🛂',
      insurance_card: '💳',
      test_result: '🧪',
      diagnosis_card: '📋',
      lab_report: '🔬',
      invoice: '💰',
      instruction_card: '📝',
      insurance_agreement: '📄',
      other: '📎'
    };
    return icons[type] || '📄';
  };

  const formatDocumentType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  return (
    <div className="document-gallery">
      {showFilters && (
        <div className="document-filters">
          <div className="filter-group">
            <label htmlFor="typeFilter">Document Type</label>
            <select
              id="typeFilter"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="passport">Passport</option>
              <option value="insurance_card">Insurance Card</option>
              <option value="test_result">Test Result</option>
              <option value="diagnosis_card">Diagnosis Card</option>
              <option value="lab_report">Lab Report</option>
              <option value="invoice">Invoice</option>
              <option value="instruction_card">Instruction Card</option>
              <option value="insurance_agreement">Insurance Agreement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="searchFilter">Search</label>
            <input
              type="text"
              id="searchFilter"
              placeholder="Search by filename..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="startDate">From Date</label>
            <input
              type="date"
              id="startDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="endDate">To Date</label>
            <input
              type="date"
              id="endDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="filter-input"
            />
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h3>No Documents Found</h3>
          <p>
            {filters.search || filters.type || filters.startDate || filters.endDate
              ? 'Try adjusting your filters'
              : 'Upload your first document to get started'}
          </p>
        </div>
      ) : (
        <>
          <div className="document-grid">
            {filteredDocuments.map((document) => (
              <div key={document.id} className="document-card">
                <div className="document-icon">
                  {getDocumentIcon(document.type)}
                </div>
                <div className="document-info">
                  <h4 className="document-filename" title={document.originalFilename}>
                    {document.originalFilename}
                  </h4>
                  <p className="document-type">{formatDocumentType(document.type)}</p>
                  <p className="document-meta">
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span> • </span>
                    <span>{formatDate(document.uploadedAt)}</span>
                  </p>
                  {document.uploaderName && (
                    <p className="document-uploader">
                      Uploaded by: {document.uploaderName}
                    </p>
                  )}
                </div>
                <div className="document-actions">
                  <button
                    onClick={() => handleView(document)}
                    className="btn-icon"
                    title="View"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => handleDownload(document)}
                    className="btn-icon"
                    title="Download"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => handleDelete(document)}
                    className="btn-icon btn-danger"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DocumentGallery;
