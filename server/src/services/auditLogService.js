const AuditLog = require('../models/AuditLog');

/**
 * AuditLog Service
 * Business logic layer for audit log operations with access control
 */
class AuditLogService {
  /**
   * Get audit logs with access control
   * @param {Object} user - Requesting user
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Audit logs with pagination
   */
  static async getAuditLogs(user, filters = {}) {
    try {
      // Access control: Only admins and super_admins can view all logs
      // Regular users can only view their own logs
      if (!['admin', 'super_admin'].includes(user.role)) {
        filters.userId = user.id; // Restrict to own logs
      }

      return await AuditLog.findAll(filters);
    } catch (error) {
      console.error('Error in getAuditLogs service:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   * @param {Object} requestingUser - User making the request
   * @param {number} targetUserId - User ID to get logs for
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Audit logs
   */
  static async getUserAuditLogs(requestingUser, targetUserId, options = {}) {
    try {
      // Access control: Users can view their own logs, admins can view any
      if (requestingUser.id !== targetUserId && !['admin', 'super_admin'].includes(requestingUser.role)) {
        throw new Error('Unauthorized: Cannot view other users\' audit logs');
      }

      return await AuditLog.findByUser(targetUserId, options);
    } catch (error) {
      console.error('Error in getUserAuditLogs service:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific entity
   * @param {Object} user - Requesting user
   * @param {string} targetEntity - Entity name
   * @param {number} targetId - Entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Audit logs
   */
  static async getEntityAuditLogs(user, targetEntity, targetId, options = {}) {
    try {
      // Only admins can view entity audit logs
      if (!['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required');
      }

      return await AuditLog.findByEntity(targetEntity, targetId, options);
    } catch (error) {
      console.error('Error in getEntityAuditLogs service:', error);
      throw error;
    }
  }

  /**
   * Get a single audit log by ID
   * @param {Object} user - Requesting user
   * @param {number} logId - Audit log ID
   * @returns {Promise<Object>} Audit log
   */
  static async getAuditLogById(user, logId) {
    try {
      const log = await AuditLog.findById(logId);

      if (!log) {
        throw new Error('Audit log not found');
      }

      // Access control: Users can view their own logs, admins can view any
      if (log.userId !== user.id && !['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Cannot view this audit log');
      }

      return log;
    } catch (error) {
      console.error('Error in getAuditLogById service:', error);
      throw error;
    }
  }

  /**
   * Search audit logs
   * @param {Object} user - Requesting user
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  static async searchAuditLogs(user, searchParams = {}) {
    try {
      // Only admins can search all logs
      if (!['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required for search');
      }

      return await AuditLog.searchLogs(searchParams);
    } catch (error) {
      console.error('Error in searchAuditLogs service:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * @param {Object} user - Requesting user
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Statistics
   */
  static async getAuditStatistics(user, options = {}) {
    try {
      // Only admins can view statistics
      if (!['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required');
      }

      return await AuditLog.getStatistics(options);
    } catch (error) {
      console.error('Error in getAuditStatistics service:', error);
      throw error;
    }
  }

  /**
   * Export audit logs (for compliance)
   * @param {Object} user - Requesting user
   * @param {Object} options - Export options
   * @returns {Promise<Array>} Audit logs for export
   */
  static async exportAuditLogs(user, options = {}) {
    try {
      // Only super_admins can export logs
      if (user.role !== 'super_admin') {
        throw new Error('Unauthorized: Super admin access required for export');
      }

      return await AuditLog.exportLogs(options);
    } catch (error) {
      console.error('Error in exportAuditLogs service:', error);
      throw error;
    }
  }

  /**
   * Get user's own audit trail
   * @param {Object} user - Requesting user
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User's audit logs
   */
  static async getMyAuditTrail(user, options = {}) {
    try {
      return await AuditLog.findByUser(user.id, options);
    } catch (error) {
      console.error('Error in getMyAuditTrail service:', error);
      throw error;
    }
  }

  /**
   * Get recent critical actions (admin only)
   * @param {Object} user - Requesting user
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Critical audit logs
   */
  static async getRecentCriticalActions(user, limit = 10) {
    try {
      // Only admins and super_admins can view critical actions
      if (!['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required');
      }

      return await AuditLog.getRecentCriticalActions(limit);
    } catch (error) {
      console.error('Error in getRecentCriticalActions service:', error);
      throw error;
    }
  }

  /**
   * Get failed login attempts (admin only)
   * @param {Object} user - Requesting user
   * @param {string} since - Time period (e.g., '1 HOUR', '24 HOUR')
   * @returns {Promise<Array>} Failed login audit logs
   */
  static async getFailedLogins(user, since = '1 HOUR') {
    try {
      // Only admins and super_admins can view failed logins
      if (!['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Unauthorized: Admin access required');
      }

      return await AuditLog.getFailedLogins(since);
    } catch (error) {
      console.error('Error in getFailedLogins service:', error);
      throw error;
    }
  }
}

module.exports = AuditLogService;
