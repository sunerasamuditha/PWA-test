const { body, query, param } = require('express-validator');
const { PAYMENT_METHODS, INVOICE_STATUSES, INVOICE_TYPES } = require('../models/Invoice');

const createInvoiceValidation = [
  body('patient_user_id')
    .notEmpty().withMessage('Patient user ID is required')
    .isInt({ min: 1 }).withMessage('Patient user ID must be a positive integer'),
  
  body('appointment_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Appointment ID must be a positive integer'),
  
  body('invoice_type')
    .notEmpty().withMessage('Invoice type is required')
    .isIn(INVOICE_TYPES).withMessage(`Invoice type must be one of: ${INVOICE_TYPES.join(', ')}`),
  
  body('payment_method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  
  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO8601 date')
    .custom((value, { req }) => {
      if (req.body.payment_method === 'insurance_credit' && !value) {
        throw new Error('Due date is required for insurance credit payment method');
      }
      if (value && new Date(value) < new Date()) {
        throw new Error('Due date cannot be in the past');
      }
      return true;
    }),
  
  body('items')
    .isArray({ min: 1 }).withMessage('Items array is required and must contain at least one item'),
  
  body('items.*.service_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Service ID must be a positive integer'),
  
  body('items.*.item_description')
    .notEmpty().withMessage('Item description is required')
    .trim()
    .isLength({ max: 500 }).withMessage('Item description must not exceed 500 characters'),
  
  body('items.*.quantity')
    .notEmpty().withMessage('Item quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  
  body('items.*.unit_price')
    .notEmpty().withMessage('Unit price is required')
    .isFloat({ min: 0.01 }).withMessage('Unit price must be at least 0.01')
    .custom((value) => {
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('Unit price can have maximum 2 decimal places');
      }
      return true;
    })
];

const updateInvoiceValidation = [
  body('total_amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Total amount must be a positive number'),
  
  body('status')
    .optional()
    .isIn(INVOICE_STATUSES).withMessage(`Status must be one of: ${INVOICE_STATUSES.join(', ')}`),
  
  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO8601 date'),
  
  body('payment_method')
    .optional()
    .isIn(PAYMENT_METHODS).withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`)
];

const getInvoicesValidation = [
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Patient user ID must be a positive integer'),
  
  query('status')
    .optional()
    .isIn(INVOICE_STATUSES).withMessage(`Status must be one of: ${INVOICE_STATUSES.join(', ')}`),
  
  query('invoice_type')
    .optional()
    .isIn(INVOICE_TYPES).withMessage(`Invoice type must be one of: ${INVOICE_TYPES.join(', ')}`),
  
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

const invoiceIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer')
];

const invoiceIdParamValidation = [
  param('invoiceId')
    .isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer')
];

const invoiceItemIdValidation = [
  param('itemId')
    .isInt({ min: 1 }).withMessage('Invoice item ID must be a positive integer')
];

const addInvoiceItemValidation = [
  body('service_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Service ID must be a positive integer'),
  
  body('item_description')
    .notEmpty().withMessage('Item description is required')
    .trim()
    .isLength({ max: 500 }).withMessage('Item description must not exceed 500 characters'),
  
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  
  body('unit_price')
    .notEmpty().withMessage('Unit price is required')
    .isFloat({ min: 0.01 }).withMessage('Unit price must be at least 0.01')
    .custom((value) => {
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('Unit price can have maximum 2 decimal places');
      }
      return true;
    })
];

module.exports = {
  createInvoiceValidation,
  updateInvoiceValidation,
  getInvoicesValidation,
  invoiceIdValidation,
  invoiceIdParamValidation,
  invoiceItemIdValidation,
  addInvoiceItemValidation
};
