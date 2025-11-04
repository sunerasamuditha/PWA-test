const { body, validationResult } = require('express-validator');

/**
 * Validation middleware for staff creation
 */
const validateStaffCreate = [
  // User data validation
  body('userData.fullName')
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('userData.email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('userData.phoneNumber')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Valid phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),

  body('userData.password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('userData.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required (YYYY-MM-DD format)')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 100) {
        throw new Error('Staff member must be between 18 and 100 years old');
      }
      return true;
    }),

  body('userData.address')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Address must not exceed 255 characters'),

  body('userData.emergencyContact')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Emergency contact must not exceed 100 characters'),

  // Staff data validation
  body('staffData.staff_role')
    .notEmpty()
    .withMessage('Staff role is required')
    .isIn(['front_desk', 'back_office', 'admin'])
    .withMessage('Staff role must be one of: front_desk, back_office, admin'),

  body('staffData.permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const allowedPermissions = [
        'manage_appointments',
        'process_payments',
        'view_reports',
        'manage_documents',
        'manage_users',
        'system_settings'
      ];
      
      const invalidPermissions = permissions.filter(
        permission => !allowedPermissions.includes(permission)
      );
      
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
      
      return true;
    }),

  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Validation middleware for staff updates
 */
const validateStaffUpdate = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Valid phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required (YYYY-MM-DD format)')
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 18 || age > 100) {
          throw new Error('Staff member must be between 18 and 100 years old');
        }
      }
      return true;
    }),

  body('address')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Address must not exceed 255 characters'),

  body('emergencyContact')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Emergency contact must not exceed 100 characters'),

  body('staff_role')
    .optional()
    .isIn(['front_desk', 'back_office', 'admin'])
    .withMessage('Staff role must be one of: front_desk, back_office, admin'),

  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      if (permissions) {
        const allowedPermissions = [
          'manage_appointments',
          'process_payments',
          'view_reports',
          'manage_documents',
          'manage_users',
          'system_settings'
        ];
        
        const invalidPermissions = permissions.filter(
          permission => !allowedPermissions.includes(permission)
        );
        
        if (invalidPermissions.length > 0) {
          throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
      }
      return true;
    }),

  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Validation middleware for staff permissions updates
 */
const validateStaffPermissions = [
  body('permissions')
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((permissions) => {
      const allowedPermissions = [
        'manage_appointments',
        'process_payments',
        'view_reports',
        'manage_documents',
        'manage_users',
        'system_settings'
      ];
      
      const invalidPermissions = permissions.filter(
        permission => !allowedPermissions.includes(permission)
      );
      
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
      
      return true;
    }),

  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * Validation middleware for staff profile updates (self-service)
 */
const validateStaffProfileUpdate = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('phoneNumber')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Valid phone number is required')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required (YYYY-MM-DD format)')
    .custom((value) => {
      if (value) {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 18 || age > 100) {
          throw new Error('Age must be between 18 and 100 years');
        }
      }
      return true;
    }),

  body('address')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Address must not exceed 255 characters'),

  body('emergencyContact')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Emergency contact must not exceed 100 characters'),

  // Ensure staff cannot update sensitive fields
  body('staff_role')
    .not()
    .exists()
    .withMessage('Staff role cannot be updated through profile'),

  body('permissions')
    .not()
    .exists()
    .withMessage('Permissions cannot be updated through profile'),

  body('role')
    .not()
    .exists()
    .withMessage('User role cannot be updated through profile'),

  // Error handling middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateStaffCreate,
  validateStaffUpdate,
  validateStaffPermissions,
  validateStaffProfileUpdate
};