import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AppointmentBooking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check if user is staff/admin
  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(user?.role);
  
  const [appointmentData, setAppointmentData] = useState({
    patient_user_id: user?.id || '',
    appointment_datetime: '',
    appointment_type: 'opd'
  });
  
  // Patient search state for staff/admin
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Generate time slots (8 AM - 8 PM, 30-minute intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Fetch booked slots when date changes
  useEffect(() => {
    if (selectedDate && (selectedPatient || !isStaffOrAdmin)) {
      fetchBookedSlots(selectedDate);
    }
  }, [selectedDate, selectedPatient]);

  // Patient search for staff/admin
  const searchPatients = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setPatientSearchResults([]);
      return;
    }

    try {
      setIsSearchingPatients(true);
      const response = await apiService.users.getUsers({ role: 'patient', search: searchTerm, limit: 10 });
      
      if (response.success) {
        setPatientSearchResults(response.data);
      }
    } catch (err) {
      console.error('Error searching patients:', err);
    } finally {
      setIsSearchingPatients(false);
    }
  };

  // Debounced patient search
  useEffect(() => {
    if (!isStaffOrAdmin) return;
    
    const delayDebounce = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [patientSearch, isStaffOrAdmin]);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setAppointmentData(prev => ({
      ...prev,
      patient_user_id: patient.id
    }));
    setPatientSearch(`${patient.fullName} (${patient.email})`);
    setPatientSearchResults([]);
    setSelectedDate(null); // Reset date when changing patient
    setSelectedTime(null);
    setBookedSlots([]);
  };

  const fetchBookedSlots = async (date) => {
    try {
      setIsLoadingSlots(true);
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // For staff, check slots for the selected patient; for patients, check their own slots
      const patientId = isStaffOrAdmin && selectedPatient ? selectedPatient.id : user.id;

      const response = await apiService.appointments.getAppointments({
        patient_user_id: patientId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (response.success) {
        // Extract booked time slots
        const booked = response.data.map(apt => {
          const aptDate = new Date(apt.appointmentDatetime);
          return `${aptDate.getHours().toString().padStart(2, '0')}:${aptDate.getMinutes().toString().padStart(2, '0')}`;
        });
        setBookedSlots(booked);
      }
    } catch (err) {
      console.error('Error fetching booked slots:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setError('');
  };

  const handleTimeSelect = (time) => {
    if (bookedSlots.includes(time)) {
      return;
    }
    setSelectedTime(time);
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAppointmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // For staff/admin, ensure a patient is selected
    const patientId = isStaffOrAdmin ? selectedPatient?.id : user.id;
    
    if (isStaffOrAdmin && !patientId) {
      setError('Please select a patient before booking');
      return;
    }

    // Validation
    if (!selectedDate || !selectedTime) {
      setError('Please select both date and time for the appointment');
      return;
    }

    if (!appointmentData.appointment_type) {
      setError('Please select appointment type');
      return;
    }

    try {
      setIsSubmitting(true);

      // Combine date and time
      const [hours, minutes] = selectedTime.split(':');
      const appointmentDatetime = new Date(selectedDate);
      appointmentDatetime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const bookingData = {
        patient_user_id: patientId,
        appointment_datetime: appointmentDatetime.toISOString(),
        appointment_type: appointmentData.appointment_type,
        notes: appointmentData.notes || ''
      };

      const response = await apiService.appointments.createAppointment(bookingData);

      if (response.success) {
        setSuccess('Appointment booked successfully!');
        setTimeout(() => {
          navigate('/appointments');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  // Date picker filter: only allow future dates within 3 months
  const minDate = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 3);

  return (
    <div className="appointment-booking-container">
      <div className="page-header">
        <div className="breadcrumb">
          <a href="/dashboard">Dashboard</a> &gt; <span>Book Appointment</span>
        </div>
        <h1>Book Appointment</h1>
      </div>

      <div className="booking-form-wrapper">
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}
        {success && (
          <div className="success-message">
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form">
          {/* Patient Selection (Staff/Admin only) */}
          {isStaffOrAdmin && (
            <div className="form-section">
              <h3>Select Patient</h3>
              <div className="patient-search-container">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search patient by name or email..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  disabled={isSubmitting}
                />
                {isSearchingPatients && <div className="search-loading">Searching...</div>}
                {patientSearchResults.length > 0 && (
                  <div className="patient-search-results">
                    {patientSearchResults.map(patient => (
                      <div
                        key={patient.id}
                        className="patient-result-item"
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="patient-name">{patient.fullName}</div>
                        <div className="patient-email">{patient.email}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <div className="selected-patient-badge">
                    Selected: {selectedPatient.fullName}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date Selection */}
          {(!isStaffOrAdmin || selectedPatient) && (
            <div className="form-section">
              <h3>Select Date</h3>
              <div className="date-picker-container">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  minDate={minDate}
                  maxDate={maxDate}
                  inline
                  dateFormat="yyyy-MM-dd"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* Time Selection */}
          {selectedDate && (!isStaffOrAdmin || selectedPatient) && (
            <div className="form-section">
              <h3>Select Time</h3>
              {isLoadingSlots ? (
                <LoadingSpinner size="small" />
              ) : (
                <div className="time-slots-grid">
                  {timeSlots.map((time) => {
                    const isBooked = bookedSlots.includes(time);
                    const isSelected = selectedTime === time;
                    
                    return (
                      <button
                        key={time}
                        type="button"
                        className={`time-slot-button ${isBooked ? 'booked-slot' : 'available-slot'} ${isSelected ? 'selected-slot' : ''}`}
                        onClick={() => handleTimeSelect(time)}
                        disabled={isBooked || isSubmitting}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Appointment Type */}
          {selectedDate && selectedTime && (
            <>
              <div className="form-section">
                <h3>Appointment Type</h3>
                <div className="appointment-type-selector">
                  <label className={`type-card ${appointmentData.appointment_type === 'opd' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="appointment_type"
                      value="opd"
                      checked={appointmentData.appointment_type === 'opd'}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <div className="type-content">
                      <h4>OPD</h4>
                      <p>Outpatient Consultation</p>
                    </div>
                  </label>

                  <label className={`type-card ${appointmentData.appointment_type === 'admission' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="appointment_type"
                      value="admission"
                      checked={appointmentData.appointment_type === 'admission'}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <div className="type-content">
                      <h4>Admission</h4>
                      <p>Inpatient Admission</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default AppointmentBooking;
