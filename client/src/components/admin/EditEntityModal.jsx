import { useState, useEffect } from 'react';
import { validateEmail } from '../../utils/validation';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

const ENTITY_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'insurance_company', label: 'Insurance Company' },
  { value: 'other', label: 'Other' }
];

function EditEntityModal({ isOpen, onClose, onSubmit, entity, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'hospital',
    contact_info: {
      phone: '',
      email: '',
      address: { street: '', city: '', state: '', country: '', postal_code: '' },
      contact_person: { name: '', title: '', direct_phone: '', email: '' },
      billing_contact: { name: '', email: '', phone: '' }
    }
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (entity) {
      setFormData({
        name: entity.name || '',
        type: entity.type || 'hospital',
        contact_info: {
          phone: entity.contactInfo?.phone || '',
          email: entity.contactInfo?.email || '',
          address: {
            street: entity.contactInfo?.address?.street || '',
            city: entity.contactInfo?.address?.city || '',
            state: entity.contactInfo?.address?.state || '',
            country: entity.contactInfo?.address?.country || '',
            postal_code: entity.contactInfo?.address?.postal_code || ''
          },
          contact_person: {
            name: entity.contactInfo?.contact_person?.name || '',
            title: entity.contactInfo?.contact_person?.title || '',
            direct_phone: entity.contactInfo?.contact_person?.direct_phone || '',
            email: entity.contactInfo?.contact_person?.email || ''
          },
          billing_contact: {
            name: entity.contactInfo?.billing_contact?.name || '',
            email: entity.contactInfo?.billing_contact?.email || '',
            phone: entity.contactInfo?.billing_contact?.phone || ''
          }
        }
      });
    }
  }, [entity]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleContactInfoChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contact_info: { ...prev.contact_info, [field]: value }
    }));
  };

  const handleAddressChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contact_info: {
        ...prev.contact_info,
        address: { ...prev.contact_info.address, [field]: value }
      }
    }));
  };

  const handleContactPersonChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contact_info: {
        ...prev.contact_info,
        contact_person: { ...prev.contact_info.contact_person, [field]: value }
      }
    }));
  };

  const handleBillingContactChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contact_info: {
        ...prev.contact_info,
        billing_contact: { ...prev.contact_info.billing_contact, [field]: value }
      }
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Entity name is required';
    else if (formData.name.length < 2) newErrors.name = 'Entity name must be at least 2 characters';
    else if (formData.name.length > 255) newErrors.name = 'Entity name must be less than 255 characters';
    if (!formData.type) newErrors.type = 'Entity type is required';
    if (formData.contact_info.email && !validateEmail(formData.contact_info.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (formData.contact_info.contact_person.email && !validateEmail(formData.contact_info.contact_person.email)) {
      newErrors.contactPersonEmail = 'Invalid contact person email format';
    }
    if (formData.contact_info.billing_contact.email && !validateEmail(formData.contact_info.billing_contact.email)) {
      newErrors.billingContactEmail = 'Invalid billing contact email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await onSubmit(entity.id, formData);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update entity' });
    }
  };

  if (!isOpen || !entity) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit External Entity</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <ErrorMessage message={errors.submit} />}

            <div className="form-section">
              <h3 className="section-title">Basic Information</h3>
              <div className="form-group">
                <label htmlFor="name">Entity Name <span className="required">*</span></label>
                <input type="text" id="name" name="name" value={formData.name}
                  onChange={handleInputChange} className={errors.name ? 'error' : ''}
                  placeholder="e.g., Coop Hospital Jakarta" />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="type">Entity Type <span className="required">*</span></label>
                <select id="type" name="type" value={formData.type}
                  onChange={handleInputChange} className={errors.type ? 'error' : ''}>
                  {ENTITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {errors.type && <span className="error-text">{errors.type}</span>}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Contact Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input type="tel" id="phone" value={formData.contact_info.phone}
                    onChange={(e) => handleContactInfoChange('phone', e.target.value)}
                    placeholder="+62 XXX XXX XXX" maxLength="20" />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input type="email" id="email" value={formData.contact_info.email}
                    onChange={(e) => handleContactInfoChange('email', e.target.value)}
                    className={errors.email ? 'error' : ''} placeholder="contact@example.com" />
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Address</h3>
              <div className="form-group">
                <label htmlFor="street">Street Address</label>
                <input type="text" id="street" value={formData.contact_info.address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input type="text" id="city" value={formData.contact_info.address.city}
                    onChange={(e) => handleAddressChange('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="state">State/Province</label>
                  <input type="text" id="state" value={formData.contact_info.address.state}
                    onChange={(e) => handleAddressChange('state', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input type="text" id="country" value={formData.contact_info.address.country}
                    onChange={(e) => handleAddressChange('country', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="postal_code">Postal Code</label>
                  <input type="text" id="postal_code" value={formData.contact_info.address.postal_code}
                    onChange={(e) => handleAddressChange('postal_code', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Contact Person</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contact_person_name">Name</label>
                  <input type="text" id="contact_person_name" value={formData.contact_info.contact_person.name}
                    onChange={(e) => handleContactPersonChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="contact_person_title">Title</label>
                  <input type="text" id="contact_person_title" value={formData.contact_info.contact_person.title}
                    onChange={(e) => handleContactPersonChange('title', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contact_person_phone">Direct Phone</label>
                  <input type="tel" id="contact_person_phone" value={formData.contact_info.contact_person.direct_phone}
                    onChange={(e) => handleContactPersonChange('direct_phone', e.target.value)} maxLength="20" />
                </div>
                <div className="form-group">
                  <label htmlFor="contact_person_email">Email</label>
                  <input type="email" id="contact_person_email" value={formData.contact_info.contact_person.email}
                    onChange={(e) => handleContactPersonChange('email', e.target.value)}
                    className={errors.contactPersonEmail ? 'error' : ''} />
                  {errors.contactPersonEmail && <span className="error-text">{errors.contactPersonEmail}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Billing Contact</h3>
              <div className="form-group">
                <label htmlFor="billing_contact_name">Name</label>
                <input type="text" id="billing_contact_name" value={formData.contact_info.billing_contact.name}
                  onChange={(e) => handleBillingContactChange('name', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billing_contact_email">Email</label>
                  <input type="email" id="billing_contact_email" value={formData.contact_info.billing_contact.email}
                    onChange={(e) => handleBillingContactChange('email', e.target.value)}
                    className={errors.billingContactEmail ? 'error' : ''} />
                  {errors.billingContactEmail && <span className="error-text">{errors.billingContactEmail}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="billing_contact_phone">Phone</label>
                  <input type="tel" id="billing_contact_phone" value={formData.contact_info.billing_contact.phone}
                    onChange={(e) => handleBillingContactChange('phone', e.target.value)} maxLength="20" />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <LoadingSpinner size="small" /> : 'Update Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEntityModal;
