const express = require('express');
const {
  login,
  register,
  logout,
  refresh,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  loginValidation,
  registerValidation,
  refreshValidation,
  updateProfileValidation,
  changePasswordValidation
} = require('../validators/authValidators');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  auditLogin,
  auditLogout,
  auditRegistration,
  auditProfileUpdate,
  auditPasswordChange
} = require('../middleware/auditLog');
const {
  authLimiter,
  passwordChangeLimiter,
  writeOperationsLimiter
} = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  loginValidation,
  handleValidationErrors,
  login,
  auditLogin
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  registerValidation,
  handleValidationErrors,
  register,
  auditRegistration
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  logout,
  auditLogout
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token in cookie or body)
 */
router.post(
  '/refresh',
  refreshValidation,
  handleValidationErrors,
  refresh
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  getMe
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  writeOperationsLimiter,
  updateProfileValidation,
  handleValidationErrors,
  updateProfile,
  auditProfileUpdate
);

/**
 * @route   PUT /api/auth/password-change
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/password-change',
  authenticate,
  passwordChangeLimiter,
  changePasswordValidation,
  handleValidationErrors,
  changePassword,
  auditPasswordChange
);

module.exports = router;