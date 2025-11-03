const express = require('express');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  searchUsers
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createUserValidation,
  updateUserValidation,
  userIdValidation,
  searchValidation,
  deactivateUserValidation,
  getAllUsersValidation
} = require('../validators/userValidators');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  auditUserCreate,
  auditUserUpdate,
  auditUserDeactivate,
  auditUserReactivate
} = require('../middleware/auditLog');
const {
  readOperationsLimiter,
  writeOperationsLimiter,
  strictLimiter
} = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  getAllUsersValidation,
  handleValidationErrors,
  getAllUsers
);

/**
 * @route   GET /api/users/search
 * @desc    Search users by name or email (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/search',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  searchValidation,
  handleValidationErrors,
  searchUsers
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get single user by ID (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  userIdValidation,
  handleValidationErrors,
  getUserById
);

/**
 * @route   POST /api/users
 * @desc    Create new user with any role (admin only)
 * @access  Private (admin, super_admin)
 */
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  writeOperationsLimiter,
  createUserValidation,
  handleValidationErrors,
  createUser,
  auditUserCreate
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user (admin only)
 * @access  Private (admin, super_admin)
 */
router.put(
  '/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  writeOperationsLimiter,
  userIdValidation,
  updateUserValidation,
  handleValidationErrors,
  updateUser,
  auditUserUpdate
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Deactivate user (soft delete) (admin only)
 * @access  Private (admin, super_admin)
 */
router.delete(
  '/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  strictLimiter,
  deactivateUserValidation,
  handleValidationErrors,
  deactivateUser,
  auditUserDeactivate
);

/**
 * @route   POST /api/users/:userId/reactivate
 * @desc    Reactivate deactivated user (admin only)
 * @access  Private (admin, super_admin)
 */
router.post(
  '/:userId/reactivate',
  authenticate,
  authorize('admin', 'super_admin'),
  strictLimiter,
  userIdValidation,
  handleValidationErrors,
  reactivateUser,
  auditUserReactivate
);

module.exports = router;