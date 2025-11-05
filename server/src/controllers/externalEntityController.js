const ExternalEntityService = require('../services/externalEntityService');
const asyncHandler = require('../utils/asyncHandler');

class ExternalEntityController {
  /**
   * Get all external entities
   * GET /api/external-entities
   */
  static getAllEntities = asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search || '',
      type: req.query.type || '',
      sort_by: req.query.sort_by || 'name',
      sort_order: req.query.sort_order || 'ASC'
    };

    const result = await ExternalEntityService.getAllEntities(filters);

    res.status(200).json({
      success: true,
      message: 'External entities retrieved successfully',
      data: result
    });
  });

  /**
   * Get entity by ID
   * GET /api/external-entities/:id
   */
  static getEntityById = asyncHandler(async (req, res) => {
    const entityId = parseInt(req.params.id);

    const entity = await ExternalEntityService.getEntityById(entityId);

    res.status(200).json({
      success: true,
      message: 'Entity retrieved successfully',
      data: { entity }
    });
  });

  /**
   * Create new external entity
   * POST /api/external-entities
   */
  static createEntity = asyncHandler(async (req, res) => {
    const { name, type, contact_info } = req.body;

    const entity = await ExternalEntityService.createEntity(
      { name, type, contact_info },
      req.user.id
    );

    // Store for audit logging
    res.locals.entity = entity;

    res.status(201).json({
      success: true,
      message: 'External entity created successfully',
      data: { entity }
    });
  });

  /**
   * Update external entity
   * PUT /api/external-entities/:id
   */
  static updateEntity = asyncHandler(async (req, res) => {
    const entityId = parseInt(req.params.id);
    
    // Capture before state
    const beforeEntity = await ExternalEntityService.getEntityById(entityId);
    res.locals.beforeData = beforeEntity;
    
    const { name, type, contact_info } = req.body;

    const entity = await ExternalEntityService.updateEntity(
      entityId,
      { name, type, contact_info },
      req.user.id
    );

    // Capture after state and store for audit logging
    res.locals.afterData = entity;
    res.locals.entity = entity;

    res.status(200).json({
      success: true,
      message: 'Entity updated successfully',
      data: { entity }
    });
  });

  /**
   * Delete external entity
   * DELETE /api/external-entities/:id
   */
  static deleteEntity = asyncHandler(async (req, res) => {
    const entityId = parseInt(req.params.id);

    // Capture before state (what's being deleted)
    const entity = await ExternalEntityService.getEntityById(entityId);
    res.locals.beforeData = entity;
    res.locals.entity = entity;

    await ExternalEntityService.deleteEntity(entityId, req.user.id);

    // Mark as deleted in after state
    res.locals.afterData = { deleted: true, deletedAt: new Date().toISOString() };

    res.status(200).json({
      success: true,
      message: 'Entity deleted successfully'
    });
  });

  /**
   * Get entities by type
   * GET /api/external-entities/type/:type
   */
  static getEntitiesByType = asyncHandler(async (req, res) => {
    const { type } = req.params;

    const entities = await ExternalEntityService.getEntitiesByType(type);

    res.status(200).json({
      success: true,
      message: 'Entities retrieved successfully',
      data: { entities }
    });
  });

  /**
   * Search entities
   * GET /api/external-entities/search
   */
  static searchEntities = asyncHandler(async (req, res) => {
    const searchTerm = req.query.q || req.query.search || '';

    const entities = await ExternalEntityService.searchEntities(searchTerm);

    res.status(200).json({
      success: true,
      message: 'Search results retrieved successfully',
      data: { entities }
    });
  });

  /**
   * Get entity statistics
   * GET /api/external-entities/stats
   */
  static getEntityStats = asyncHandler(async (req, res) => {
    const stats = await ExternalEntityService.getEntityStats();

    res.status(200).json({
      success: true,
      message: 'Entity statistics retrieved successfully',
      data: stats
    });
  });
}

module.exports = ExternalEntityController;
