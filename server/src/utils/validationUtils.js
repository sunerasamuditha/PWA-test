const { body, query, param } = require('express-validator');

/**
 * Common validation patterns and utilities for consistent error messages
 */

// Common validation patterns
const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s+()-]{10,20}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  fullName: /^[a-zA-Z\s'-]+$/,
  passportNumber: /^[A-Za-z0-9]{6,20}$/,
  policyNumber: /^[A-Za-z0-9]{5,50}$/,
  dateFormat: /^\d{4}-\d{2}-\d{2}$/
};

// Common validation error messages
const ValidationMessages = {
  required: (field) => `${field} is required`,
  invalid: (field) => `Please provide a valid ${field.toLowerCase()}`,
  length: (field, min, max) => {
    if (min && max) {
      return `${field} must be between ${min} and ${max} characters`;
    } else if (min) {
      return `${field} must be at least ${min} characters`;
    } else if (max) {
      return `${field} must be less than ${max} characters`;
    }
  },
  pattern: (field, description) => `${field} ${description}`,
  future: (field) => `${field} must be in the future`,
  past: (field) => `${field} must be in the past`,
  custom: (message) => message
};

/**
 * Common field validators with consistent error messages
 */
const CommonValidators = {
  // Email validator
  email: (fieldName = 'Email', isOptional = false) => {
    const validator = body('email')
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isEmail()
      .withMessage(ValidationMessages.invalid(fieldName))
      .isLength({ max: 255 })
      .withMessage(ValidationMessages.length(fieldName, null, 255));
      
    return isOptional ? validator.optional() : validator;
  },

  // Password validator
  password: (fieldName = 'Password', isOptional = false) => {
    const validator = body('password')
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isLength({ min: 8, max: 128 })
      .withMessage(ValidationMessages.length(fieldName, 8, 128))
      .matches(ValidationPatterns.password)
      .withMessage(ValidationMessages.pattern(fieldName, 'must contain at least one uppercase letter, lowercase letter, number, and special character'));
      
    return isOptional ? validator.optional() : validator;
  },

  // Full name validator
  fullName: (fieldName = 'Full name', isOptional = false) => {
    const validator = body('fullName')
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isLength({ min: 2, max: 100 })
      .withMessage(ValidationMessages.length(fieldName, 2, 100))
      .matches(ValidationPatterns.fullName)
      .withMessage(ValidationMessages.pattern(fieldName, 'can only contain letters, spaces, hyphens, and apostrophes'));
      
    return isOptional ? validator.optional() : validator;
  },

  // Phone number validator
  phoneNumber: (fieldName = 'Phone number', isOptional = false) => {
    const validator = body('phoneNumber')
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .matches(ValidationPatterns.phone)
      .withMessage(ValidationMessages.invalid(fieldName))
      .isLength({ max: 20 })
      .withMessage(ValidationMessages.length(fieldName, null, 20));
      
    return isOptional ? validator.optional() : validator;
  },

  // Role validator
  role: (allowedRoles, fieldName = 'Role', isOptional = false) => {
    const validator = body('role')
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isIn(allowedRoles)
      .withMessage(ValidationMessages.pattern(fieldName, `must be one of: ${allowedRoles.join(', ')}`));
      
    return isOptional ? validator.optional() : validator;
  },

  // Date validator
  date: (fieldPath, fieldName = 'Date', isOptional = false, futureOnly = false, pastOnly = false) => {
    const validator = body(fieldPath)
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .matches(ValidationPatterns.dateFormat)
      .withMessage(ValidationMessages.pattern(fieldName, 'must be in YYYY-MM-DD format'))
      .isISO8601()
      .withMessage(ValidationMessages.invalid(fieldName))
      .custom((value) => {
        const date = new Date(value);
        const now = new Date();
        
        if (futureOnly && date <= now) {
          throw new Error(ValidationMessages.future(fieldName));
        }
        
        if (pastOnly && date >= now) {
          throw new Error(ValidationMessages.past(fieldName));
        }
        
        return true;
      });
      
    return isOptional ? validator.optional() : validator;
  },

  // Passport number validator
  passportNumber: (fieldPath = 'passportInfo.number', fieldName = 'Passport number', isOptional = false) => {
    const validator = body(fieldPath)
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .matches(ValidationPatterns.passportNumber)
      .withMessage(ValidationMessages.pattern(fieldName, 'must be 6-20 alphanumeric characters'));
      
    return isOptional ? validator.optional() : validator;
  },

  // Insurance policy number validator
  policyNumber: (fieldPath = 'insuranceInfo.policyNumber', fieldName = 'Insurance policy number', isOptional = true) => {
    const validator = body(fieldPath)
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .matches(ValidationPatterns.policyNumber)
      .withMessage(ValidationMessages.pattern(fieldName, 'must be 5-50 alphanumeric characters'));
      
    return isOptional ? validator.optional() : validator;
  },

  // Generic string length validator
  stringLength: (fieldPath, fieldName, min = null, max = null, isOptional = false) => {
    const validator = body(fieldPath)
      .if(() => !isOptional)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isLength({ min, max })
      .withMessage(ValidationMessages.length(fieldName, min, max));
      
    return isOptional ? validator.optional() : validator;
  },

  // ID parameter validator
  idParam: (paramName = 'id', fieldName = 'ID') => {
    return param(paramName)
      .notEmpty()
      .withMessage(ValidationMessages.required(fieldName))
      .isInt({ min: 1 })
      .withMessage(ValidationMessages.invalid(fieldName));
  },

  // Query limit validator
  queryLimit: (fieldName = 'limit', max = 100) => {
    return query('limit')
      .optional()
      .isInt({ min: 1, max })
      .withMessage(ValidationMessages.pattern(fieldName, `must be between 1 and ${max}`));
  },

  // Query offset validator
  queryOffset: (fieldName = 'offset') => {
    return query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage(ValidationMessages.pattern(fieldName, 'must be 0 or greater'));
  },

  // Sort field validator
  sortField: (allowedFields, fieldName = 'sortBy') => {
    return query('sortBy')
      .optional()
      .isIn(allowedFields)
      .withMessage(ValidationMessages.pattern(fieldName, `must be one of: ${allowedFields.join(', ')}`));
  },

  // Sort order validator
  sortOrder: (fieldName = 'sortOrder') => {
    return query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage(ValidationMessages.pattern(fieldName, 'must be either "asc" or "desc"'));
  }
};

/**
 * Utility functions for complex validations
 */
const ValidationUtils = {
  // Check if date is within specific range
  dateInRange: (date, minDate, maxDate) => {
    const checkDate = new Date(date);
    const min = minDate ? new Date(minDate) : null;
    const max = maxDate ? new Date(maxDate) : null;
    
    if (min && checkDate < min) return false;
    if (max && checkDate > max) return false;
    
    return true;
  },

  // Check if date is expiring within months
  isExpiringWithinMonths: (date, months = 6) => {
    const expiry = new Date(date);
    const warningDate = new Date();
    warningDate.setMonth(warningDate.getMonth() + months);
    
    return expiry <= warningDate;
  },

  // Sanitize input string
  sanitizeString: (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .trim()
      .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
      .slice(0, 1000); // Limit length
  },

  // Format error response consistently
  formatValidationError: (errors, requestId = 'unknown') => {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return {
      status: 'fail',
      error: {
        message: 'Validation failed',
        details: errorMessages,
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }
};

module.exports = {
  ValidationPatterns,
  ValidationMessages,
  CommonValidators,
  ValidationUtils
};