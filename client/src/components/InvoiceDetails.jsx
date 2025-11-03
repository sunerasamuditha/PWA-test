import { useState } from 'react';
import { apiService } from '../services/api';
import ErrorMessage from './ErrorMessage';
import PaymentForm from './PaymentForm';
import { 
  formatCurrency, 
  getInvoiceStatusDisplayName, 
  getInvoiceStatusBadgeClass,
  getPaymentMethodDisplayName,
  canRecordPayment 
} from '../utils/validation';

const InvoiceDetails = ({ invoice, onClose, onUpdate, userRole, userPermissions }) => {
  const [error, setError] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const handleDownloadReceipt = async () => {
    try {
      const blob = await apiService.invoices.downloadReceipt(invoice.id);
      
      // Create object URL from blob
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to download receipt');
    }
  };

  const handlePaymentRecorded = () => {
    setShowPaymentForm(false);
    if (onUpdate) {
      onUpdate();
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

  const canRecordNewPayment = canRecordPayment(invoice, userRole, userPermissions);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large invoice-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invoice Details</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <ErrorMessage message={error} />}

          {/* Invoice Header Info */}
          <div className="invoice-header-info">
            <div className="info-row">
              <div className="info-item">
                <label>Invoice Number:</label>
                <span className="invoice-number-display">{invoice.invoiceNumber}</span>
              </div>
              <div className="info-item">
                <label>Status:</label>
                <span className={`status-badge ${getInvoiceStatusBadgeClass(invoice.status)}`}>
                  {getInvoiceStatusDisplayName(invoice.status)}
                </span>
              </div>
            </div>

            <div className="info-row">
              <div className="info-item">
                <label>Patient:</label>
                <span>{invoice.patientFirstName} {invoice.patientLastName}</span>
              </div>
              <div className="info-item">
                <label>Invoice Date:</label>
                <span>{formatDate(invoice.createdAt)}</span>
              </div>
            </div>

            <div className="info-row">
              <div className="info-item">
                <label>Type:</label>
                <span className="type-badge">
                  {invoice.invoiceType === 'opd' ? 'OPD' : 
                   invoice.invoiceType === 'admission' ? 'Admission' : 'Running Bill'}
                </span>
              </div>
              <div className="info-item">
                <label>Payment Method:</label>
                <span>{getPaymentMethodDisplayName(invoice.paymentMethod)}</span>
              </div>
            </div>

            {invoice.dueDate && (
              <div className="info-row">
                <div className="info-item">
                  <label>Due Date:</label>
                  <span>{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="invoice-items-section">
            <h3>Line Items</h3>
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items && invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.itemDescription}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="3"><strong>Total Amount:</strong></td>
                  <td><strong>{formatCurrency(invoice.totalAmount)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payments Section */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="payments-section">
              <h3>Payment History</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((payment, index) => (
                    <tr key={index}>
                      <td>{formatDate(payment.paidAt)}</td>
                      <td>{getPaymentMethodDisplayName(payment.paymentMethod)}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>
                        <span className={`status-badge ${payment.paymentStatus === 'completed' ? 'status-paid' : 'status-pending'}`}>
                          {payment.paymentStatus}
                        </span>
                      </td>
                      <td>{payment.staffName || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment Summary */}
          <div className="payment-summary">
            <div className="summary-row">
              <span>Total Amount:</span>
              <span className="amount">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="summary-row">
              <span>Amount Paid:</span>
              <span className="amount success">{formatCurrency(invoice.paidAmount || 0)}</span>
            </div>
            <div className="summary-row total">
              <span><strong>Remaining Balance:</strong></span>
              <span className={`amount ${invoice.remainingBalance > 0 ? 'warning' : 'success'}`}>
                <strong>{formatCurrency(invoice.remainingBalance || 0)}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleDownloadReceipt}
          >
            Download Receipt
          </button>
          
          {canRecordNewPayment && (
            <button
              className="btn btn-primary"
              onClick={() => setShowPaymentForm(true)}
            >
              Record Payment
            </button>
          )}
          
          <button
            className="btn btn-outline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <PaymentForm
          invoice={invoice}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={handlePaymentRecorded}
        />
      )}
    </div>
  );
};

export default InvoiceDetails;
