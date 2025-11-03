const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { utcToZonedTime } = require('date-fns-tz');

/**
 * AppointmentService
 * Business logic for appointment management
 */
class AppointmentService {
  /**
   * Create a new appointment
   * @param {Object} appointmentData - Appointment data
   * @param {number} createdBy - User ID of the creator
   * @returns {Promise<Object>} Created appointment
   */
  static async createAppointment(appointmentData, createdBy) {
    const { patient_user_id, appointment_datetime, appointment_type, notes } = appointmentData;

    // Validate patient exists
    const patient = await User.findById(patient_user_id);
    if (!patient) {
      throw new AppError(404, 'Patient not found');
    }

    // Validate patient role
    if (patient.role !== 'patient') {
      throw new AppError(400, 'The specified user is not a patient');
    }

    // Validate appointment datetime is in future
    const appointmentDate = new Date(appointment_datetime);
    if (appointmentDate <= new Date()) {
      throw new AppError(400, 'Appointment date must be in the future');
    }

    // Validate business hours
    if (!this._validateBusinessHours(appointmentDate)) {
      throw new AppError(400, 'Appointment must be scheduled during business hours (8 AM - 8 PM)');
    }

    // Validate 30-minute increment
    const minutes = appointmentDate.getMinutes();
    if (minutes !== 0 && minutes !== 30) {
      throw new AppError(400, 'Appointment must be scheduled in 30-minute increments (e.g., 9:00, 9:30)');
    }

    // Check for conflicts
    const hasConflict = await Appointment.checkConflict(patient_user_id, appointment_datetime);
    if (hasConflict) {
      throw new AppError(409, 'An appointment already exists within 30 minutes of this time');
    }

    // Determine if this is a self-booking or staff-created appointment
    const creator = await User.findById(createdBy);
    const created_by_staff_id = creator.role !== 'patient' ? createdBy : null;

    // Create appointment
    const appointment = await Appointment.create({
      patient_user_id,
      created_by_staff_id,
      appointment_datetime,
      appointment_type,
      status: 'scheduled',
      notes: notes || null
    });

    return appointment;
  }

  /**
   * Get appointments by patient
   * @param {number} patientUserId - Patient user ID
   * @param {Object} filters - Filter options
   * @param {number} requesterId - ID of user making the request
   * @param {string} requesterRole - Role of user making the request
   * @param {Array} requesterPermissions - Permissions of user making the request
   * @returns {Promise<Object>} Appointments with pagination
   */
  /**
   * Get appointments by patient user ID
   * @param {number} patientUserId - Patient's user ID
   * @param {Object} filters - Query filters
   * @param {number} requesterId - ID of user making the request
   * @param {string} requesterRole - Role of user making the request
   * @param {Array} requesterPermissions - Permissions of user making the request
   * @returns {Promise<Object>} Appointments with pagination
   */
  static async getAppointmentsByPatient(patientUserId, filters, requesterId, requesterRole, requesterPermissions) {
    // Access control: patients can only get their own
    if (requesterRole === 'patient' && requesterId !== patientUserId) {
      throw new AppError(403, 'You can only view your own appointments');
    }

    // Staff must have manage_appointments permission
    if (requesterRole === 'staff' && !requesterPermissions.includes('manage_appointments')) {
      throw new AppError(403, 'You do not have permission to view patient appointments');
    }

    const result = await Appointment.findByPatientUserId(patientUserId, filters);

    // For patient requests, strip redundant fields and notes
    if (requesterRole === 'patient') {
      result.appointments = result.appointments.map(apt => {
        const sanitized = Appointment.toClientResponse(apt, requesterRole);
        // Remove redundant patient fields (patient already knows their own info)
        delete sanitized.patientName;
        delete sanitized.patientEmail;
        delete sanitized.patientPhone;
        return sanitized;
      });
    }

    return result;
  }

