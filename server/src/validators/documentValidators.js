const { body, query, param } = require('express-validator');
const { DOCUMENT_TYPES } = require('../models/Document');

/**
 * Validation rules for uploading documents
 */
const uploadDocumentValidation = [
  body('patient_user_id')
    .optional() // Optional because patients upload to their own account
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer'),
  
  body('type')
    .notEmpty().withMessage('type is required')
    .isIn(DOCUMENT_TYPES)
    .withMessage('Invalid document type')
];

/**
 * Validation rules for getting documents
 */
const getDocumentsValidation = [
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer'),
  
  query('type')
    .optional()
    .isIn(DOCUMENT_TYPES)
    .withMessage('Invalid document type'),
  
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
 * Validation rules for document ID parameter
 */
const documentIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Document ID must be a positive integer')
];

/**
 * Validation rules for deleting documents
 */
const deleteDocumentValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Document ID must be a positive integer')
];

/**
 * Validation rules for getting document statistics
 */
const getStatsValidation = [
  query('patient_user_id')
    .optional()
    .isInt({ min: 1 }).withMessage('patient_user_id must be a positive integer')
];

module.exports = {
  uploadDocumentValidation,
  getDocumentsValidation,
  documentIdValidation,
  deleteDocumentValidation,
  getStatsValidation
};
