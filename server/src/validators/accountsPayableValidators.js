const { body, query, param } = require('express-validator');
const { PAYABLE_STATUSES } = require('../models/AccountsPayable');

/**
 * Validation for creating accounts payable
 */
const createPayableValidation = [
  body('entity_id')
    .notEmpty().withMessage('Entity ID is required')
    .isInt({ min: 1 }).withMessage('Entity ID must be a positive integer'),

  body('reference_code')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Reference code must be at most 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters'),

  body('total_amount')
    .notEmpty().withMessage('Total amount is required')
    .isFloat({ min: 0.01, max: 9999999.99 }).withMessage('Total amount must be between 0.01 and 9999999.99'),

  body('due_date')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Due date must be a valid ISO8601 date'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters')
];

/**
 * Validation for updating accounts payable
 */
const updatePayableValidation = [
  body('reference_code')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Reference code must be at most 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters'),

  body('total_amount')
    .optional()
    .isFloat({ min: 0.01, max: 9999999.99 }).withMessage('Total amount must be between 0.01 and 9999999.99'),

  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO8601 date'),

  body('status')
    .optional()
    .isIn(PAYABLE_STATUSES).withMessage(`Status must be one of: ${PAYABLE_STATUSES.join(', ')}`),

  body('payment_method')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Payment method must be at most 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters')
];

/**
 * Validation for marking payable as paid
 */
const markAsPaidValidation = [
  body('paid_date')
    .notEmpty().withMessage('Paid date is required')
    .isISO8601().withMessage('Paid date must be a valid ISO8601 date')
    .custom((value) => {
      const paidDate = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (paidDate > today) {
        throw new Error('Paid date cannot be in the future');
      }
      return true;
    }),

  body('payment_method')
    .notEmpty().withMessage('Payment method is required')
    .trim()
    .isLength({ max: 100 }).withMessage('Payment method must be at most 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters')
];

/**
 * Validation for getting payables with filters
 */
const getPayablesValidation = [
  query('entity_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Entity ID must be a positive integer'),

  query('status')
    .optional()
    .isIn(PAYABLE_STATUSES).withMessage(`Status must be one of: ${PAYABLE_STATUSES.join(', ')}`),

  query('dateField')
    .optional()
    .isIn(['due_date', 'paid_date']).withMessage('Date field must be either due_date or paid_date'),

  query('startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid ISO8601 date'),

  query('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid ISO8601 date')
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

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search term must be at most 100 characters'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  query('sort_by')
    .optional()
    .isIn(['due_date', 'total_amount', 'created_at', 'paid_date']).withMessage('sort_by must be one of: due_date, total_amount, created_at, paid_date'),

  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC']).withMessage('sort_order must be ASC or DESC')
];

/**
 * Validation for payable ID parameter
 */
const payableIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Payable ID must be a positive integer')
];

/**
 * Validation for entity ID parameter
 */
const entityIdParamValidation = [
  param('entityId')
    .isInt({ min: 1 }).withMessage('Entity ID must be a positive integer')
];

/**
 * Validation for due soon query
 */
const dueSoonValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 }).withMessage('Days must be between 1 and 90')
];

module.exports = {
  createPayableValidation,
  updatePayableValidation,
  markAsPaidValidation,
  getPayablesValidation,
  payableIdValidation,
  entityIdParamValidation,
  dueSoonValidation
};
