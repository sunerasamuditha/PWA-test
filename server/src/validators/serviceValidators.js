const { body, query, param } = require('express-validator');
const { SERVICE_CATEGORIES } = require('../models/Service');

const createServiceValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Service name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Service name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-\/()&,.]+$/).withMessage('Service name contains invalid characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0.01, max: 999999.99 }).withMessage('Price must be between 0.01 and 999999.99')
    .custom((value) => {
      if (!/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('Price can have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('service_category')
    .notEmpty().withMessage('Service category is required')
    .isIn(SERVICE_CATEGORIES).withMessage(`Service category must be one of: ${SERVICE_CATEGORIES.join(', ')}`),
  
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];

const updateServiceValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Service name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z0-9\s\-\/()&,.]+$/).withMessage('Service name contains invalid characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0.01, max: 999999.99 }).withMessage('Price must be between 0.01 and 999999.99')
    .custom((value) => {
      if (value !== undefined && !/^\d+(\.\d{1,2})?$/.test(value.toString())) {
        throw new Error('Price can have maximum 2 decimal places');
      }
      return true;
    }),
  
  body('service_category')
    .optional()
    .isIn(SERVICE_CATEGORIES).withMessage(`Service category must be one of: ${SERVICE_CATEGORIES.join(', ')}`),
  
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];

const getServicesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search query must not exceed 100 characters'),
  
  query('category')
    .optional()
    .isIn(SERVICE_CATEGORIES).withMessage(`Category must be one of: ${SERVICE_CATEGORIES.join(', ')}`),
  
  query('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  
  query('min_price')
    .optional()
    .isFloat({ min: 0 }).withMessage('min_price must be a positive number'),
  
  query('max_price')
    .optional()
    .isFloat({ min: 0 }).withMessage('max_price must be a positive number')
    .custom((value, { req }) => {
      if (req.query.min_price && parseFloat(value) < parseFloat(req.query.min_price)) {
        throw new Error('max_price must be greater than or equal to min_price');
      }
      return true;
    })
];

const serviceIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Service ID must be a positive integer')
];

module.exports = {
  createServiceValidation,
  updateServiceValidation,
  getServicesValidation,
  serviceIdValidation
};
