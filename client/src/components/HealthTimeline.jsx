import React, { useState } from 'react';

const HealthTimeline = ({ events, onEventClick, showFilters = true }) => {
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  const toggleEventExpansion = (eventId) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      full: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      short: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadgeClass = (status, type) => {
    const baseClass = 'status-badge';
    
    if (type === 'appointment') {
      switch (status?.toLowerCase()) {
        case 'scheduled':
          return `${baseClass} scheduled`;
        case 'checked_in':
        case 'in_progress':
          return `${baseClass} in-progress`;
        case 'completed':
          return `${baseClass} completed`;
        case 'cancelled':
          return `${baseClass} cancelled`;
        default:
          return `${baseClass} unknown`;
      }
    } else if (type === 'invoice') {
      switch (status?.toLowerCase()) {
        case 'paid':
          return `${baseClass} paid`;
        case 'pending':
          return `${baseClass} pending`;
        case 'overdue':
          return `${baseClass} overdue`;
        case 'partially_paid':
          return `${baseClass} partially-paid`;
        default:
          return `${baseClass} unknown`;
      }
    }
    
    return baseClass;
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'appointment':
        return '🏥';
      case 'invoice':
        return '💳';
      case 'document':
        return '📄';
      default:
        return '📋';
    }
  };

  const groupEventsByMonth = (events) => {
    const grouped = {};
    
    events.forEach(event => {
      const date = new Date(event.date);
      const monthYear = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(event);
    });
    
    return grouped;
  };

  const renderAppointmentCard = (event) => {
    const { data } = event;
    const formattedDate = formatDate(event.date);
    const isExpanded = expandedEvents.has(`${event.type}-${data.id}`);

    return (
      <div className="event-card appointment-event">
        <div className="event-header" onClick={() => toggleEventExpansion(`${event.type}-${data.id}`)}>
          <div className="event-icon">
            <span>{getEventIcon('appointment')}</span>
          </div>
          <div className="event-summary">
            <div className="event-title">
              <h4>{data.appointmentType || 'Medical Appointment'}</h4>
              <span className={getStatusBadgeClass(data.status, 'appointment')}>
                {data.status || 'Unknown'}
              </span>
            </div>
            <div className="event-datetime">
              <span className="date">{formattedDate.short}</span>
              <span className="time">{formattedDate.time}</span>
            </div>
          </div>
          <div className="expand-button">
            <span className={`arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
          </div>
        </div>

        {isExpanded && (
          <div className="event-details">
            <div className="detail-row">
              <label>Appointment ID:</label>
              <span>{data.id}</span>
            </div>
            <div className="detail-row">
              <label>Type:</label>
              <span>{data.appointmentType || 'Not specified'}</span>
            </div>
            <div className="detail-row">
              <label>Status:</label>
              <span className={getStatusBadgeClass(data.status, 'appointment')}>
                {data.status || 'Unknown'}
              </span>
            </div>
            <div className="detail-row">
              <label>Date & Time:</label>
              <span>{formattedDate.full}</span>
            </div>
            {data.notes && (
              <div className="detail-row notes">
                <label>Notes:</label>
                <span>{data.notes}</span>
              </div>
            )}
            <div className="detail-row">
              <label>Created:</label>
              <span>{formatDate(data.createdAt).full}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInvoiceCard = (event) => {
    const { data } = event;
    const formattedDate = formatDate(event.date);
    const isExpanded = expandedEvents.has(`${event.type}-${data.id}`);

    return (
      <div className="event-card invoice-event">
        <div className="event-header" onClick={() => toggleEventExpansion(`${event.type}-${data.id}`)}>
          <div className="event-icon">
            <span>{getEventIcon('invoice')}</span>
          </div>
          <div className="event-summary">
            <div className="event-title">
              <h4>Invoice #{data.invoiceNumber}</h4>
              <span className={getStatusBadgeClass(data.paymentStatus, 'invoice')}>
                {data.paymentStatus || 'Unknown'}
              </span>
            </div>
            <div className="event-amount">
              <span className="amount">{formatCurrency(data.totalAmount)}</span>
              <span className="date">{formattedDate.short}</span>
            </div>
          </div>
          <div className="expand-button">
            <span className={`arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
          </div>
        </div>

        {isExpanded && (
          <div className="event-details">
            <div className="detail-row">
              <label>Invoice Number:</label>
              <span>{data.invoiceNumber}</span>
            </div>
            <div className="detail-row">
              <label>Total Amount:</label>
              <span className="amount-highlight">{formatCurrency(data.totalAmount)}</span>
            </div>
            <div className="detail-row">
              <label>Payment Status:</label>
              <span className={getStatusBadgeClass(data.paymentStatus, 'invoice')}>
                {data.paymentStatus || 'Unknown'}
              </span>
            </div>
            {data.paymentMethod && (
              <div className="detail-row">
                <label>Payment Method:</label>
                <span>{data.paymentMethod}</span>
              </div>
            )}
            {data.dueDate && (
              <div className="detail-row">
                <label>Due Date:</label>
                <span>{formatDate(data.dueDate).full}</span>
              </div>
            )}
            <div className="detail-row">
              <label>Created:</label>
              <span>{formatDate(data.createdAt).full}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-sm btn-outline">View Details</button>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  // Call parent handler with invoice for receipt download
                  onEventClick?.({ ...event, action: 'downloadReceipt' });
                }}
              >
                ⬇️ Download Receipt
              </button>
              {data.paymentStatus === 'pending' && (
                <button className="btn btn-sm btn-primary">Pay Now</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDocumentCard = (event) => {
    const { data } = event;
    const formattedDate = formatDate(event.date);
    const isExpanded = expandedEvents.has(`${event.type}-${data.id}`);

    return (
      <div className="event-card document-event">
        <div className="event-header" onClick={() => toggleEventExpansion(`${event.type}-${data.id}`)}>
          <div className="event-icon">
            <span>{getEventIcon('document')}</span>
          </div>
          <div className="event-summary">
            <div className="event-title">
              <h4>{data.fileName}</h4>
              <span className="document-type-badge">
                {data.documentType || 'Document'}
              </span>
            </div>
            <div className="event-metadata">
              <span className="file-size">{formatFileSize(data.fileSize || 0)}</span>
              <span className="date">{formattedDate.short}</span>
            </div>
          </div>
          <div className="expand-button">
            <span className={`arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
          </div>
        </div>

        {isExpanded && (
          <div className="event-details">
            <div className="detail-row">
              <label>Document ID:</label>
              <span>{data.id}</span>
            </div>
            <div className="detail-row">
              <label>File Name:</label>
              <span>{data.fileName}</span>
            </div>
            <div className="detail-row">
              <label>Document Type:</label>
              <span>{data.documentType || 'Not specified'}</span>
            </div>
            <div className="detail-row">
              <label>File Size:</label>
              <span>{formatFileSize(data.fileSize || 0)}</span>
            </div>
            <div className="detail-row">
              <label>Uploaded:</label>
              <span>{formatDate(data.uploadedAt).full}</span>
            </div>
            <div className="detail-actions">
              <button 
                className="btn btn-sm btn-outline"
                onClick={(e) => {
                  e.stopPropagation();
                  // Call parent handler with document ID for download
                  onEventClick?.({ ...event, action: 'download' });
                }}
              >
                ⬇️ Download
              </button>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  // Call parent handler with document for preview
                  onEventClick?.(event);
                }}
              >
                👁️ Preview
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEventCard = (event, index) => {
    const eventKey = `${event.type}-${event.data.id}-${index}`;
    
    return (
      <div key={eventKey} className="timeline-event" onClick={() => onEventClick?.(event)}>
        {event.type === 'appointment' && renderAppointmentCard(event)}
        {event.type === 'invoice' && renderInvoiceCard(event)}
        {event.type === 'document' && renderDocumentCard(event)}
      </div>
    );
  };

  if (!events || events.length === 0) {
    return (
      <div className="timeline-empty">
        <p>No health history events to display.</p>
      </div>
    );
  }

  const groupedEvents = groupEventsByMonth(events);

  return (
    <div className="health-timeline">
      <div className="timeline-container">
        <div className="timeline-line"></div>
        
        {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
          <div key={monthYear} className="timeline-month">
            <div className="month-header">
              <h3>{monthYear}</h3>
              <span className="event-count">{monthEvents.length} events</span>
            </div>
            
            <div className="month-events">
              {monthEvents.map((event, index) => renderEventCard(event, index))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthTimeline;