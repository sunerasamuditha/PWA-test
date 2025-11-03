const { body, param, query } = require('express-validator');

/**
 * Validation rules for partner registration
 */
const validatePartnerRegistration = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  
  body('partnerType')
    .notEmpty()
    .withMessage('Partner type is required')
    .isIn(['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'])
    .withMessage('Partner type must be guide, driver, hotel, villa, guest_house, or other'),
  
  body('companyName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name must not exceed 200 characters'),
  
  body('businessLicense')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Business license must not exceed 100 characters'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters')
];

/**
 * Validation rules for partner profile update
 */
const validatePartnerProfileUpdate = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  
  body('companyName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name must not exceed 200 characters'),
  
  body('businessLicense')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Business license must not exceed 100 characters'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  
  body('partnerType')
    .optional()
    .isIn(['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'])
    .withMessage('Partner type must be guide, driver, hotel, villa, guest_house, or other')
];

/**
 * Validation rules for partner status update (admin only)
 */
const validatePartnerStatusUpdate = [
  param('partnerId')
    .isInt({ min: 1 })
    .withMessage('Valid partner ID is required'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'inactive', 'pending'])
    .withMessage('Status must be active, inactive, or pending')
];

/**
 * Validation rules for getting partners (admin only)
 */
const validateGetPartners = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending'])
    .withMessage('Status must be active, inactive, or pending'),
  
  query('type')
    .optional()
    .isIn(['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'])
    .withMessage('Type must be guide, driver, hotel, villa, guest_house, or other')
];

/**
 * Validation rules for getting partner referrals
 */
const validateGetPartnerReferrals = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['completed', 'pending', 'cancelled'])
    .withMessage('Status must be completed, pending, or cancelled')
];

/**
 * Validation rules for getting commission history
 */
const validateGetCommissionHistory = [
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
  validatePartnerRegistration,
  validatePartnerProfileUpdate,
  validatePartnerStatusUpdate,
  validateGetPartners,
  validateGetPartnerReferrals,
  validateGetCommissionHistory
};