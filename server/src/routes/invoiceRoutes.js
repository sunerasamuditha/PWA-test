const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const paymentController = require('../controllers/paymentController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { auditInvoiceCreate, auditInvoiceUpdate, auditInvoiceDownload } = require('../middleware/auditLog');
const {
  createInvoiceValidation,
  updateInvoiceValidation,
  getInvoicesValidation,
  invoiceIdValidation,
  invoiceItemIdValidation,
  addInvoiceItemValidation
} = require('../validators/invoiceValidators');

/**
 * Conditional middleware to allow admins OR staff with process_payments permission
 */
const requireAdminOrProcessPayments = (req, res, next) => {
  // Admins and super_admins bypass permission check
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }
  
  // Otherwise require process_payments permission
  return requirePermission('process_payments')(req, res, next);
};

// Create new invoice
router.post(
  '/',
  authenticate,
  requireAdminOrProcessPayments,
  createInvoiceValidation,
  handleValidationErrors,
  invoiceController.createInvoice,
  auditInvoiceCreate
);

// Get invoices (patients can list their own; staff/admin with permission can list all)
router.get(
  '/',
  authenticate,
  getInvoicesValidation,
  handleValidationErrors,
  invoiceController.getInvoices
);

// Get invoice statistics
router.get(
  '/stats',
  authenticate,
  requireAdminOrProcessPayments,
  invoiceController.getInvoiceStats
);

// Get my invoice statistics (patient-specific, no permission required)
router.get(
  '/my/stats',
  authenticate,
  invoiceController.getMyInvoiceStats
);

// Get invoice by ID
router.get(
  '/:id',
  authenticate,
  invoiceIdValidation,
  handleValidationErrors,
  invoiceController.getInvoiceById
);

// Get payments for an invoice (alias for backward compatibility and external consumers)
router.get(
  '/:id/payments',
  authenticate,
  invoiceIdValidation,
  handleValidationErrors,
  paymentController.getPaymentsByInvoice
);

// Update invoice
router.put(
  '/:id',
  authenticate,
  requireAdminOrProcessPayments,
  invoiceIdValidation,
  updateInvoiceValidation,
  handleValidationErrors,
  invoiceController.updateInvoice,
  auditInvoiceUpdate
);

// Add invoice item
router.post(
  '/:id/items',
  authenticate,
  requireAdminOrProcessPayments,
  invoiceIdValidation,
  addInvoiceItemValidation,
  handleValidationErrors,
  invoiceController.addInvoiceItem
);

// Remove invoice item
router.delete(
  '/:id/items/:itemId',
  authenticate,
  requireAdminOrProcessPayments,
  invoiceIdValidation,
  invoiceItemIdValidation,
  handleValidationErrors,
  invoiceController.removeInvoiceItem
);

// Get invoice receipt PDF
router.get(
  '/:id/receipt',
  authenticate,
  invoiceIdValidation,
  handleValidationErrors,
  invoiceController.getInvoiceReceipt,
  auditInvoiceDownload
);

module.exports = router;
