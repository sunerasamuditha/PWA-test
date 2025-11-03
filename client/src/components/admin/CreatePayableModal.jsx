import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

function CreatePayableModal({ isOpen, onClose, onSubmit, loading }) {
  const [entities, setEntities] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [formData, setFormData] = useState({
    entity_id: '',
    reference_code: '',
    description: '',
    total_amount: '',
    due_date: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchEntities();
    }
  }, [isOpen]);

  const fetchEntities = async () => {
    try {
      setLoadingEntities(true);
      const response = await apiService.externalEntities.list({ limit: 100 });
      setEntities(response.data.entities || []);
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    } finally {
      setLoadingEntities(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.entity_id) newErrors.entity_id = 'Entity is required';
    if (!formData.total_amount) {
      newErrors.total_amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.total_amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.total_amount = 'Amount must be greater than zero';
      } else if (amount > 9999999.99) {
        newErrors.total_amount = 'Amount cannot exceed 9,999,999.99';
      }
    }
    if (!formData.due_date) newErrors.due_date = 'Due date is required';
    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const submitData = {
        ...formData,
        entity_id: parseInt(formData.entity_id),
        total_amount: parseFloat(formData.total_amount)
      };
      await onSubmit(submitData);
      handleClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create payable' });
    }
  };

  const handleClose = () => {
    setFormData({
      entity_id: '',
      reference_code: '',
      description: '',
      total_amount: '',
      due_date: '',
      notes: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Payable</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <ErrorMessage message={errors.submit} />}

            <div className="form-group">
              <label htmlFor="entity_id">
                Entity <span className="required">*</span>
              </label>
              {loadingEntities ? (
                <p className="text-muted">Loading entities...</p>
              ) : (
                <select
                  id="entity_id"
                  name="entity_id"
                  value={formData.entity_id}
                  onChange={handleInputChange}
                  className={errors.entity_id ? 'error' : ''}
                >
                  <option value="">Select an entity</option>
                  {entities.map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({entity.type})
                    </option>
                  ))}
                </select>
              )}
              {errors.entity_id && <span className="error-text">{errors.entity_id}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="reference_code">Reference Code</label>
              <input
                type="text"
                id="reference_code"
                name="reference_code"
                value={formData.reference_code}
                onChange={handleInputChange}
                placeholder="e.g., INV-2024-001"
                maxLength="100"
              />
              <small className="text-muted">Optional invoice or reference number</small>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={errors.description ? 'error' : ''}
                placeholder="Describe the payable..."
                rows="3"
                maxLength="1000"
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
              <small className="text-muted">{formData.description.length}/1000 characters</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="total_amount">
                  Amount (IDR) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="total_amount"
                  name="total_amount"
                  value={formData.total_amount}
                  onChange={handleInputChange}
                  className={errors.total_amount ? 'error' : ''}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  max="9999999.99"
                />
                {errors.total_amount && <span className="error-text">{errors.total_amount}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="due_date">
                  Due Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleInputChange}
                  className={errors.due_date ? 'error' : ''}
                />
                {errors.due_date && <span className="error-text">{errors.due_date}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Additional notes..."
                rows="2"
                maxLength="1000"
              />
              <small className="text-muted">Optional internal notes</small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || loadingEntities}>
              {loading ? <LoadingSpinner size="small" /> : 'Create Payable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePayableModal;
