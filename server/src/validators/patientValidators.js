const { body, query, validationResult } = require('express-validator');

/**
 * Validation rules for patient profile operations
 */
const patientProfileValidation = [
  // Passport information validation (optional object)
  body('passportInfo')
    .optional()
    .isObject()
    .withMessage('Passport info must be an object'),
    
  body('passportInfo.number')
    .optional()
    .isLength({ min: 6, max: 20 })
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Passport number must be 6-20 alphanumeric characters'),
    
  body('passportInfo.country')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Passport country must be 2-100 characters'),
    
  body('passportInfo.expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Passport expiry date must be in ISO8601 format')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Passport expiry date must be in the future');
      }
      return true;
    }),
    
  body('passportInfo.issueDate')
    .optional()
    .isISO8601()
    .withMessage('Passport issue date must be in ISO8601 format')
    .custom(value => {
      if (new Date(value) > new Date()) {
        throw new Error('Passport issue date cannot be in the future');
      }
      return true;
    }),
    
  body('passportInfo.placeOfIssue')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Place of issue must not exceed 100 characters'),

  // Insurance information validation (optional object)
  body('insuranceInfo')
    .optional()
    .isObject()
    .withMessage('Insurance info must be an object'),
    
  body('insuranceInfo.provider')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Insurance provider must be 2-200 characters'),
    
  body('insuranceInfo.policyNumber')
    .optional()
    .isLength({ min: 5, max: 50 })
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Insurance policy number must be 5-50 alphanumeric characters'),
    
  body('insuranceInfo.coverageType')
    .optional()
    .isIn(['comprehensive', 'basic', 'emergency'])
    .withMessage('Coverage type must be comprehensive, basic, or emergency'),
    
  body('insuranceInfo.expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Insurance expiry date must be in ISO8601 format'),
    
  // Insurance contact info nested validation
  body('insuranceInfo.contactInfo')
    .optional()
    .isObject()
    .withMessage('Insurance contact info must be an object'),
    
  body('insuranceInfo.contactInfo.phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]{10,20}$/)
    .withMessage('Insurance contact phone must be a valid phone number'),
    
  body('insuranceInfo.contactInfo.email')
    .optional()
    .isEmail()
    .withMessage('Insurance contact email must be valid'),
    
  body('insuranceInfo.contactInfo.emergencyHotline')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]{10,20}$/)
    .withMessage('Emergency hotline must be a valid phone number'),

  // Current address validation
  body('currentAddress')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Current address must not exceed 500 characters'),

  // User fields that can also be updated in patient profile
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .matches(/^[A-Za-z\s\-\.]+$/)
    .withMessage('Full name must be 2-100 characters and contain only letters, spaces, hyphens, and dots'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]{10,20}$/)
    .withMessage('Phone number must be a valid format'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be in ISO8601 format')
    .custom(value => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 0 || age > 150) {
        throw new Error('Date of birth must result in a valid age (0-150 years)');
      }
      return true;
    }),

  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),

  body('emergencyContact')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Emergency contact must not exceed 200 characters')
];

/**
 * Validation rules for updating patient profile (same as create but more lenient)
 */
const updatePatientValidation = [
  // Same as patientProfileValidation since all fields are optional
  ...patientProfileValidation
];

/**
 * Validation rules for health history query parameters
 */
const healthHistoryQueryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO8601 format'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO8601 format')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
    
  query('type')
    .optional()
    .isIn(['appointment', 'invoice', 'document'])
    .withMessage('Type must be appointment, invoice, or document'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt()
];

/**
 * Custom validator for nested JSON structures
 */
const validateNestedObject = (fieldPath, validationRules) => {
  return body(fieldPath)
    .optional()
    .custom((value, { req }) => {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`${fieldPath} must be an object`);
      }
      
      // Apply custom validation rules
      for (const [key, rule] of Object.entries(validationRules)) {
        if (value[key] !== undefined) {
          if (!rule(value[key])) {
            throw new Error(`${fieldPath}.${key} is invalid`);
          }
        }
      }
      
      return true;
    });
};

module.exports = {
  patientProfileValidation,
  updatePatientValidation,
  healthHistoryQueryValidation,
  validateNestedObject
};