const AuditLogService = require('../services/auditLogService');

/**
 * Helper function to normalize query parameters to arrays
 * Handles both array syntax (action[]=value1&action[]=value2) and comma-separated (action=value1,value2)
 */
const normalizeToArray = (value) => {
  if (!value) return null;
  
  // Already an array
  if (Array.isArray(value)) return value;
  
  // Comma-separated string
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }
  
  // Single value - return as array
  return [value];
};

/**
 * Get all audit logs with filtering
 * @route GET /api/audit-logs
 * @access Private (admin, super_admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const filters = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: normalizeToArray(req.query.action),
      targetEntity: normalizeToArray(req.query.targetEntity),
      targetId: req.query.targetId ? parseInt(req.query.targetId) : null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      sortBy: req.query.sortBy || 'timestamp',
      sortOrder: req.query.sortOrder || 'DESC'
    };

    const result = await AuditLogService.getAuditLogs(req.user, filters);

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in getAuditLogs controller:', error);
    next(error);
  }
};

/**
 * Get audit logs for a specific user
 * @route GET /api/audit-logs/user/:userId
 * @access Private (own logs or admin)
 */
const getUserAuditLogs = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const options = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const result = await AuditLogService.getUserAuditLogs(req.user, targetUserId, options);

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in getUserAuditLogs controller:', error);
    next(error);
  }
};

/**
 * Get audit logs for a specific entity
 * @route GET /api/audit-logs/entity/:entityType/:entityId
 * @access Private (admin, super_admin)
 */
const getEntityAuditLogs = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const options = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const result = await AuditLogService.getEntityAuditLogs(
      req.user,
      entityType,
      parseInt(entityId),
      options
    );

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in getEntityAuditLogs controller:', error);
    next(error);
  }
};

/**
 * Get a single audit log by ID
 * @route GET /api/audit-logs/:logId
 * @access Private (own logs or admin)
 */
const getAuditLogById = async (req, res, next) => {
  try {
    const logId = parseInt(req.params.logId);
    const log = await AuditLogService.getAuditLogById(req.user, logId);

    res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error in getAuditLogById controller:', error);
    next(error);
  }
};

/**
 * Search audit logs
 * @route GET /api/audit-logs/search
 * @access Private (admin, super_admin)
 */
const searchAuditLogs = async (req, res, next) => {
  try {
    const searchParams = {
      searchTerm: req.query.q || '',
      action: normalizeToArray(req.query.action),
      targetEntity: normalizeToArray(req.query.targetEntity),
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };

    const result = await AuditLogService.searchAuditLogs(req.user, searchParams);

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in searchAuditLogs controller:', error);
    next(error);
  }
};

/**
 * Get audit log statistics
 * @route GET /api/audit-logs/statistics
 * @access Private (admin, super_admin)
 */
const getAuditStatistics = async (req, res, next) => {
  try {
    const options = {
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const stats = await AuditLogService.getAuditStatistics(req.user, options);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in getAuditStatistics controller:', error);
    next(error);
  }
};

/**
 * Export audit logs (CSV/JSON)
 * @route GET /api/audit-logs/export
 * @access Private (super_admin only)
 */
const exportAuditLogs = async (req, res, next) => {
  try {
    const options = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: normalizeToArray(req.query.action),
      targetEntity: normalizeToArray(req.query.targetEntity),
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const logs = await AuditLogService.exportAuditLogs(req.user, options);

    // Return as JSON (client can convert to CSV)
    res.status(200).json({
      success: true,
      data: logs,
      count: logs.length,
      exportDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in exportAuditLogs controller:', error);
    next(error);
  }
};

/**
 * Get current user's audit trail
 * @route GET /api/audit-logs/my-trail
 * @access Private (authenticated users)
 */
const getMyAuditTrail = async (req, res, next) => {
  try {
    const options = {
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };

    const result = await AuditLogService.getMyAuditTrail(req.user, options);

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error in getMyAuditTrail controller:', error);
    next(error);
  }
};

/**
 * Get recent critical actions
 * @route GET /api/audit-logs/recent-critical
 * @access Private (admin, super_admin)
 */
const getRecentCriticalActions = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const logs = await AuditLogService.getRecentCriticalActions(req.user, limit);

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error in getRecentCriticalActions controller:', error);
    next(error);
  }
};

/**
 * Get failed login attempts
 * @route GET /api/audit-logs/failed-logins
 * @access Private (admin, super_admin)
 */
const getFailedLogins = async (req, res, next) => {
  try {
    const since = req.query.since || '1 HOUR';
    const logs = await AuditLogService.getFailedLogins(req.user, since);

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error in getFailedLogins controller:', error);
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getUserAuditLogs,
  getEntityAuditLogs,
  getAuditLogById,
  searchAuditLogs,
  getAuditStatistics,
  exportAuditLogs,
  getMyAuditTrail,
  getRecentCriticalActions,
  getFailedLogins
};
