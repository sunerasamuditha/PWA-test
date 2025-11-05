const express = require('express');
const router = express.Router();
const AccountsPayableController = require('../controllers/accountsPayableController');
const { authenticate, authorize, authorizeRoleOrPermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  auditPayableCreate,
  auditPayableUpdate,
  auditPayableMarkPaid
} = require('../middleware/auditLog');
const {
  createPayableValidation,
  updatePayableValidation,
  markAsPaidValidation,
  getPayablesValidation,
  payableIdValidation,
  entityIdParamValidation,
  dueSoonValidation
} = require('../validators/accountsPayableValidators');

// POST /api/accounts-payable - Create new payable
router.post(
  '/',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  createPayableValidation,
  handleValidationErrors,
  AccountsPayableController.createPayable,
  auditPayableCreate
);

// GET /api/accounts-payable - Get all payables with filters
router.get(
  '/',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  getPayablesValidation,
  handleValidationErrors,
  AccountsPayableController.getAllPayables
);

// GET /api/accounts-payable/stats - Get payable statistics
router.get(
  '/stats',
  authenticate,
  authorize('admin', 'super_admin'),
  AccountsPayableController.getPayableStats
);

// GET /api/accounts-payable/overdue - Get overdue payables
router.get(
  '/overdue',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  AccountsPayableController.getOverduePayables
);

// GET /api/accounts-payable/due-soon - Get payables due soon
router.get(
  '/due-soon',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  dueSoonValidation,
  handleValidationErrors,
  AccountsPayableController.getDueSoonPayables
);

// GET /api/accounts-payable/entity/:entityId - Get payables by entity
router.get(
  '/entity/:entityId',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  entityIdParamValidation,
  handleValidationErrors,
  AccountsPayableController.getPayablesByEntity
);

// GET /api/accounts-payable/:id - Get payable by ID
router.get(
  '/:id',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  payableIdValidation,
  handleValidationErrors,
  AccountsPayableController.getPayableById
);

// PUT /api/accounts-payable/:id - Update payable (admin only for arbitrary updates)
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  payableIdValidation,
  updatePayableValidation,
  handleValidationErrors,
  AccountsPayableController.updatePayable,
  auditPayableUpdate
);

// PUT /api/accounts-payable/:id/mark-paid - Mark payable as paid
router.put(
  '/:id/mark-paid',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  payableIdValidation,
  markAsPaidValidation,
  handleValidationErrors,
  AccountsPayableController.markAsPaid,
  auditPayableMarkPaid
);

module.exports = router;
