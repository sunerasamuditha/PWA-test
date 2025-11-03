const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, requirePermission, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { auditServiceCreate, auditServiceUpdate } = require('../middleware/auditLog');
const {
  createServiceValidation,
  updateServiceValidation,
  getServicesValidation,
  serviceIdValidation
} = require('../validators/serviceValidators');

// Get all services
router.get(
  '/',
  authenticate,
  getServicesValidation,
  handleValidationErrors,
  serviceController.getAllServices
);

// Get active services (for invoice creation)
router.get(
  '/active',
  authenticate,
  serviceController.getActiveServices
);

// Get service statistics
router.get(
  '/stats',
  authenticate,
  requirePermission('process_payments'),
  serviceController.getServiceStats
);

// Get service by ID
router.get(
  '/:id',
  authenticate,
  serviceIdValidation,
  handleValidationErrors,
  serviceController.getServiceById
);

// Create new service
router.post(
  '/',
  authenticate,
  requirePermission('process_payments'),
  createServiceValidation,
  handleValidationErrors,
  serviceController.createService,
  auditServiceCreate
);

// Update service
router.put(
  '/:id',
  authenticate,
  requirePermission('process_payments'),
  serviceIdValidation,
  updateServiceValidation,
  handleValidationErrors,
  serviceController.updateService,
  auditServiceUpdate
);

// Deactivate service
router.delete(
  '/:id',
  authenticate,
  requirePermission('process_payments'),
  serviceIdValidation,
  handleValidationErrors,
  serviceController.deactivateService,
  auditServiceUpdate
);

// Reactivate service
router.post(
  '/:id/reactivate',
  authenticate,
  requirePermission('process_payments'),
  serviceIdValidation,
  handleValidationErrors,
  serviceController.reactivateService,
  auditServiceUpdate
);

module.exports = router;
