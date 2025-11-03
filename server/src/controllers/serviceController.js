const serviceService = require('../services/serviceService');

/**
 * Get all services
 */
const getAllServices = async (req, res, next) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      category: req.query.category,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : null,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order
    };

    const result = await serviceService.getAllServices(filters);

    res.json({
      success: true,
      message: 'Services retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active services
 */
const getActiveServices = async (req, res, next) => {
  try {
    const category = req.query.category;
    const services = await serviceService.getActiveServices(category);

    res.json({
      success: true,
      message: 'Active services retrieved successfully',
      data: { services }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service by ID
 */
const getServiceById = async (req, res, next) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await serviceService.getServiceById(serviceId);

    res.json({
      success: true,
      message: 'Service retrieved successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new service
 */
const createService = async (req, res, next) => {
  try {
    const serviceData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      service_category: req.body.service_category,
      is_active: req.body.is_active !== undefined ? req.body.is_active : true
    };

    const service = await serviceService.createService(serviceData, req.user.id);

    // Store for audit logging
    res.locals.auditData = {
      service,
      action: 'create'
    };

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update service
 */
const updateService = async (req, res, next) => {
  try {
    const serviceId = parseInt(req.params.id);
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      service_category: req.body.service_category,
      is_active: req.body.is_active
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const service = await serviceService.updateService(serviceId, updateData, req.user.id);

    // Store for audit logging
    res.locals.auditData = {
      service,
      action: 'update'
    };

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate service
 */
const deactivateService = async (req, res, next) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await serviceService.deactivateService(serviceId);

    // Store for audit logging
    res.locals.auditData = {
      service
    };

    res.json({
      success: true,
      message: 'Service deactivated successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivate service
 */
const reactivateService = async (req, res, next) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await serviceService.reactivateService(serviceId);

    // Store for audit logging
    res.locals.auditData = {
      service
    };

    res.json({
      success: true,
      message: 'Service reactivated successfully',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service statistics
 */
const getServiceStats = async (req, res, next) => {
  try {
    const stats = await serviceService.getServiceStats();

    res.json({
      success: true,
      message: 'Service statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllServices,
  getActiveServices,
  getServiceById,
  createService,
  updateService,
  deactivateService,
  reactivateService,
  getServiceStats
};
