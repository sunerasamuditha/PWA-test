const { body, query, param, validationResult } = require('express-validator');
const { SHIFT_TYPES } = require('../models/StaffShift');

// Validation for getting shifts with filters
const getShiftsValidation = [
  query('staff_user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Staff user ID must be a positive integer'),
  
  query('shift_type')
    .optional()
    .isIn(SHIFT_TYPES)
    .withMessage(`Shift type must be one of: ${SHIFT_TYPES.join(', ')}`),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Validation for shift ID parameter
const shiftIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Shift ID must be a positive integer')
    .toInt()
];

// Validation for updating shift (admin manual edits)
const updateShiftValidation = [
  body('login_at')
    .optional()
    .isISO8601()
    .withMessage('Login time must be a valid ISO8601 datetime'),
  
  body('logout_at')
    .optional()
    .isISO8601()
    .withMessage('Logout time must be a valid ISO8601 datetime')
    .custom((logoutAt, { req }) => {
      if (req.body.login_at) {
        const login = new Date(req.body.login_at);
        const logout = new Date(logoutAt);
        if (logout <= login) {
          throw new Error('Logout time must be after login time');
        }
      }
      return true;
    }),
  
  body('shift_type')
    .optional()
    .isIn(SHIFT_TYPES)
    .withMessage(`Shift type must be one of: ${SHIFT_TYPES.join(', ')}`),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
];

// Validation for monthly report parameters
const monthlyReportValidation = [
  query('staffUserId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Staff user ID must be a positive integer')
    .toInt(),
  
  query('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100')
    .toInt(),
  
  query('month')
    .notEmpty()
    .withMessage('Month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12')
    .toInt()
];

// Validation for shift stats endpoint
const shiftStatsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    })
];

module.exports = {
  getShiftsValidation,
  shiftIdValidation,
  updateShiftValidation,
  monthlyReportValidation,
  shiftStatsValidation
};
