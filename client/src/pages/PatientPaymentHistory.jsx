import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import InvoiceDetails from '../components/InvoiceDetails';
import { formatCurrency, getInvoiceStatusDisplayName, getInvoiceStatusBadgeClass } from '../utils/validation';

const PatientPaymentHistory = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: ''
  });
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalBilled: 0,
    totalPaid: 0,
    totalOutstanding: 0
  });

  useEffect(() => {
    if (user?.role === 'patient') {
      fetchInvoices();
    }
  }, [filters, user]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.invoices.getInvoices({
        patient_user_id: user.id,
        ...filters
      });
      
      const invoiceList = response.data.invoices || [];
      setInvoices(invoiceList);

      // Calculate stats
      const stats = {
        totalInvoices: invoiceList.length,
        totalBilled: invoiceList.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0),
        totalPaid: invoiceList.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || 0), 0),
        totalOutstanding: invoiceList.reduce((sum, inv) => sum + parseFloat(inv.remainingBalance || 0), 0)
      };
      setStats(stats);

    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (invoice) => {
    try {
      const response = await apiService.invoices.getInvoiceById(invoice.id);
      setSelectedInvoice(response.data.invoice);
      setShowDetails(true);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to fetch invoice details');
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
      link.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to download receipt');
    }
  };

  const handleExportReport = async () => {
    try {
      // Default to last 12 months if no date range specified
      const today = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(today.getFullYear() - 1);
      
      const params = {
        patient_user_id: user.id,
        startDate: filters.startDate || twelveMonthsAgo.toISOString().split('T')[0],
        endDate: filters.endDate || today.toISOString().split('T')[0]
      };

      const blob = await apiService.payments.generateReport(params);
      
      // Create object URL from blob
      const url = window.URL.createObjectURL(blob);
      
      // Generate filename with date range
      const startStr = params.startDate;
      const endStr = params.endDate;
      const filename = `payment-report-${startStr}-to-${endStr}.pdf`;
      
      // Create temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to generate report');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (user?.role !== 'patient') {
    return (
      <div className="container">
        <ErrorMessage message="This page is only accessible to patients." />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="patient-payments-container">
      <div className="page-header">
        <h1>My Payment History</h1>
        <button className="btn btn-primary" onClick={handleExportReport}>
          Export Report (PDF)
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Invoices</h3>
          <p className="stat-value">{stats.totalInvoices}</p>
        </div>
        <div className="stat-card">
          <h3>Total Billed</h3>
          <p className="stat-value">{formatCurrency(stats.totalBilled)}</p>
        </div>
        <div className="stat-card">
          <h3>Total Paid</h3>
          <p className="stat-value stat-success">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="stat-card">
          <h3>Outstanding Balance</h3>
          <p className="stat-value stat-warning">{formatCurrency(stats.totalOutstanding)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          className="filter-input"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          className="filter-input"
          placeholder="End Date"
        />

        <button
          className="btn btn-secondary"
          onClick={() => setFilters({ status: '', startDate: '', endDate: '' })}
        >
          Clear Filters
        </button>
      </div>

      {/* Invoices Table */}
      <div className="table-container">
        <table className="data-table invoice-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Type</th>
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">No invoices found</td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="invoice-number">{invoice.invoiceNumber}</td>
                  <td>{formatDate(invoice.createdAt)}</td>
                  <td>
                    <span className="type-badge">
                      {invoice.invoiceType === 'opd' ? 'OPD' : 
                       invoice.invoiceType === 'admission' ? 'Admission' : 'Running Bill'}
                    </span>
                  </td>
                  <td className="amount-cell">{formatCurrency(invoice.totalAmount)}</td>
                  <td className="amount-cell success">{formatCurrency(invoice.paidAmount || 0)}</td>
                  <td className="amount-cell warning">{formatCurrency(invoice.remainingBalance || 0)}</td>
                  <td>
                    <span className={`status-badge ${getInvoiceStatusBadgeClass(invoice.status)}`}>
                      {getInvoiceStatusDisplayName(invoice.status)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleViewDetails(invoice)}
                      >
                        View Details
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDownloadReceipt(invoice.id, invoice.invoiceNumber)}
                      >
                        Download Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Details Modal */}
      {showDetails && selectedInvoice && (
        <InvoiceDetails
          invoice={selectedInvoice}
          onClose={() => {
            setShowDetails(false);
            setSelectedInvoice(null);
          }}
          onUpdate={fetchInvoices}
          userRole={user.role}
          userPermissions={user.permissions || []}
        />
      )}
    </div>
  );
};

export default PatientPaymentHistory;
