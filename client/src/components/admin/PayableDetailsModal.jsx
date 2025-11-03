import { getPayableStatusDisplayName, formatCurrency } from '../../utils/validation';

function PayableDetailsModal({ isOpen, onClose, payable, onMarkAsPaid }) {
  if (!isOpen || !payable) return null;

  const getStatusBadgeClass = (status) => {
    const classMap = {
      'due': 'status-due',
      'paid': 'status-paid',
      'overdue': 'status-overdue'
    };
    return classMap[status] || 'status-default';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Payable Details</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="details-grid">
            <div className="detail-item">
              <label>Entity:</label>
              <div>
                <strong>{payable.entityName}</strong>
                <span className="entity-type-badge" style={{
                  backgroundColor: payable.entityType === 'hospital' ? '#fee2e2' : '#dbeafe',
                  color: payable.entityType === 'hospital' ? '#991b1b' : '#1e40af',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginLeft: '8px'
                }}>
                  {payable.entityType}
                </span>
              </div>
            </div>

            <div className="detail-item">
              <label>Status:</label>
              <span className={`status-badge ${getStatusBadgeClass(payable.status)}`}>
                {getPayableStatusDisplayName(payable.status)}
              </span>
            </div>

            {payable.referenceCode && (
              <div className="detail-item">
                <label>Reference Code:</label>
                <span>{payable.referenceCode}</span>
              </div>
            )}

            <div className="detail-item">
              <label>Total Amount:</label>
              <strong style={{ fontSize: '1.2rem' }}>
                {formatCurrency(payable.totalAmount)}
              </strong>
            </div>

            <div className="detail-item">
              <label>Due Date:</label>
              <span>{new Date(payable.dueDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            </div>

            {payable.paidDate && (
              <div className="detail-item">
                <label>Paid Date:</label>
                <span>{new Date(payable.paidDate).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}</span>
              </div>
            )}

            {payable.paymentMethod && (
              <div className="detail-item">
                <label>Payment Method:</label>
                <span>{payable.paymentMethod}</span>
              </div>
            )}

            {payable.description && (
              <div className="detail-item full-width">
                <label>Description:</label>
                <p>{payable.description}</p>
              </div>
            )}

            {payable.notes && (
              <div className="detail-item full-width">
                <label>Notes:</label>
                <p>{payable.notes}</p>
              </div>
            )}

            <div className="detail-item">
              <label>Created At:</label>
              <span>{new Date(payable.createdAt).toLocaleString()}</span>
            </div>

            {payable.updatedAt && (
              <div className="detail-item">
                <label>Last Updated:</label>
                <span>{new Date(payable.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {payable.status !== 'paid' && onMarkAsPaid && (
            <button 
              onClick={() => {
                onClose();
                onMarkAsPaid(payable);
              }}
              className="btn btn-success"
            >
              Mark as Paid
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

export default PayableDetailsModal;
