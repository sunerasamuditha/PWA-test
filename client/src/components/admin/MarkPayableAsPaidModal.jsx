import { useState } from 'react';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

function MarkPayableAsPaidModal({ isOpen, onClose, onSubmit, payable, loading }) {
  const [formData, setFormData] = useState({
    paid_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.paid_date) {
      newErrors.paid_date = 'Paid date is required';
    } else {
      const paidDate = new Date(formData.paid_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (paidDate > today) {
        newErrors.paid_date = 'Paid date cannot be in the future';
      }
    }
    if (!formData.payment_method.trim()) {
      newErrors.payment_method = 'Payment method is required';
    } else if (formData.payment_method.length > 100) {
      newErrors.payment_method = 'Payment method must be less than 100 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await onSubmit(payable.id, formData);
      handleClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to mark as paid' });
    }
  };

  const handleClose = () => {
    setFormData({
      paid_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      notes: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen || !payable) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mark Payable as Paid</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <ErrorMessage message={errors.submit} />}

            <div className="payable-summary">
              <h3>{payable.entityName}</h3>
              <p><strong>Amount:</strong> IDR {parseFloat(payable.totalAmount).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</p>
              <p><strong>Due Date:</strong> {new Date(payable.dueDate).toLocaleDateString()}</p>
              {payable.referenceCode && <p><strong>Reference:</strong> {payable.referenceCode}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="paid_date">
                Paid Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="paid_date"
                name="paid_date"
                value={formData.paid_date}
                onChange={handleInputChange}
                className={errors.paid_date ? 'error' : ''}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.paid_date && <span className="error-text">{errors.paid_date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="payment_method">
                Payment Method <span className="required">*</span>
              </label>
              <input
                type="text"
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleInputChange}
                className={errors.payment_method ? 'error' : ''}
                placeholder="e.g., Bank Transfer, Cash, Check"
                maxLength="100"
              />
              {errors.payment_method && <span className="error-text">{errors.payment_method}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="notes">Payment Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Optional notes about this payment..."
                rows="3"
                maxLength="1000"
              />
              <small className="text-muted">{formData.notes.length}/1000 characters</small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? <LoadingSpinner size="small" /> : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MarkPayableAsPaidModal;