  /**
   * Get appointment by ID
   * @param {number} appointmentId - Appointment ID
   * @param {number} requesterId - ID of user making the request
   * @param {string} requesterRole - Role of user making the request
   * @param {Array} requesterPermissions - Permissions of user making the request
   * @returns {Promise<Object>} Appointment details
   */
  static async getAppointmentById(appointmentId, requesterId, requesterRole, requesterPermissions) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    // Access control
    const isOwner = appointment.patientUserId === requesterId;
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const hasPermission = requesterRole === 'staff' && requesterPermissions.includes('manage_appointments');

    if (!isOwner && !isAdmin && !hasPermission) {
      throw new AppError(403, 'You do not have permission to view this appointment');
    }

    // Remove notes if requester is a patient
    return Appointment.toClientResponse(appointment, requesterRole);
  }

  /**
   * Update appointment
   * @param {number} appointmentId - Appointment ID
   * @param {Object} updateData - Update data
   * @param {number} updatedBy - ID of user making the update
   * @param {string} updaterRole - Role of user making the update
   * @param {Array} updaterPermissions - Permissions of user making the update
   * @returns {Promise<Object>} Updated appointment
   */
  static async updateAppointment(appointmentId, updateData, updatedBy, updaterRole, updaterPermissions) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    // Access control
    const isOwner = appointment.patientUserId === updatedBy;
    const isAdmin = updaterRole === 'admin' || updaterRole === 'super_admin';
    const hasPermission = updaterRole === 'staff' && updaterPermissions.includes('manage_appointments');

    if (!isOwner && !isAdmin && !hasPermission) {
      throw new AppError(403, 'You do not have permission to update this appointment');
    }

    // Validate status transitions
    if (updateData.status && updateData.status !== appointment.status) {
      if (!this._validateStatusTransition(appointment.status, updateData.status, updaterRole)) {
        throw new AppError(400, `Invalid status transition from ${appointment.status} to ${updateData.status}`);
      }
    }

    // Only staff can update notes
    if (updateData.notes && updaterRole === 'patient') {
      throw new AppError(403, 'Only staff can add or update notes');
    }

    // If updating appointment datetime, check for conflicts
    if (updateData.appointment_datetime) {
      const newDatetime = new Date(updateData.appointment_datetime);
      
      // Validate future date
      if (newDatetime <= new Date()) {
        throw new AppError(400, 'Appointment date must be in the future');
      }

      // Validate business hours
      if (!this._validateBusinessHours(newDatetime)) {
        throw new AppError(400, 'Appointment must be scheduled during business hours (8 AM - 8 PM)');
      }

      // Validate 30-minute increment
      const minutes = newDatetime.getMinutes();
      if (minutes !== 0 && minutes !== 30) {
        throw new AppError(400, 'Appointment must be scheduled in 30-minute increments');
      }

      // Check for conflicts (excluding current appointment)
      const hasConflict = await Appointment.checkConflict(
        appointment.patientUserId,
        updateData.appointment_datetime,
        appointmentId
      );
      if (hasConflict) {
        throw new AppError(409, 'An appointment already exists within 30 minutes of this time');
      }
    }

    // Update appointment
    const updatedAppointment = await Appointment.updateById(appointmentId, updateData);

    // Remove notes if requester is a patient
    return Appointment.toClientResponse(updatedAppointment, updaterRole);
  }

  /**
   * Cancel appointment
   * @param {number} appointmentId - Appointment ID
   * @param {number} cancelledBy - ID of user cancelling the appointment
   * @param {string} cancellerRole - Role of user cancelling the appointment
   * @returns {Promise<Object>} Cancelled appointment
   */
  static async cancelAppointment(appointmentId, cancelledBy, cancellerRole) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    // Check if already cancelled
    if (appointment.status === 'cancelled') {
      throw new AppError(400, 'Appointment is already cancelled');
    }

    // Check if already completed
    if (appointment.status === 'completed') {
      throw new AppError(400, 'Cannot cancel a completed appointment');
    }

    // Access control: owner, staff, or admin can cancel
    const isOwner = appointment.patientUserId === cancelledBy;
    const isStaffOrAdmin = cancellerRole !== 'patient';

    if (!isOwner && !isStaffOrAdmin) {
      throw new AppError(403, 'You do not have permission to cancel this appointment');
    }

    // Cancel appointment
    const cancelledAppointment = await Appointment.updateById(appointmentId, { status: 'cancelled' });

    return cancelledAppointment;
  }

  /**
   * Check in appointment (staff only)
   * @param {number} appointmentId - Appointment ID
   * @param {number} staffId - Staff user ID
   * @returns {Promise<Object>} Updated appointment
   */
  static async checkInAppointment(appointmentId, staffId) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    // Validate current status
    if (appointment.status !== 'scheduled') {
      throw new AppError(400, `Cannot check in appointment with status: ${appointment.status}. Must be scheduled.`);
    }

    // Update status to checked_in
    const updatedAppointment = await Appointment.updateById(appointmentId, { status: 'checked_in' });

    return updatedAppointment;
  }

  /**
   * Complete appointment (staff only)
   * @param {number} appointmentId - Appointment ID
   * @param {number} staffId - Staff user ID
   * @param {string} notes - Optional completion notes
   * @returns {Promise<Object>} Updated appointment
   */
  static async completeAppointment(appointmentId, staffId, notes = null) {
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new AppError(404, 'Appointment not found');
    }

    // Validate current status
    if (appointment.status !== 'checked_in') {
      throw new AppError(400, `Cannot complete appointment with status: ${appointment.status}. Must be checked in.`);
    }

    // Update status to completed and optionally add notes
    const updateData = { status: 'completed' };
    if (notes) {
      updateData.notes = notes;
    }

    const updatedAppointment = await Appointment.updateById(appointmentId, updateData);

    return updatedAppointment;
  }

  /**
   * Get all appointments (admin/staff use)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Appointments with pagination
   */
  static async getAllAppointments(filters) {
    return await Appointment.getAllAppointments(filters);
  }

  /**
   * Get appointment statistics
   * @returns {Promise<Object>} Appointment statistics
   */
  static async getAppointmentStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [
      scheduled,
      checkedIn,
      completed,
      cancelled,
      todayCount,
      upcomingCount
    ] = await Promise.all([
      Appointment.countByStatus('scheduled'),
      Appointment.countByStatus('checked_in'),
      Appointment.countByStatus('completed'),
      Appointment.countByStatus('cancelled'),
      Appointment.countByDateRange(today, tomorrow),
      Appointment.countByDateRange(today, nextWeek, 'scheduled')
    ]);

    return {
      total: scheduled + checkedIn + completed + cancelled,
      scheduled,
      checkedIn,
      completed,
      cancelled,
      today: todayCount,
      upcoming: upcomingCount
    };
  }

  /**
   * Validate business hours (timezone-aware)
   * @param {Date} datetime - Datetime to validate
   * @returns {boolean} True if within business hours
   * @private
   */
  static _validateBusinessHours(datetime) {
    const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';
    
    // Convert the datetime to the business timezone
    const zonedDate = utcToZonedTime(datetime, businessTimezone);
    const hour = zonedDate.getHours();
    const minutes = zonedDate.getMinutes();
    
    // Check if time is between 8 AM and 8 PM in business timezone
    if (hour < 8 || hour >= 20) {
      return false;
    }
    
    // Check 30-minute increment
    if (minutes !== 0 && minutes !== 30) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate status transition
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @param {string} userRole - User role
   * @returns {boolean} True if transition is valid
   * @private
   */
  static _validateStatusTransition(currentStatus, newStatus, userRole) {
    // Cancelled is always allowed for anyone
    if (newStatus === 'cancelled') {
      return currentStatus !== 'completed'; // Can't cancel completed appointments
    }

    // Only staff/admin can transition to checked_in or completed
    if (newStatus === 'checked_in' || newStatus === 'completed') {
      if (userRole === 'patient') {
        return false;
      }
    }

    // Valid transitions
    const validTransitions = {
      'scheduled': ['checked_in', 'cancelled'],
      'checked_in': ['completed', 'cancelled'],
      'completed': [], // No transitions from completed
      'cancelled': [] // No transitions from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

module.exports = AppointmentService;
