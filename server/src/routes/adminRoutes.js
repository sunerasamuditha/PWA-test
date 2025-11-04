const express = require('express');
const AdminController = require('../controllers/adminController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { auditAccess } = require('../middleware/auditLog');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

/**
 * @route GET /api/admin/dashboard/stats
 * @desc Get dashboard statistics
 * @access Admin only
 */
router.get('/dashboard/stats',
  auditAccess('Admin'),
  AdminController.getDashboardStats
);

/**
 * @route GET /api/admin/analytics/revenue
 * @desc Get revenue analytics
 * @query period - Time period (week, month, quarter, year)
 * @access Admin only
 */
router.get('/analytics/revenue',
  requirePermission(['view_reports']),
  auditAccess('Admin'),
  AdminController.getRevenueAnalytics
);

/**
 * @route GET /api/admin/analytics/users
 * @desc Get user activity analytics
 * @query period - Time period (week, month, quarter, year)
 * @access Admin only
 */
router.get('/analytics/users',
  requirePermission(['view_reports']),
  auditAccess('Admin'),
  AdminController.getUserActivityAnalytics
);

/**
 * @route GET /api/admin/system/health
 * @desc Get system health metrics
 * @access Admin only
 */
router.get('/system/health',
  requirePermission(['system_settings']),
  auditAccess('Admin'),
  AdminController.getSystemHealth
);

/**
 * @route GET /api/admin/overview
 * @desc Get comprehensive admin overview
 * @access Admin only
 */
router.get('/overview',
  auditAccess('Admin'),
  AdminController.getAdminOverview
);

/**
 * @route GET /api/admin/export
 * @desc Export data for reporting
 * @query type - Export type (revenue, users, dashboard)
 * @query format - Export format (json, csv)
 * @query period - Time period for analytics data
 * @access Admin with view_reports permission
 */
router.get('/export',
  requirePermission(['view_reports']),
  auditAccess('Admin'),
  AdminController.exportData
);

module.exports = router;