import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { formatCurrency, calculateLineTotal } from '../utils/validation';

const InvoiceCreation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [invoiceData, setInvoiceData] = useState({
    patient_user_id: '',
    appointment_id: '',
    invoice_type: 'opd',
    payment_method: 'cash',
    due_date: '',
    items: []
  });

  const [currentItem, setCurrentItem] = useState({
    service_id: '',
    item_description: '',
    quantity: 1,
    unit_price: ''
  });

  // Check permissions
  const hasPermission = user?.role === 'admin' || user?.role === 'super_admin' || 
                        (user?.role === 'staff' && user?.permissions?.includes('process_payments'));

  useEffect(() => {
    if (!hasPermission) {
      navigate('/unauthorized');
      return;
    }
    fetchPatients();
    fetchServices();
  }, [hasPermission, navigate]);

  useEffect(() => {
    if (invoiceData.patient_user_id) {
      fetchPatientAppointments(invoiceData.patient_user_id);
    }
  }, [invoiceData.patient_user_id]);

  const fetchPatients = async () => {
    try {
      const response = await apiService.patients.searchPatients('');
      setPatients(response.data || []);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await apiService.services.getActiveServices();
      setServices(response.data.services || []);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  const fetchPatientAppointments = async (patientId) => {
    try {
      const response = await apiService.appointments.getAppointments({ 
        patient_user_id: patientId,
        status: 'completed'
      });
      setAppointments(response.data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  const handleServiceSelect = (e) => {
    const serviceId = parseInt(e.target.value);
    const service = services.find(s => s.id === serviceId);
    
    if (service) {
      setCurrentItem({
        service_id: serviceId,
        item_description: service.name,
        quantity: 1,
        unit_price: service.price.toString()
      });
    } else {
      setCurrentItem({
        service_id: '',
        item_description: '',
        quantity: 1,
        unit_price: ''
      });
    }
  };

  const handleAddItem = () => {
    if (!currentItem.item_description || !currentItem.unit_price || currentItem.quantity < 1) {
      setError('Please fill in all item fields');
      return;
    }

    const newItem = {
      service_id: currentItem.service_id || undefined,
      item_description: currentItem.item_description,
      quantity: parseInt(currentItem.quantity),
      unit_price: parseFloat(currentItem.unit_price)
    };

    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setCurrentItem({
      service_id: '',
      item_description: '',
      quantity: 1,
      unit_price: ''
    });
    setError('');
  };

  const handleRemoveItem = (index) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return invoiceData.items.reduce((sum, item) => {
      return sum + calculateLineTotal(item.quantity, item.unit_price);
    }, 0);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!invoiceData.patient_user_id) {
        setError('Please select a patient');
        return;
      }
    } else if (step === 2) {
      if (!invoiceData.invoice_type || !invoiceData.payment_method) {
        setError('Please fill in all required fields');
        return;
      }
      if (invoiceData.payment_method === 'insurance_credit' && !invoiceData.due_date) {
        setError('Due date is required for insurance credit payment method');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (invoiceData.items.length === 0) {
      setError('Please add at least one item to the invoice');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.invoices.createInvoice({
        patient_user_id: parseInt(invoiceData.patient_user_id),
        appointment_id: invoiceData.appointment_id ? parseInt(invoiceData.appointment_id) : undefined,
        invoice_type: invoiceData.invoice_type,
        payment_method: invoiceData.payment_method,
        due_date: invoiceData.due_date || undefined,
        items: invoiceData.items
      });

      const createdId = response.data.invoice.id;
      const invoiceNumber = response.data.invoice.invoiceNumber;
      
      // Role-based navigation to prevent unauthorized access
      if (user?.role === 'patient') {
        // Patients can view their payment history
        alert(`Invoice ${invoiceNumber} created successfully!`);
        navigate('/patient/payments');
      } else {
        // Staff/admin: navigate to dashboard with success message
        // TODO: When staff/admin invoice details page is implemented, navigate to `/invoices/${createdId}` instead
        alert(`Invoice ${invoiceNumber} created successfully! You can view it from the Billing section.`);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="invoice-creation-container">
      <div className="page-header">
        <h1>Create Invoice</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Progress Steps */}
      <div className="steps-indicator">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Patient Selection</div>
        </div>
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Invoice Details</div>
        </div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Line Items</div>
        </div>
      </div>

      {/* Step 1: Patient Selection */}
      {step === 1 && (
        <div className="step-content">
          <h2>Select Patient</h2>
          <div className="form-group">
            <label htmlFor="patient">Patient *</label>
            <select
              id="patient"
              value={invoiceData.patient_user_id}
              onChange={(e) => setInvoiceData({ ...invoiceData, patient_user_id: e.target.value })}
              className="form-select"
            >
              <option value="">-- Select Patient --</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName} ({patient.email})
                </option>
              ))}
            </select>
          </div>

          {invoiceData.patient_user_id && appointments.length > 0 && (
            <div className="form-group">
              <label htmlFor="appointment">Link to Appointment (Optional)</label>
              <select
                id="appointment"
                value={invoiceData.appointment_id}
                onChange={(e) => setInvoiceData({ ...invoiceData, appointment_id: e.target.value })}
                className="form-select"
              >
                <option value="">-- No Appointment --</option>
                {appointments.map(appointment => (
                  <option key={appointment.id} value={appointment.id}>
                    {new Date(appointment.appointmentDatetime).toLocaleDateString()} - {appointment.appointmentType}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="step-actions">
            <button className="btn btn-primary" onClick={handleNextStep}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Invoice Details */}
      {step === 2 && (
        <div className="step-content">
          <h2>Invoice Details</h2>
          
          <div className="form-group">
            <label htmlFor="invoice_type">Invoice Type *</label>
            <select
              id="invoice_type"
              value={invoiceData.invoice_type}
              onChange={(e) => setInvoiceData({ ...invoiceData, invoice_type: e.target.value })}
              className="form-select"
            >
              <option value="opd">OPD - Outpatient</option>
              <option value="admission">Admission - Inpatient</option>
              <option value="running_bill">Running Bill</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="payment_method">Payment Method *</label>
            <select
              id="payment_method"
              value={invoiceData.payment_method}
              onChange={(e) => setInvoiceData({ ...invoiceData, payment_method: e.target.value })}
              className="form-select"
            >
              <option value="cash">Cash</option>
              <option value="card">Card/Debit</option>
              <option value="insurance_credit">Insurance (Credit)</option>
            </select>
          </div>

          {invoiceData.payment_method === 'insurance_credit' && (
            <div className="form-group">
              <label htmlFor="due_date">Due Date *</label>
              <input
                type="date"
                id="due_date"
                value={invoiceData.due_date}
                onChange={(e) => setInvoiceData({ ...invoiceData, due_date: e.target.value })}
                className="form-input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={handlePrevStep}>
              Previous
            </button>
            <button className="btn btn-primary" onClick={handleNextStep}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Line Items */}
      {step === 3 && (
        <div className="step-content">
          <h2>Add Line Items</h2>

          {/* Add Item Form */}
          <div className="add-item-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="service">Select Service (Optional)</label>
                <select
                  id="service"
                  value={currentItem.service_id}
                  onChange={handleServiceSelect}
                  className="form-select"
                >
                  <option value="">-- Custom Item --</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatCurrency(service.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="item_description">Description *</label>
                <input
                  type="text"
                  id="item_description"
                  value={currentItem.item_description}
                  onChange={(e) => setCurrentItem({ ...currentItem, item_description: e.target.value })}
                  className="form-input"
                  placeholder="Item description"
                />
              </div>

              <div className="form-group">
                <label htmlFor="quantity">Quantity *</label>
                <input
                  type="number"
                  id="quantity"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                  className="form-input"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="unit_price">Unit Price (IDR) *</label>
                <input
                  type="number"
                  id="unit_price"
                  value={currentItem.unit_price}
                  onChange={(e) => setCurrentItem({ ...currentItem, unit_price: e.target.value })}
                  className="form-input"
                  step="0.01"
                  min="0.01"
                />
              </div>

              <div className="form-group">
                <button type="button" className="btn btn-success" onClick={handleAddItem}>
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {invoiceData.items.length > 0 ? (
            <div className="items-table-container">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.item_description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>{formatCurrency(calculateLineTotal(item.quantity, item.unit_price))}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveItem(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="3"><strong>Total Amount:</strong></td>
                    <td><strong>{formatCurrency(calculateTotal())}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="no-items">No items added yet. Add at least one item to continue.</p>
          )}

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={handlePrevStep}>
              Previous
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={invoiceData.items.length === 0}
            >
              Create Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreation;
