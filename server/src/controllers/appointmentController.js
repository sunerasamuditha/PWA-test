const AppointmentService = require('../services/appointmentService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * AppointmentController
 * Handles HTTP requests for appointment management
 */

/**
 * Create new appointment
 * @route POST /api/appointments
 * @access Private (Patient, Staff, Admin)
 */
exports.createAppointment = asyncHandler(async (req, res) => {
  const { patient_user_id, appointment_datetime, appointment_type, notes } = req.body;

  // Validate required fields
  if (!patient_user_id || !appointment_datetime || !appointment_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: patient_user_id, appointment_datetime, appointment_type'
    });
  }

  const appointmentData = {
    patient_user_id,
    appointment_datetime,
    appointment_type,
    // Only include notes if user is staff/admin
    notes: req.user.role !== 'patient' ? notes : undefined
  };

  const appointment = await AppointmentService.createAppointment(appointmentData, req.user.id);

  // Store in res.locals for audit logging
  res.locals.appointment = appointment;

  res.status(201).json({
    success: true,
    message: 'Appointment created successfully',
    data: appointment
  });
});

/**
 * Get appointments with filtering
 * @route GET /api/appointments
 * @access Private (Patient, Staff, Admin)
 */
exports.getAppointments = asyncHandler(async (req, res) => {
  const { patient_user_id, status, appointment_type, startDate, endDate, page, limit } = req.query;

  // If patient_user_id is provided, use findByPatientUserId, otherwise use getAllAppointments
  let result;

  if (patient_user_id) {
    // Get appointments for specific patient
    const filters = {
      status,
      appointment_type,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    };

    result = await AppointmentService.getAppointmentsByPatient(
      parseInt(patient_user_id),
      filters,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );
  } else {
    // Get all appointments (staff/admin only)
    // Permission check is handled by route middleware (requirePermissionForListAll)
    const filters = {
      status,
      appointment_type,
      search: req.query.search,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    };

    result = await AppointmentService.getAllAppointments(filters);
  }

  res.json({
    success: true,
    message: 'Appointments retrieved successfully',
    data: result.appointments,
    pagination: result.pagination
  });
});

/**
 * Get appointment by ID
 * @route GET /api/appointments/:id
 * @access Private (Owner, Staff with permission, Admin)
 */
exports.getAppointmentById = asyncHandler(async (req, res) => {
  const appointmentId = parseInt(req.params.id);

  const appointment = await AppointmentService.getAppointmentById(
    appointmentId,
    req.user.id,
    req.user.role,
    req.user.permissions || []
  );

  res.json({
    success: true,
    message: 'Appointment retrieved successfully',
    data: appointment
  });
});

/**
 * Update appointment
 * @route PUT /api/appointments/:id
 * @access Private (Owner, Staff with permission, Admin)
 */
exports.updateAppointment = asyncHandler(async (req, res) => {
  const appointmentId = parseInt(req.params.id);
  
  // Capture before state
  const beforeAppointment = await AppointmentService.getAppointmentById(appointmentId, req.user.id, req.user.role);
  res.locals.beforeData = beforeAppointment;
  
  const updateData = req.body;

  const updatedAppointment = await AppointmentService.updateAppointment(
    appointmentId,
    updateData,
    req.user.id,
    req.user.role,
    req.user.permissions || []
  );

  // Capture after state and store in res.locals for audit logging
  res.locals.afterData = updatedAppointment;
  res.locals.appointment = updatedAppointment;

  res.json({
    success: true,
    message: 'Appointment updated successfully',
    data: updatedAppointment
  });
});

/**
 * Cancel appointment
 * @route PUT /api/appointments/:id/cancel
 * @access Private (Owner, Staff, Admin)
 */
exports.cancelAppointment = asyncHandler(async (req, res) => {
  const appointmentId = parseInt(req.params.id);

  // Fetch appointment before cancellation for audit
  const Appointment = require('../models/Appointment');
  const beforeAppointment = await Appointment.findById(appointmentId);
  
  const cancelledAppointment = await AppointmentService.cancelAppointment(
    appointmentId,
    req.user.id,
    req.user.role,
    req.user.permissions || []
  );

  // Store both before and after states for audit logging
  res.locals.beforeAppointment = beforeAppointment;
  res.locals.appointment = cancelledAppointment;

  res.json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: cancelledAppointment
  });
});

/**
 * Check in appointment (staff only)
 * @route PUT /api/appointments/:id/check-in
 * @access Private (Staff with manage_appointments permission, Admin)
 */
exports.checkInAppointment = asyncHandler(async (req, res) => {
  const appointmentId = parseInt(req.params.id);

  const updatedAppointment = await AppointmentService.checkInAppointment(
    appointmentId,
    req.user.id
  );

  res.json({
    success: true,
    message: 'Patient checked in successfully',
    data: updatedAppointment
  });
});

/**
 * Complete appointment (staff only)
 * @route PUT /api/appointments/:id/complete
 * @access Private (Staff with manage_appointments permission, Admin)
 */
exports.completeAppointment = asyncHandler(async (req, res) => {
  const appointmentId = parseInt(req.params.id);
  const { notes } = req.body;

  const updatedAppointment = await AppointmentService.completeAppointment(
    appointmentId,
    req.user.id,
    notes
  );

  res.json({
    success: true,
    message: 'Appointment completed successfully',
    data: updatedAppointment
  });
});

/**
 * Get appointment statistics
 * @route GET /api/appointments/stats
 * @access Private (Staff with manage_appointments permission, Admin)
 */
exports.getAppointmentStats = asyncHandler(async (req, res) => {
  const stats = await AppointmentService.getAppointmentStats();

  res.json({
    success: true,
    message: 'Appointment statistics retrieved successfully',
    data: stats
  });
});
