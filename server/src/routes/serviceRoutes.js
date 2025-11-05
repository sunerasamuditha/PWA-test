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
  requireAdminOrProcessPayments,
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
  requireAdminOrProcessPayments,
  createServiceValidation,
  handleValidationErrors,
  serviceController.createService,
  auditServiceCreate
);

// Update service
router.put(
  '/:id',
  authenticate,
  requireAdminOrProcessPayments,
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
  requireAdminOrProcessPayments,
  serviceIdValidation,
  handleValidationErrors,
  serviceController.deactivateService,
  auditServiceUpdate
);

// Reactivate service
router.post(
  '/:id/reactivate',
  authenticate,
  requireAdminOrProcessPayments,
  serviceIdValidation,
  handleValidationErrors,
  serviceController.reactivateService,
  auditServiceUpdate
);

module.exports = router;
