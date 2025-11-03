const { body, check } = require('express-validator');

/**
 * Validation rules for user login
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .notEmpty()
    .withMessage('Email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for user registration
 */
const registerValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
    .notEmpty()
    .withMessage('Full name is required'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters')
    .notEmpty()
    .withMessage('Email is required'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('role')
    .isIn(['patient', 'partner'])
    .withMessage('Role must be either patient or partner for public registration')
    .notEmpty()
    .withMessage('Role is required'),
  
  // Partner-specific validation
  body('partnerType')
    .if(body('role').equals('partner'))
    .notEmpty()
    .withMessage('Partner type is required for partner registration')
    .isIn(['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'])
    .withMessage('Partner type must be guide, driver, hotel, villa, guest_house, or other'),
  
  body('companyName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name must not exceed 200 characters'),
  
  body('businessLicense')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Business license must not exceed 100 characters'),
  
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),
  
  body('dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Date of birth must be a valid date in YYYY-MM-DD format')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        throw new Error('Age must be between 13 and 120 years');
      }
      
      return true;
    }),
  
  body('address')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  
  body('emergencyContact')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Emergency contact must not exceed 255 characters'),
  
  body('referredBy')
    .optional()
    .isUUID()
    .withMessage('Invalid referral code format')
];

/**
 * Validation rules for token refresh
 */
const refreshValidation = [
  body('refreshToken')
    .optional({ checkFalsy: true })
    .isJWT()
    .withMessage('Invalid refresh token format')
];

/**
 * Validation rules for profile update
 */
const updateProfileValidation = [
  body('fullName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),
  
  body('dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Date of birth must be a valid date in YYYY-MM-DD format')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 120) {
        throw new Error('Age must be between 13 and 120 years');
      }
      
      return true;
    }),
  
  body('address')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  
  body('emergencyContact')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Emergency contact must not exceed 255 characters')
];

/**
 * Validation rules for password change
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .notEmpty()
    .withMessage('New password is required'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

/**
 * Validation rules for email verification
 */
const emailValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .notEmpty()
    .withMessage('Email is required')
];

/**
 * Validation rules for password reset request
 */
const resetPasswordRequestValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .notEmpty()
    .withMessage('Email is required')
];

/**
 * Validation rules for password reset
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid reset token format'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

module.exports = {
  loginValidation,
  registerValidation,
  refreshValidation,
  updateProfileValidation,
  changePasswordValidation,
  emailValidation,
  resetPasswordRequestValidation,
  resetPasswordValidation
};