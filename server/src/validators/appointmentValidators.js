const { body, query, param } = require('express-validator');
const { APPOINTMENT_TYPES, APPOINTMENT_STATUSES } = require('../models/Appointment');
const { utcToZonedTime } = require('date-fns-tz');

/**
 * Helper to validate business hours in configured timezone
 * @param {string} datetimeString - ISO8601 datetime string
 * @returns {Object} { isValid: boolean, error?: string }
 */
const validateBusinessHoursAndIncrement = (datetimeString) => {
  const businessTimezone = process.env.BUSINESS_TIMEZONE || 'UTC';
  const appointmentDate = new Date(datetimeString);
  
  // Convert to business timezone
  const zonedDate = utcToZonedTime(appointmentDate, businessTimezone);
  const hour = zonedDate.getHours();
  const minutes = zonedDate.getMinutes();
  
  // Check business hours (8 AM - 8 PM)
  if (hour < 8 || hour >= 20) {
    return { 
      isValid: false, 
      error: 'Appointment must be scheduled during business hours (8 AM - 8 PM in business timezone)' 
    };
  }
  
  // Check 30-minute increment
  if (minutes !== 0 && minutes !== 30) {
    return { 
      isValid: false, 
      error: 'Appointment must be scheduled in 30-minute increments (e.g., 9:00, 9:30)' 
    };
  }
  
  return { isValid: true };
};

/**
 * Validation rules for creating appointments
 */
const createAppointmentValidation = [
  body('patient_user_id')
    .notEmpty().withMessage('patient_user_id is required')
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer'),
  
  body('appointment_datetime')
    .notEmpty().withMessage('appointment_datetime is required')
    .isISO8601().withMessage('appointment_datetime must be a valid ISO8601 datetime')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const now = new Date();
      
      // Check if date is in future
      if (appointmentDate <= now) {
        throw new Error('Appointment date must be in the future');
      }
      
      // Validate business hours and increment in configured timezone
      const validation = validateBusinessHoursAndIncrement(value);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
      
      return true;
    }),
  
  body('appointment_type')
    .notEmpty().withMessage('appointment_type is required')
    .isIn(APPOINTMENT_TYPES)
    .withMessage(`appointment_type must be one of: ${APPOINTMENT_TYPES.join(', ')}`),
  
  body('notes')
    .optional()
    .custom((value, { req }) => {
      // Only staff, admin, and super_admin can provide notes
      if (value && req.user && req.user.role === 'patient') {
        throw new Error('Patients cannot provide notes. Notes are staff-only.');
      }
      return true;
    })
    .isString().withMessage('notes must be a string')
    .isLength({ max: 1000 }).withMessage('notes must not exceed 1000 characters')
];

/**
 * Validation rules for updating appointments
 */
const updateAppointmentValidation = [
  body('appointment_datetime')
    .optional()
    .isISO8601().withMessage('appointment_datetime must be a valid ISO8601 datetime')
    .custom((value) => {
      if (!value) return true;
      
      const appointmentDate = new Date(value);
      const now = new Date();
      
      // Check if date is in future
      if (appointmentDate <= now) {
        throw new Error('Appointment date must be in the future');
      }
      
      // Validate business hours and increment in configured timezone
      const validation = validateBusinessHoursAndIncrement(value);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
      
      return true;
    }),
  
  body('status')
    .optional()
    .isIn(APPOINTMENT_STATUSES)
    .withMessage(`status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`),
  
  body('appointment_type')
    .optional()
    .isIn(APPOINTMENT_TYPES)
    .withMessage(`appointment_type must be one of: ${APPOINTMENT_TYPES.join(', ')}`),
  
  body('notes')
    .optional()
    .custom((value, { req }) => {
      // Only staff, admin, and super_admin can provide notes
      if (value && req.user && req.user.role === 'patient') {
        throw new Error('Patients cannot provide notes. Notes are staff-only.');
      }
      return true;
    })
    .isString().withMessage('notes must be a string')
    .isLength({ max: 1000 }).withMessage('notes must not exceed 1000 characters')
];

/**
 * Validation rules for getting appointments
 */
const getAppointmentsValidation = [
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer'),
  
  query('status')
    .optional()
    .isIn(APPOINTMENT_STATUSES)
    .withMessage(`status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`),
  
  query('appointment_type')
    .optional()
    .isIn(APPOINTMENT_TYPES)
    .withMessage(`appointment_type must be one of: ${APPOINTMENT_TYPES.join(', ')}`),
  
  query('search')
    .optional()
    .isLength({ max: 100 }).withMessage('search must not exceed 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/).withMessage('search contains invalid characters'),
  
  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid ISO8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(value);
        if (endDate.getTime() < startDate.getTime()) {
          throw new Error('endDate must be after startDate');
        }
      }
      return true;
    }),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
];

/**
 * Validation rules for appointment ID parameter
 */
const appointmentIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Appointment ID must be a positive integer')
];

/**
 * Validation rules for check-in
 */
const checkInValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Appointment ID must be a positive integer')
];

/**
 * Validation rules for complete
 */
const completeValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Appointment ID must be a positive integer'),
  
  body('notes')
    .optional()
    .isString().withMessage('notes must be a string')
    .isLength({ max: 1000 }).withMessage('notes must not exceed 1000 characters')
];

/**
 * Validation rules for appointment statistics
 */
const getStatsValidation = [
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer')
];

module.exports = {
  createAppointmentValidation,
  updateAppointmentValidation,
  getAppointmentsValidation,
  appointmentIdValidation,
  checkInValidation,
  completeValidation,
  getStatsValidation
};
