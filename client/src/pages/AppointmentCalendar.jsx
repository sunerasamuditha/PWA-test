import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import AppointmentDetails from '../components/AppointmentDetails';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const AppointmentCalendar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [appointments, setAppointments] = useState([]);
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(user?.role);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, view]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date range based on view
      const startDate = getViewStartDate();
      const endDate = getViewEndDate();

      const params = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };

      if (user.role === 'patient') {
        params.patient_user_id = user.id;
      }

      const response = await apiService.appointments.getAppointments(params);

      if (response.success) {
        setAppointments(response.data);
        transformToEvents(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const getViewStartDate = () => {
    const start = new Date(selectedDate);
    if (view === 'month') {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay());
    } else if (view === 'week') {
      start.setDate(start.getDate() - start.getDay());
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getViewEndDate = () => {
    const end = new Date(selectedDate);
    if (view === 'month') {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setDate(end.getDate() + (6 - end.getDay()));
    } else if (view === 'week') {
      end.setDate(end.getDate() + (6 - end.getDay()));
    }
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const transformToEvents = (appointmentsData) => {
    const calendarEvents = appointmentsData.map(apt => {
      const start = new Date(apt.appointmentDatetime);
      const end = new Date(start.getTime() + 30 * 60000); // Add 30 minutes

      const title = isStaffOrAdmin
        ? `${apt.patientName} - ${apt.appointmentType.toUpperCase()}`
        : apt.appointmentType.toUpperCase();

      return {
        id: apt.id,
        title,
        start,
        end,
        resource: apt // Store full appointment data
      };
    });

    setEvents(calendarEvents);
  };

  const eventStyleGetter = (event) => {
    const appointment = event.resource;
    let backgroundColor = '#3b82f6'; // Default blue for scheduled

    switch (appointment.status) {
      case 'scheduled':
        backgroundColor = '#3b82f6'; // Blue
        break;
      case 'checked_in':
        backgroundColor = '#eab308'; // Yellow
        break;
      case 'completed':
        backgroundColor = '#22c55e'; // Green
        break;
      case 'cancelled':
        backgroundColor = '#ef4444'; // Red
        break;
      default:
        backgroundColor = '#6b7280'; // Gray
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const handleSelectEvent = (event) => {
    setSelectedAppointment(event.resource);
    setShowDetailsModal(true);
  };

  const handleNavigate = (date) => {
    setSelectedDate(date);
  };

  const handleViewChange = (newView) => {
    setView(newView);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="appointment-calendar-container">
      <div className="page-header">
        <h1>Appointment Calendar</h1>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={handleTodayClick}
          >
            Today
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate('/appointments/book')}
          >
            + Book Appointment
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onClose={() => setError('')} />}

      {/* Calendar Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
          <span>Scheduled</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#eab308' }}></span>
          <span>Checked In</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
          <span>Completed</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
          <span>Cancelled</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="calendar-container">
        {isLoading ? (
          <div className="calendar-loading">
            <LoadingSpinner />
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={view}
            onView={handleViewChange}
            date={selectedDate}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            step={30}
            timeslots={2}
            min={new Date(2024, 0, 1, 8, 0)} // 8 AM
            max={new Date(2024, 0, 1, 20, 0)} // 8 PM
            toolbar={true}
          />
        )}
      </div>

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetails
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onUpdate={fetchAppointments}
          userRole={user.role}
        />
      )}
    </div>
  );
};

export default AppointmentCalendar;
