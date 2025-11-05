const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, authorize, requirePermission, authorizeRoleOrPermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  getShiftsValidation,
  shiftIdValidation,
  updateShiftValidation,
  monthlyReportValidation,
  shiftStatsValidation
} = require('../validators/shiftValidators');
const { auditShiftUpdate, auditShiftReportDownload } = require('../middleware/auditLog');

// Staff routes - view own shifts
router.get(
  '/me',
  authenticate,
  authorize('staff', 'admin', 'super_admin'),
  getShiftsValidation,
  handleValidationErrors,
  shiftController.getMyShifts
);

router.get(
  '/me/active',
  authenticate,
  authorize('staff', 'admin', 'super_admin'),
  shiftController.getMyActiveShift
);

router.get(
  '/me/stats',
  authenticate,
  authorize('staff', 'admin', 'super_admin'),
  shiftStatsValidation,
  handleValidationErrors,
  shiftController.getMyShiftStats
);

// Admin routes - view all shifts (also accessible to staff with manage_users permission)
router.get(
  '/current',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'manage_users'),
  shiftController.getCurrentlyOnShift
);

router.get(
  '/',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'manage_users'),
  getShiftsValidation,
  handleValidationErrors,
  shiftController.getAllShifts
);

router.get(
  '/:id',
  authenticate,
  shiftIdValidation,
  handleValidationErrors,
  shiftController.getShiftById
);

// Admin only - manual shift editing
router.put(
  '/:id',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'manage_users'),
  shiftIdValidation,
  updateShiftValidation,
  handleValidationErrors,
  auditShiftUpdate,
  shiftController.updateShift
);

// Monthly report routes
router.get(
  '/report/monthly',
  authenticate,
  authorize('staff', 'admin', 'super_admin'),
  monthlyReportValidation,
  handleValidationErrors,
  shiftController.getMonthlyReport
);

router.get(
  '/report/monthly/pdf',
  authenticate,
  authorize('staff', 'admin', 'super_admin'),
  monthlyReportValidation,
  handleValidationErrors,
  auditShiftReportDownload,
  shiftController.downloadMonthlyReportPDF
);

// CSV export route (server-side streaming)
router.get(
  '/export/csv',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'manage_users'),
  getShiftsValidation,
  handleValidationErrors,
  shiftController.exportShiftsCSV
);

module.exports = router;
