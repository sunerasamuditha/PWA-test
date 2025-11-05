const express = require('express');
const router = express.Router();
const ExternalEntityController = require('../controllers/externalEntityController');
const { authenticate, authorize, authorizeRoleOrPermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/errorHandler');
const {
  auditEntityCreate,
  auditEntityUpdate,
  auditEntityDelete
} = require('../middleware/auditLog');
const {
  createEntityValidation,
  updateEntityValidation,
  getEntitiesValidation,
  entityIdValidation,
  entityTypeValidation
} = require('../validators/externalEntityValidators');

// GET /api/external-entities - Get all entities with filters
router.get(
  '/',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  getEntitiesValidation,
  handleValidationErrors,
  ExternalEntityController.getAllEntities
);

// GET /api/external-entities/stats - Get entity statistics
router.get(
  '/stats',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  ExternalEntityController.getEntityStats
);

// GET /api/external-entities/search - Search entities by name
router.get(
  '/search',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  ExternalEntityController.searchEntities
);

// GET /api/external-entities/type/:type - Get entities by type
router.get(
  '/type/:type',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  entityTypeValidation,
  handleValidationErrors,
  ExternalEntityController.getEntitiesByType
);

// GET /api/external-entities/:id - Get entity by ID
router.get(
  '/:id',
  authenticate,
  authorizeRoleOrPermission(['admin', 'super_admin'], 'process_payments'),
  entityIdValidation,
  handleValidationErrors,
  ExternalEntityController.getEntityById
);

// POST /api/external-entities - Create new entity
router.post(
  '/',
  authenticate,
  authorize('admin', 'super_admin'),
  createEntityValidation,
  handleValidationErrors,
  ExternalEntityController.createEntity,
  auditEntityCreate
);

// PUT /api/external-entities/:id - Update entity
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  entityIdValidation,
  updateEntityValidation,
  handleValidationErrors,
  ExternalEntityController.updateEntity,
  auditEntityUpdate
);

// DELETE /api/external-entities/:id - Delete entity
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  entityIdValidation,
  handleValidationErrors,
  ExternalEntityController.deleteEntity,
  auditEntityDelete
);

module.exports = router;
