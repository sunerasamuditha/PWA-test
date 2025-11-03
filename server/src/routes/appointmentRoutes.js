const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  createAppointmentValidation,
  updateAppointmentValidation,
  getAppointmentsValidation,
  appointmentIdValidation,
  checkInValidation,
  completeValidation,
  getStatsValidation
} = require('../validators/appointmentValidators');

// Import audit middleware
const {
  auditAppointmentCreate,
  auditAppointmentUpdate,
  auditAppointmentCancel
} = require('../middleware/auditLog');

/**
 * Conditional middleware to require permission for listing all appointments
 * If patient_user_id query param is missing, staff need manage_appointments permission
 */
const requirePermissionForListAll = (req, res, next) => {
  const { patient_user_id } = req.query;
  
  // If patient_user_id is provided, this is a patient-scoped request - no special permission needed
  if (patient_user_id) {
    return next();
  }
  
  // If no patient_user_id, this is a "list all" request
  // Patients cannot list all appointments
  if (req.user.role === 'patient') {
    return res.status(403).json({
      success: false,
      message: 'Patients must provide patient_user_id parameter'
    });
  }
  
  // For staff, require manage_appointments permission (admins bypass via requirePermission)
  // For admin/super_admin, requirePermission will bypass the check
  return requirePermission('manage_appointments')(req, res, next);
};

/**
 * @route   POST /api/appointments
 * @desc    Create a new appointment
 * @access  Private (Patient, Staff, Admin)
 * @note    auditAppointmentCreate runs after controller
 */
router.post(
  '/',
  authenticate,
  createAppointmentValidation,
  handleValidationErrors,
  appointmentController.createAppointment,
  auditAppointmentCreate
);

/**
 * @route   GET /api/appointments/stats
 * @desc    Get appointment statistics
 * @access  Private (Staff with manage_appointments permission, Admin, Super Admin)
 * @note    Must be before /:id route to avoid route collision
 */
router.get(
  '/stats',
  authenticate,
  requirePermission('manage_appointments'),
  getStatsValidation,
  handleValidationErrors,
  appointmentController.getAppointmentStats
);

/**
 * @route   GET /api/appointments
 * @desc    Get appointments with filtering
 * @access  Private (Patient with patient_user_id, Staff with manage_appointments, Admin)
 * @note    Conditional permission check - staff need manage_appointments when listing all
 */
router.get(
  '/',
  authenticate,
  requirePermissionForListAll,
  getAppointmentsValidation,
  handleValidationErrors,
  appointmentController.getAppointments
);

/**
 * @route   GET /api/appointments/:id
 * @desc    Get appointment by ID
 * @access  Private (Owner, Staff with permission, Admin)
 */
router.get(
  '/:id',
  authenticate,
  appointmentIdValidation,
  handleValidationErrors,
  appointmentController.getAppointmentById
);

/**
 * @route   PUT /api/appointments/:id
 * @desc    Update appointment
 * @access  Private (Owner, Staff with permission, Admin)
 * @note    auditAppointmentUpdate runs after controller
 */
router.put(
  '/:id',
  authenticate,
  appointmentIdValidation,
  updateAppointmentValidation,
  handleValidationErrors,
  appointmentController.updateAppointment,
  auditAppointmentUpdate
);

/**
 * @route   PUT /api/appointments/:id/cancel
 * @desc    Cancel appointment
 * @access  Private (Owner, Staff, Admin)
 * @note    auditAppointmentCancel runs after controller
 */
router.put(
  '/:id/cancel',
  authenticate,
  appointmentIdValidation,
  handleValidationErrors,
  appointmentController.cancelAppointment,
  auditAppointmentCancel
);

/**
 * @route   PUT /api/appointments/:id/check-in
 * @desc    Check in patient for appointment (staff only)
 * @access  Private (Staff with manage_appointments permission, Admin, Super Admin)
 */
router.put(
  '/:id/check-in',
  authenticate,
  requirePermission('manage_appointments'),
  checkInValidation,
  handleValidationErrors,
  appointmentController.checkInAppointment
);

/**
 * @route   PUT /api/appointments/:id/complete
 * @desc    Complete appointment (staff only)
 * @access  Private (Staff with manage_appointments permission, Admin, Super Admin)
 */
router.put(
  '/:id/complete',
  authenticate,
  requirePermission('manage_appointments'),
  completeValidation,
  handleValidationErrors,
  appointmentController.completeAppointment
);

module.exports = router;
