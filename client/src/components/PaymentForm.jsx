import { useState } from 'react';
import { apiService } from '../services/api';
import ErrorMessage from './ErrorMessage';
import { formatCurrency, validatePrice } from '../utils/validation';

const PaymentForm = ({ invoice, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: invoice.remainingBalance?.toString() || '',
    payment_method: 'cash',
    transaction_id: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    const amountValidation = validatePrice(formData.amount, {
      label: 'Amount',
      minValue: 0.01,
      maxValue: invoice.remainingBalance
    });
    if (!amountValidation.isValid) {
      newErrors.amount = amountValidation.errors[0];
    }

    const amount = parseFloat(formData.amount);
    if (amount > invoice.remainingBalance) {
      newErrors.amount = `Amount cannot exceed remaining balance (${formatCurrency(invoice.remainingBalance)})`;
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'Payment method is required';
    }

    // Transaction ID required for card and bank transfer
    if (['card', 'bank_transfer'].includes(formData.payment_method) && !formData.transaction_id) {
      newErrors.transaction_id = 'Transaction ID is required for card and bank transfer payments';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setSubmitting(true);
    setError('');

    try {
      await apiService.payments.recordPayment({
        invoice_id: invoice.id,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        transaction_id: formData.transaction_id || undefined,
        payment_status: 'completed',
        notes: formData.notes || undefined
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to record payment');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payment-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <ErrorMessage message={error} />}

            {/* Invoice Summary */}
            <div className="payment-invoice-summary">
              <div className="summary-item">
                <label>Invoice Number:</label>
                <span>{invoice.invoiceNumber}</span>
              </div>
              <div className="summary-item">
                <label>Total Amount:</label>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="summary-item">
                <label>Paid Amount:</label>
                <span>{formatCurrency(invoice.paidAmount || 0)}</span>
              </div>
              <div className="summary-item highlight">
                <label>Remaining Balance:</label>
                <span className="amount-highlight">{formatCurrency(invoice.remainingBalance || 0)}</span>
              </div>
            </div>

            {/* Payment Form Fields */}
            <div className="form-group">
              <label htmlFor="amount">Payment Amount (IDR) *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className={errors.amount ? 'error' : ''}
                placeholder="Enter amount"
                step="0.01"
                min="0.01"
                max={invoice.remainingBalance}
              />
              {errors.amount && <span className="error-text">{errors.amount}</span>}
              <small className="helper-text">
                Maximum: {formatCurrency(invoice.remainingBalance)}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="payment_method">Payment Method *</label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className={errors.payment_method ? 'error' : ''}
              >
                <option value="cash">Cash</option>
                <option value="card">Card/Debit</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="insurance">Insurance (Direct)</option>
              </select>
              {errors.payment_method && <span className="error-text">{errors.payment_method}</span>}
            </div>

            {['card', 'bank_transfer'].includes(formData.payment_method) && (
              <div className="form-group">
                <label htmlFor="transaction_id">Transaction ID *</label>
                <input
                  type="text"
                  id="transaction_id"
                  name="transaction_id"
                  value={formData.transaction_id}
                  onChange={handleChange}
                  className={errors.transaction_id ? 'error' : ''}
                  placeholder="Enter transaction/reference ID"
                  maxLength={100}
                />
                {errors.transaction_id && <span className="error-text">{errors.transaction_id}</span>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional notes about this payment"
                rows={3}
                maxLength={500}
              />
              <small className="char-count">{formData.notes.length}/500</small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
