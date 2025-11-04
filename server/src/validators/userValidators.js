const { body, param, query } = require('express-validator');

/**
 * Validation rules for creating a user (admin operation)
 */
const createUserValidation = [
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),

  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .withMessage('Password must contain at least one lowercase letter, uppercase letter, number, and special character'),

  body('role')
    .isIn(['patient', 'partner', 'staff', 'admin', 'super_admin'])
    .withMessage('Role must be one of: patient, partner, staff, admin, super_admin'),

  body('phoneNumber')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),

  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13 || age > 120) {
        throw new Error('Age must be between 13 and 120 years');
      }
      
      return true;
    }),

  body('address')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters')
    .trim(),

  body('emergencyContact')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 255 })
    .withMessage('Emergency contact must be less than 255 characters')
    .trim()
];

/**
 * Validation rules for updating a user (admin operation)
 */
const updateUserValidation = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-'\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters')
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn(['patient', 'partner', 'staff', 'admin', 'super_admin'])
    .withMessage('Role must be one of: patient, partner, staff, admin, super_admin'),

  body('phoneNumber')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),

  body('dateOfBirth')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      if (!value) return true; // Allow null/empty values
      
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13 || age > 120) {
        throw new Error('Age must be between 13 and 120 years');
      }
      
      return true;
    }),

  body('address')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters')
    .trim(),

  body('emergencyContact')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 255 })
    .withMessage('Emergency contact must be less than 255 characters')
    .trim(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

/**
 * Validation for user ID parameter
 */
const userIdValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

/**
 * Validation for search query parameters
 */
const searchValidation = [
  query('q')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be between 2 and 100 characters')
    .trim(),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('role')
    .optional()
    .isIn(['patient', 'partner', 'staff', 'admin', 'super_admin'])
    .withMessage('Role must be one of: patient, partner, staff, admin, super_admin'),

  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false')
];

/**
 * Validation for deactivating a user
 */
const deactivateUserValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

/**
 * Validation for pagination and filtering in getAllUsers
 */
const getAllUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters')
    .trim(),

  query('role')
    .optional()
    .isIn(['patient', 'partner', 'staff', 'admin', 'super_admin'])
    .withMessage('Role must be one of: patient, partner, staff, admin, super_admin'),

  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false')
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  userIdValidation,
  searchValidation,
  deactivateUserValidation,
  getAllUsersValidation
};