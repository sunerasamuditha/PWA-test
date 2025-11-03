const express = require('express');
const {
  getAuditLogs,
  getUserAuditLogs,
  getEntityAuditLogs,
  getAuditLogById,
  searchAuditLogs,
  getAuditStatistics,
  exportAuditLogs,
  getMyAuditTrail,
  getRecentCriticalActions,
  getFailedLogins
} = require('../controllers/auditLogController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAuditLogsValidation,
  userIdParamValidation,
  logIdParamValidation,
  entityAuditLogsValidation,
  searchAuditLogsValidation,
  auditStatisticsValidation,
  exportAuditLogsValidation,
  myAuditTrailValidation
} = require('../validators/auditLogValidators');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { readOperationsLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/audit-logs
 * @desc    Get all audit logs with filtering (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  getAuditLogsValidation,
  handleValidationErrors,
  getAuditLogs
);

/**
 * @route   GET /api/audit-logs/search
 * @desc    Search audit logs (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/search',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  searchAuditLogsValidation,
  handleValidationErrors,
  searchAuditLogs
);

/**
 * @route   GET /api/audit-logs/statistics
 * @desc    Get audit log statistics (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/statistics',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  auditStatisticsValidation,
  handleValidationErrors,
  getAuditStatistics
);

/**
 * @route   GET /api/audit-logs/export
 * @desc    Export audit logs for compliance (super_admin only)
 * @access  Private (super_admin)
 */
router.get(
  '/export',
  authenticate,
  authorize('super_admin'),
  readOperationsLimiter,
  exportAuditLogsValidation,
  handleValidationErrors,
  exportAuditLogs
);

/**
 * @route   GET /api/audit-logs/recent-critical
 * @desc    Get recent critical actions (deletes and sensitive updates)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/recent-critical',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  getRecentCriticalActions
);

/**
 * @route   GET /api/audit-logs/failed-logins
 * @desc    Get failed login attempts within a time period
 * @access  Private (admin, super_admin)
 */
router.get(
  '/failed-logins',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  getFailedLogins
);

/**
 * @route   GET /api/audit-logs/my-trail
 * @desc    Get current user's audit trail
 * @access  Private (authenticated users)
 */
router.get(
  '/my-trail',
  authenticate,
  readOperationsLimiter,
  myAuditTrailValidation,
  handleValidationErrors,
  getMyAuditTrail
);

/**
 * @route   GET /api/audit-logs/user/:userId
 * @desc    Get audit logs for a specific user (own logs or admin)
 * @access  Private (own logs or admin)
 */
router.get(
  '/user/:userId',
  authenticate,
  readOperationsLimiter,
  userIdParamValidation,
  myAuditTrailValidation,
  handleValidationErrors,
  getUserAuditLogs
);

/**
 * @route   GET /api/audit-logs/entity/:entityType/:entityId
 * @desc    Get audit logs for a specific entity (admin only)
 * @access  Private (admin, super_admin)
 */
router.get(
  '/entity/:entityType/:entityId',
  authenticate,
  authorize('admin', 'super_admin'),
  readOperationsLimiter,
  entityAuditLogsValidation,
  handleValidationErrors,
  getEntityAuditLogs
);

/**
 * @route   GET /api/audit-logs/:logId
 * @desc    Get a single audit log by ID (own logs or admin)
 * @access  Private (own logs or admin)
 */
router.get(
  '/:logId',
  authenticate,
  readOperationsLimiter,
  logIdParamValidation,
  handleValidationErrors,
  getAuditLogById
);

module.exports = router;
