import { useState } from 'react';
import ErrorMessage from '../ErrorMessage';
import { validatePrice } from '../../utils/validation';

const CreateServiceModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service_category: 'consultation',
    price: ''
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

    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Service name must not exceed 200 characters';
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description must not exceed 1000 characters';
    }

    if (!formData.service_category) {
      newErrors.service_category = 'Category is required';
    }

    const priceValidation = validatePrice(formData.price, {
      label: 'Price',
      minValue: 0.01,
      maxValue: 999999.99
    });
    if (!priceValidation.isValid) {
      newErrors.price = priceValidation.errors[0];
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
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        service_category: formData.service_category,
        price: parseFloat(formData.price)
      });
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to create service');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Service</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <ErrorMessage message={error} />}

            <div className="form-group">
              <label htmlFor="name">Service Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="e.g., General Consultation"
                maxLength={200}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="service_category">Category *</label>
              <select
                id="service_category"
                name="service_category"
                value={formData.service_category}
                onChange={handleChange}
                className={errors.service_category ? 'error' : ''}
              >
                <option value="consultation">Consultation</option>
                <option value="procedure">Procedure</option>
                <option value="lab_test">Lab Test</option>
                <option value="room_charge">Room Charge</option>
                <option value="service_charge">Service Charge</option>
                <option value="other">Other</option>
              </select>
              {errors.service_category && <span className="error-text">{errors.service_category}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="price">Price (IDR) *</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={errors.price ? 'error' : ''}
                placeholder="150000"
                step="0.01"
                min="0.01"
              />
              {errors.price && <span className="error-text">{errors.price}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={errors.description ? 'error' : ''}
                placeholder="Optional description of the service"
                rows={4}
                maxLength={1000}
              />
              {errors.description && <span className="error-text">{errors.description}</span>}
              <small className="char-count">{formData.description.length}/1000</small>
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
              {submitting ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServiceModal;
