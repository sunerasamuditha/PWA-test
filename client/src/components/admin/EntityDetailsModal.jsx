import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getEntityTypeDisplayName, formatAddress } from '../../utils/validation';
import LoadingSpinner from '../LoadingSpinner';

function EntityDetailsModal({ isOpen, onClose, entity, onEdit }) {
  const navigate = useNavigate();
  const [payablesSummary, setPayablesSummary] = useState(null);
  const [loadingPayables, setLoadingPayables] = useState(false);

  useEffect(() => {
    if (isOpen && entity) {
      fetchPayablesSummary();
    }
  }, [isOpen, entity]);

  const fetchPayablesSummary = async () => {
    if (!entity?.id) return;
    
    try {
      setLoadingPayables(true);
      
      // Fetch payables for this entity
      const response = await apiService.accountsPayable.getByEntity(entity.id, { limit: 1000 });
      const payables = response.data?.payables || [];
      
      // Calculate summary
      const totalCount = payables.length;
      const totalDue = payables
        .filter(p => p.status === 'due' || p.status === 'overdue')
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || 0), 0);
      const totalOverdue = payables
        .filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + parseFloat(p.totalAmount || 0), 0);
      const overdueCount = payables.filter(p => p.status === 'overdue').length;
      
      setPayablesSummary({
        totalCount,
        totalDue,
        totalOverdue,
        overdueCount
      });
    } catch (err) {
      console.error('Error fetching payables summary:', err);
      setPayablesSummary(null);
    } finally {
      setLoadingPayables(false);
    }
  };

  const handleViewPayables = () => {
    onClose();
    navigate(`/admin/accounts-payable?entity_id=${entity.id}`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!isOpen || !entity) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Entity Details</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="entity-header">
            <h3>{entity.name}</h3>
            <span className="entity-type-badge" style={{
              backgroundColor: entity.type === 'hospital' ? '#fee2e2' : '#dbeafe',
              color: entity.type === 'hospital' ? '#991b1b' : '#1e40af',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {getEntityTypeDisplayName(entity.type)}
            </span>
          </div>

          <div className="form-section">
            <h4 className="section-title">Contact Information</h4>
            <div className="details-grid">
              {entity.contactInfo?.phone && (
                <div className="detail-item">
                  <label>Phone:</label>
                  <span>{entity.contactInfo.phone}</span>
                </div>
              )}
              {entity.contactInfo?.email && (
                <div className="detail-item">
                  <label>Email:</label>
                  <a href={`mailto:${entity.contactInfo.email}`}>{entity.contactInfo.email}</a>
                </div>
              )}
            </div>
          </div>

          {entity.contactInfo?.address && Object.values(entity.contactInfo.address).some(v => v) && (
            <div className="form-section">
              <h4 className="section-title">Address</h4>
              <p>{formatAddress(entity.contactInfo.address) || 'No address provided'}</p>
            </div>
          )}

          {entity.contactInfo?.contact_person && entity.contactInfo.contact_person.name && (
            <div className="form-section">
              <h4 className="section-title">Contact Person</h4>
              <div className="details-grid">
                <div className="detail-item">
                  <label>Name:</label>
                  <span>{entity.contactInfo.contact_person.name}</span>
                </div>
                {entity.contactInfo.contact_person.title && (
                  <div className="detail-item">
                    <label>Title:</label>
                    <span>{entity.contactInfo.contact_person.title}</span>
                  </div>
                )}
                {entity.contactInfo.contact_person.direct_phone && (
                  <div className="detail-item">
                    <label>Direct Phone:</label>
                    <span>{entity.contactInfo.contact_person.direct_phone}</span>
                  </div>
                )}
                {entity.contactInfo.contact_person.email && (
                  <div className="detail-item">
                    <label>Email:</label>
                    <a href={`mailto:${entity.contactInfo.contact_person.email}`}>
                      {entity.contactInfo.contact_person.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {entity.contactInfo?.billing_contact && entity.contactInfo.billing_contact.name && (
            <div className="form-section">
              <h4 className="section-title">Billing Contact</h4>
              <div className="details-grid">
                <div className="detail-item">
                  <label>Name:</label>
                  <span>{entity.contactInfo.billing_contact.name}</span>
                </div>
                {entity.contactInfo.billing_contact.email && (
                  <div className="detail-item">
                    <label>Email:</label>
                    <a href={`mailto:${entity.contactInfo.billing_contact.email}`}>
                      {entity.contactInfo.billing_contact.email}
                    </a>
                  </div>
                )}
                {entity.contactInfo.billing_contact.phone && (
                  <div className="detail-item">
                    <label>Phone:</label>
                    <span>{entity.contactInfo.billing_contact.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="form-section">
            <h4 className="section-title">System Information</h4>
            <div className="details-grid">
              <div className="detail-item">
                <label>Created:</label>
                <span>{new Date(entity.createdAt).toLocaleString()}</span>
              </div>
              {entity.updatedAt && (
                <div className="detail-item">
                  <label>Last Updated:</label>
                  <span>{new Date(entity.updatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4 className="section-title">Related Accounts Payable</h4>
            {loadingPayables ? (
              <LoadingSpinner size="small" />
            ) : payablesSummary ? (
              <>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Total Payables:</label>
                    <span>{payablesSummary.totalCount}</span>
                  </div>
                  <div className="detail-item">
                    <label>Amount Due:</label>
                    <span style={{ fontWeight: 'bold', color: '#0066cc' }}>
                      {formatCurrency(payablesSummary.totalDue)}
                    </span>
                  </div>
                  {payablesSummary.overdueCount > 0 && (
                    <>
                      <div className="detail-item">
                        <label>Overdue Count:</label>
                        <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                          {payablesSummary.overdueCount}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Amount Overdue:</label>
                        <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                          {formatCurrency(payablesSummary.totalOverdue)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {payablesSummary.totalCount > 0 && (
                  <button 
                    onClick={handleViewPayables}
                    className="btn btn-secondary"
                    style={{ marginTop: '12px' }}
                  >
                    View All Payables for This Entity
                  </button>
                )}
              </>
            ) : (
              <p>No payables found for this entity.</p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {onEdit && (
            <button 
              onClick={() => {
                onClose();
                onEdit(entity);
              }}
              className="btn btn-primary"
            >
              Edit Entity
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

export default EntityDetailsModal;
