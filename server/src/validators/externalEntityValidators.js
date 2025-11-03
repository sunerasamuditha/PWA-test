const { body, query, param } = require('express-validator');
const { ENTITY_TYPES } = require('../models/ExternalEntity');

/**
 * Validation for creating external entity
 */
const createEntityValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Entity name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Entity name must be between 2 and 255 characters'),

  body('type')
    .notEmpty().withMessage('Entity type is required')
    .isIn(ENTITY_TYPES).withMessage(`Entity type must be one of: ${ENTITY_TYPES.join(', ')}`),

  body('contact_info')
    .optional()
    .isObject().withMessage('contact_info must be an object'),

  body('contact_info.phone')
    .optional()
    .isString().withMessage('Phone must be a string')
    .isLength({ max: 20 }).withMessage('Phone must be at most 20 characters'),

  body('contact_info.email')
    .optional()
    .isEmail().withMessage('Invalid email format'),

  body('contact_info.address')
    .optional()
    .isObject().withMessage('Address must be an object'),

  body('contact_info.contact_person')
    .optional()
    .isObject().withMessage('Contact person must be an object'),

  body('contact_info.contact_person.email')
    .optional()
    .isEmail().withMessage('Invalid contact person email format'),

  body('contact_info.billing_contact')
    .optional()
    .isObject().withMessage('Billing contact must be an object'),

  body('contact_info.billing_contact.email')
    .optional()
    .isEmail().withMessage('Invalid billing contact email format')
];

/**
 * Validation for updating external entity
 */
const updateEntityValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Entity name must be between 2 and 255 characters'),

  body('type')
    .optional()
    .isIn(ENTITY_TYPES).withMessage(`Entity type must be one of: ${ENTITY_TYPES.join(', ')}`),

  body('contact_info')
    .optional()
    .isObject().withMessage('contact_info must be an object'),

  body('contact_info.phone')
    .optional()
    .isString().withMessage('Phone must be a string')
    .isLength({ max: 20 }).withMessage('Phone must be at most 20 characters'),

  body('contact_info.email')
    .optional()
    .isEmail().withMessage('Invalid email format'),

  body('contact_info.address')
    .optional()
    .isObject().withMessage('Address must be an object'),

  body('contact_info.contact_person')
    .optional()
    .isObject().withMessage('Contact person must be an object'),

  body('contact_info.contact_person.email')
    .optional()
    .isEmail().withMessage('Invalid contact person email format'),

  body('contact_info.billing_contact')
    .optional()
    .isObject().withMessage('Billing contact must be an object'),

  body('contact_info.billing_contact.email')
    .optional()
    .isEmail().withMessage('Invalid billing contact email format')
];

/**
 * Validation for getting entities with filters
 */
const getEntitiesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .isLength({ max: 100 }).withMessage('Search term must be at most 100 characters'),

  query('type')
    .optional()
    .isIn(ENTITY_TYPES).withMessage(`Type must be one of: ${ENTITY_TYPES.join(', ')}`),

  query('sort_by')
    .optional()
    .isIn(['name', 'type', 'created_at']).withMessage('sort_by must be one of: name, type, created_at'),

  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC']).withMessage('sort_order must be ASC or DESC')
];

/**
 * Validation for entity ID parameter
 */
const entityIdValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Entity ID must be a positive integer')
];

/**
 * Validation for entity type parameter
 */
const entityTypeValidation = [
  param('type')
    .isIn(ENTITY_TYPES).withMessage(`Type must be one of: ${ENTITY_TYPES.join(', ')}`)
];

module.exports = {
  createEntityValidation,
  updateEntityValidation,
  getEntitiesValidation,
  entityIdValidation,
  entityTypeValidation
};
