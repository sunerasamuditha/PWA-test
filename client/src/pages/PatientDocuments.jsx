import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import DocumentGallery from '../components/DocumentGallery';
import DocumentUpload from '../components/DocumentUpload';
import DocumentPreview from '../components/DocumentPreview';
import LoadingSpinner from '../components/LoadingSpinner';

const PatientDocuments = () => {
  const { user } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await apiService.documents.getDocumentStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    fetchStats();
    setRefreshKey(prev => prev + 1);
  };

  const handleDocumentClick = (document) => {
    setSelectedDocument(document);
    setShowPreviewModal(true);
  };

  const handlePreviewClose = (documentDeleted) => {
    setShowPreviewModal(false);
    setSelectedDocument(null);
    if (documentDeleted) {
      fetchStats();
      setRefreshKey(prev => prev + 1);
    }
  };

  if (!user || user.role !== 'patient') {
    return <div className="page"><p>Access denied. Patients only.</p></div>;
  }

  return (
    <div className="page patient-documents-page">
      <div className="page-header">
        <div>
          <h1>My Documents</h1>
          <p>Manage your medical documents, test results, and insurance information</p>
        </div>
        <button onClick={() => setShowUploadModal(true)} className="btn btn-primary">
          Upload Document
        </button>
      </div>

      {/* Document Statistics */}
      {isLoadingStats ? (
        <LoadingSpinner size="small" />
      ) : stats && (
        <div className="document-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Documents</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛂</div>
            <div className="stat-value">{stats.byType?.passport || 0}</div>
            <div className="stat-label">Passport</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💳</div>
            <div className="stat-value">{stats.byType?.insurance_card || 0}</div>
            <div className="stat-label">Insurance</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧪</div>
            <div className="stat-value">{stats.byType?.test_result || 0}</div>
            <div className="stat-label">Test Results</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔬</div>
            <div className="stat-value">{stats.byType?.lab_report || 0}</div>
            <div className="stat-label">Lab Reports</div>
          </div>
        </div>
      )}

      {/* Document Gallery */}
      <DocumentGallery
        patientUserId={user.id}
        showFilters={true}
        onDocumentClick={handleDocumentClick}
        refreshKey={refreshKey}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <DocumentUpload
                patientUserId={user.id}
                onUploadSuccess={handleUploadSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedDocument && (
        <DocumentPreview
          isOpen={showPreviewModal}
          onClose={handlePreviewClose}
          document={selectedDocument}
        />
      )}
    </div>
  );
};

export default PatientDocuments;
