const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { auditPaymentCreate } = require('../middleware/auditLog');
const {
  recordPaymentValidation,
  getPaymentsValidation,
  paymentIdValidation,
  generateReportValidation
} = require('../validators/paymentValidators');
const { invoiceIdParamValidation } = require('../validators/invoiceValidators');

// Record new payment
router.post(
  '/',
  authenticate,
  requirePermission('process_payments'),
  recordPaymentValidation,
  handleValidationErrors,
  paymentController.recordPayment,
  auditPaymentCreate
);

// Get payments (patients can list their own; staff/admin with permission can list all)
router.get(
  '/',
  authenticate,
  getPaymentsValidation,
  handleValidationErrors,
  paymentController.getPayments
);

// Get payment statistics
router.get(
  '/stats',
  authenticate,
  requirePermission('process_payments'),
  paymentController.getPaymentStats
);

// Generate payment report PDF
router.get(
  '/report',
  authenticate,
  generateReportValidation,
  handleValidationErrors,
  paymentController.generatePaymentReport
);

// Get payment by ID
router.get(
  '/:id',
  authenticate,
  paymentIdValidation,
  handleValidationErrors,
  paymentController.getPaymentById
);

// Get payments by invoice
router.get(
  '/invoice/:invoiceId',
  authenticate,
  invoiceIdParamValidation,
  handleValidationErrors,
  paymentController.getPaymentsByInvoice
);

module.exports = router;
