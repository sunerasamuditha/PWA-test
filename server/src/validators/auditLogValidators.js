const { param, query } = require('express-validator');

/**
 * Custom validator to handle single value or array for action filter
 */
const validateAction = (value) => {
  const validActions = ['create', 'update', 'delete', 'login', 'logout', 'access'];
  
  if (Array.isArray(value)) {
    return value.every(v => validActions.includes(v));
  }
  
  return validActions.includes(value);
};

/**
 * Custom validator to handle single value or array for targetEntity filter
 */
const validateTargetEntity = (value) => {
  if (Array.isArray(value)) {
    return value.every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 100);
  }
  
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
};

/**
 * Validation for getting audit logs
 */
const getAuditLogsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('action')
    .optional()
    .custom(validateAction)
    .withMessage('Invalid action type. Must be one of: create, update, delete, login, logout, access'),
  query('targetEntity')
    .optional()
    .custom(validateTargetEntity)
    .withMessage('Target entity must be a string or array of strings (max 100 characters each)'),
  query('targetId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target ID must be a positive integer'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('sortBy')
    .optional()
    .isIn(['created_at', 'timestamp', 'action', 'target_entity', 'user_id'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC')
];

/**
 * Validation for user ID parameter
 */
const userIdParamValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

/**
 * Validation for log ID parameter
 */
const logIdParamValidation = [
  param('logId')
    .isInt({ min: 1 })
    .withMessage('Log ID must be a positive integer')
];

/**
 * Validation for entity audit logs
 */
const entityAuditLogsValidation = [
  param('entityType')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Entity type is required')
    .isLength({ max: 100 })
    .withMessage('Entity type must not exceed 100 characters'),
  param('entityId')
    .isInt({ min: 1 })
    .withMessage('Entity ID must be a positive integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

/**
 * Validation for search audit logs
 */
const searchAuditLogsValidation = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must not exceed 200 characters'),
  query('action')
    .optional()
    .custom(validateAction)
    .withMessage('Invalid action type. Must be one of: create, update, delete, login, logout, access'),
  query('targetEntity')
    .optional()
    .custom(validateTargetEntity)
    .withMessage('Target entity must be a string or array of strings (max 100 characters each)'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation for audit statistics
 */
const auditStatisticsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

/**
 * Validation for export audit logs
 */
const exportAuditLogsValidation = [
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('action')
    .optional()
    .custom(validateAction)
    .withMessage('Invalid action type. Must be one of: create, update, delete, login, logout, access'),
  query('targetEntity')
    .optional()
    .custom(validateTargetEntity)
    .withMessage('Target entity must be a string or array of strings (max 100 characters each)'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

/**
 * Validation for user's own audit trail
 */
const myAuditTrailValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

module.exports = {
  getAuditLogsValidation,
  userIdParamValidation,
  logIdParamValidation,
  entityAuditLogsValidation,
  searchAuditLogsValidation,
  auditStatisticsValidation,
  exportAuditLogsValidation,
  myAuditTrailValidation
};
