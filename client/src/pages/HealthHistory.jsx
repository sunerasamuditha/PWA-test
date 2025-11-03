import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import HealthTimeline from '../components/HealthTimeline';
import DocumentPreview from '../components/DocumentPreview';
import AppointmentDetails from '../components/AppointmentDetails';
import InvoiceDetails from '../components/InvoiceDetails';

const HealthHistory = () => {
  // State management
  const [healthHistory, setHealthHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'all',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 20,
    hasMore: true
  });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);

  // Hooks
  const { user } = useAuth();

  // Check if user is a patient
  useEffect(() => {
    if (user && user.role !== 'patient') {
      // Redirect non-patients
      window.location.href = '/dashboard';
      return;
    }
  }, [user]);

  // Fetch health history on mount and when filters change
  useEffect(() => {
    fetchHealthHistory();
  }, [filters.startDate, filters.endDate, filters.type]);

  // Filter and search health history locally
  useEffect(() => {
    filterHealthHistory();
  }, [healthHistory, filters.search]);

  const fetchHealthHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.type !== 'all') params.type = filters.type;
      params.limit = pagination.limit;

      const response = await apiService.patients.getHealthHistory(params);
      
      if (response.success) {
        setHealthHistory(response.data.healthHistory || []);
        setPagination(prev => ({
          ...prev,
          hasMore: response.data.healthHistory.length === prev.limit
        }));
      }
    } catch (error) {
      console.error('Error fetching health history:', error);
      setError('Failed to load health history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterHealthHistory = () => {
    let filtered = [...healthHistory];

    // Apply search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filtered = filtered.filter(event => {
        const eventData = event.data;
        
        // Search in different fields based on event type
        switch (event.type) {
          case 'appointment':
            return (
              eventData.appointmentType?.toLowerCase().includes(searchTerm) ||
              eventData.notes?.toLowerCase().includes(searchTerm) ||
              eventData.status?.toLowerCase().includes(searchTerm)
            );
          case 'invoice':
            return (
              eventData.invoiceNumber?.toLowerCase().includes(searchTerm) ||
              eventData.paymentStatus?.toLowerCase().includes(searchTerm) ||
              eventData.paymentMethod?.toLowerCase().includes(searchTerm)
            );
          case 'document':
            return (
              eventData.documentType?.toLowerCase().includes(searchTerm) ||
              eventData.fileName?.toLowerCase().includes(searchTerm)
            );
          default:
            return false;
        }
      });
    }

    setFilteredHistory(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateRangePreset = (preset) => {
    const today = new Date();
    const startDate = new Date();
    
    switch (preset) {
      case 'last7days':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(today.getDate() - 30);
        break;
      case 'last3months':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case 'lastyear':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        setFilters(prev => ({
          ...prev,
          startDate: '',
          endDate: ''
        }));
        return;
    }

    setFilters(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: 'all',
      search: ''
    });
  };

  const handleEventClick = (event) => {
    // Handle appointment events
    if (event.type === 'appointment' && event.data?.id) {
      handleViewAppointment(event.data.id);
    }
    // Handle invoice events
    else if (event.type === 'invoice' && event.data?.id) {
      // Check if this is a download receipt action
      if (event.action === 'downloadReceipt') {
        handleDownloadReceipt(event.data.id, event.data.invoiceNumber);
      } else {
        // Default to viewing invoice details
        handleViewInvoice(event.data.id);
      }
    }
    // Handle document events with preview/download
    else if (event.type === 'document' && event.data?.id) {
      // Check if this is a download action
      if (event.action === 'download') {
        handleDownloadDocument(event.data.id);
      } else {
        // Default to preview
        handleViewDocument(event.data.id);
      }
    } else {
      // Handle other event types (expand details, navigate to specific page, etc.)
      console.log('Event clicked:', event);
      // This can be expanded to show modal with full details
    }
  };

  const handleViewAppointment = async (appointmentId) => {
    try {
      const response = await apiService.appointments.getAppointmentById(appointmentId);
      if (response.success) {
        setSelectedAppointment(response.data);
        setShowAppointmentDetails(true);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      setError('Failed to load appointment details');
    }
  };

  const handleAppointmentUpdate = () => {
    // Refresh health history after appointment update
    fetchHealthHistory();
    setShowAppointmentDetails(false);
    setSelectedAppointment(null);
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const response = await apiService.invoices.getInvoiceById(invoiceId);
      if (response.success) {
        setSelectedInvoice(response.data.invoice);
        setShowInvoiceDetails(true);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('Failed to load invoice details');
    }
  };

  const handleInvoiceUpdate = () => {
    // Refresh health history after invoice/payment update
    fetchHealthHistory();
    setShowInvoiceDetails(false);
    setSelectedInvoice(null);
  };

  const handleViewDocument = async (documentId) => {
    try {
      const response = await apiService.documents.getDocumentById(documentId);
      if (response.success) {
        setSelectedDocument(response.data);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      setError('Failed to load document');
    }
  };

  const handleDownloadDocument = async (documentId) => {
    try {
      // Fetch document metadata to get original filename
      const metaResponse = await apiService.documents.getDocumentById(documentId);
      if (!metaResponse.success) {
        throw new Error('Failed to fetch document metadata');
      }

      const result = await apiService.documents.downloadDocument(documentId);
      const blob = result.blob || result; // Support both new and old format
      const filename = result.filename || metaResponse.data.originalFilename || `document-${documentId}.pdf`;
      
      // Create blob link to download with original filename
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      setError(error.message || error.response?.data?.message || 'Failed to download document');
    }
  };

  const handleDownloadReceipt = async (invoiceId, invoiceNumber) => {
    try {
      const blob = await apiService.invoices.downloadReceipt(invoiceId);
      
      // Create object URL from blob
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      setError(error.message || error.response?.data?.message || 'Failed to download receipt');
    }
  };

  const exportHealthHistory = () => {
    // Placeholder for PDF export functionality (to be implemented in Phase 9)
    alert('Export functionality will be available in a future update.');
  };

  const formatEventCounts = () => {
    const counts = {
      total: filteredHistory.length,
      appointments: filteredHistory.filter(e => e.type === 'appointment').length,
      invoices: filteredHistory.filter(e => e.type === 'invoice').length,
      documents: filteredHistory.filter(e => e.type === 'document').length
    };
    return counts;
  };

  const eventCounts = formatEventCounts();

  if (isLoading) {
    return (
      <div className="health-history-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="health-history-container">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <span className="separator">›</span>
        <span className="current">Health History</span>
      </nav>

      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-text">
            <h1>Health History Timeline</h1>
            <p>View your complete medical history including appointments, invoices, and documents</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={exportHealthHistory}>
              📄 Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage message={error} onRetry={fetchHealthHistory} />
      )}

      {/* Statistics Summary */}
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-number">{eventCounts.total}</div>
          <div className="stat-label">Total Events</div>
        </div>
        <div className="stat-card appointments">
          <div className="stat-number">{eventCounts.appointments}</div>
          <div className="stat-label">Appointments</div>
        </div>
        <div className="stat-card invoices">
          <div className="stat-number">{eventCounts.invoices}</div>
          <div className="stat-label">Invoices</div>
        </div>
        <div className="stat-card documents">
          <div className="stat-number">{eventCounts.documents}</div>
          <div className="stat-label">Documents</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h3>Filters</h3>
          <button className="btn btn-link" onClick={clearFilters}>
            Clear All
          </button>
        </div>

        <div className="filters-grid">
          {/* Date Range Presets */}
          <div className="filter-group">
            <label>Quick Date Filters</label>
            <div className="date-presets">
              <button 
                className={`preset-btn ${!filters.startDate ? 'active' : ''}`}
                onClick={() => handleDateRangePreset('all')}
              >
                All Time
              </button>
              <button 
                className="preset-btn"
                onClick={() => handleDateRangePreset('last7days')}
              >
                Last 7 Days
              </button>
              <button 
                className="preset-btn"
                onClick={() => handleDateRangePreset('last30days')}
              >
                Last 30 Days
              </button>
              <button 
                className="preset-btn"
                onClick={() => handleDateRangePreset('last3months')}
              >
                Last 3 Months
              </button>
              <button 
                className="preset-btn"
                onClick={() => handleDateRangePreset('lastyear')}
              >
                Last Year
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="filter-group">
            <label>Custom Date Range</label>
            <div className="date-range">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                placeholder="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                placeholder="End Date"
              />
            </div>
          </div>

          {/* Event Type Filter */}
          <div className="filter-group">
            <label htmlFor="typeFilter">Event Type</label>
            <select
              id="typeFilter"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
            >
              <option value="all">All Events</option>
              <option value="appointment">Appointments</option>
              <option value="invoice">Invoices</option>
              <option value="document">Documents</option>
            </select>
          </div>

          {/* Search Filter */}
          <div className="filter-group">
            <label htmlFor="searchFilter">Search</label>
            <input
              type="text"
              id="searchFilter"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search in notes, numbers, types..."
            />
          </div>
        </div>
      </div>

      {/* Health History Timeline */}
      <div className="timeline-section">
        {filteredHistory.length === 0 ? (
          <div className="empty-state">
            {healthHistory.length === 0 ? (
              // No health history at all
              <div className="no-history">
                <div className="empty-icon">🏥</div>
                <h3>No Health History Yet</h3>
                <p>Your medical appointments, invoices, and documents will appear here as they are created.</p>
                <Link to="/appointments/book" className="btn btn-primary">
                  Book Your First Appointment
                </Link>
              </div>
            ) : (
              // Health history exists but filtered out
              <div className="no-results">
                <div className="empty-icon">🔍</div>
                <h3>No Results Found</h3>
                <p>No events match your current filters. Try adjusting your search criteria.</p>
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <HealthTimeline
            events={filteredHistory}
            onEventClick={handleEventClick}
            showFilters={false}
          />
        )}
      </div>

      {/* Load More Button */}
      {pagination.hasMore && filteredHistory.length > 0 && (
        <div className="load-more-section">
          <button
            className="btn btn-outline"
            onClick={() => {
              setPagination(prev => ({
                ...prev,
                limit: prev.limit + 20
              }));
              fetchHealthHistory();
            }}
          >
            Load More Events
          </button>
        </div>
      )}

      {/* Document Preview Modal */}
      {selectedDocument && (
        <DocumentPreview
          isOpen={Boolean(selectedDocument)}
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetails
          isOpen={showAppointmentDetails}
          onClose={() => {
            setShowAppointmentDetails(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onUpdate={handleAppointmentUpdate}
          userRole={user?.role}
        />
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvoiceDetails(false);
            setSelectedInvoice(null);
          }}
          onUpdate={handleInvoiceUpdate}
          userRole={user?.role}
          userPermissions={user?.permissions || []}
        />
      )}
    </div>
  );
};

export default HealthHistory;