const { body, query, param } = require('express-validator');
const { PAYMENT_METHODS, PAYMENT_STATUSES } = require('../models/Payment');

const recordPaymentValidation = [
  body('invoice_id')
    .notEmpty().withMessage('Invoice ID is required')
    .isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer'),
  
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01, max: 999999.99 }).withMessage('Amount must be between 0.01 and 999999.99')
    .custom((value) => {
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('Amount can have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('payment_method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  
  body('transaction_id')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Transaction ID must not exceed 255 characters')
    .custom((value, { req }) => {
      if (['card', 'bank_transfer'].includes(req.body.payment_method) && !value) {
        throw new Error('Transaction ID is required for card and bank transfer payments');
      }
      return true;
    }),
  
  body('payment_status')
    .optional()
    .isIn(PAYMENT_STATUSES).withMessage(`Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must not exceed 1000 characters'),
  
  body('paid_at')
    .optional()
    .isISO8601().withMessage('Paid at must be a valid ISO8601 date')
];

const getPaymentsValidation = [
  query('invoice_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer'),
  
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Patient user ID must be a positive integer'),
  
  query('payment_method')
    .optional()
    .isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  
  query('payment_status')
    .optional()
    .isIn(PAYMENT_STATUSES).withMessage(`Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`),
  
  query('startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid ISO8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid ISO8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && value && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const paymentIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Payment ID must be a positive integer')
];

const generateReportValidation = [
  query('patient_user_id')
    .notEmpty().withMessage('Patient user ID is required')
    .isInt({ min: 1 }).withMessage('Patient user ID must be a positive integer'),
  
  query('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Start date must be a valid ISO8601 date'),
  
  query('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('End date must be a valid ISO8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

module.exports = {
  recordPaymentValidation,
  getPaymentsValidation,
  paymentIdValidation,
  generateReportValidation
};
