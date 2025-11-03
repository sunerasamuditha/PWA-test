const { executeQuery } = require('../config/database');

/**
 * AuditLog Model
 * Provides methods to query audit logs with filtering, pagination, and search
 */
class AuditLog {
  /**
   * Find all audit logs with filtering and pagination
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Records per page
   * @param {number} options.userId - Filter by user ID
   * @param {string|Array<string>} options.action - Filter by action (single or array of actions)
   * @param {string|Array<string>} options.targetEntity - Filter by target entity (single or array)
   * @param {number} options.targetId - Filter by target ID
   * @param {string} options.startDate - Start date (ISO format)
   * @param {string} options.endDate - End date (ISO format)
   * @param {string} options.sortBy - Sort column (timestamp, action, target_entity)
   * @param {string} options.sortOrder - Sort order (ASC, DESC)
   * @returns {Promise<Object>} Audit logs with pagination info
   */
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        userId = null,
        action = null,
        targetEntity = null,
        targetId = null,
        startDate = null,
        endDate = null,
        sortBy = 'timestamp',
        sortOrder = 'DESC'
      } = options;

      // Validate and sanitize inputs
      const allowedSortColumns = ['timestamp', 'action', 'target_entity', 'user_id'];
      const allowedSortOrders = ['ASC', 'DESC'];
      const allowedActions = ['create', 'update', 'delete', 'login', 'logout', 'access'];

      const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'timestamp';
      const safeSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Build WHERE clause
      const whereClauses = [];
      const queryParams = [];

      if (userId) {
        whereClauses.push('al.user_id = ?');
        queryParams.push(userId);
      }

      // Handle action as array or single value
      if (action) {
        const actions = Array.isArray(action) ? action : [action];
        const validActions = actions.filter(a => allowedActions.includes(a));
        
        if (validActions.length > 0) {
          if (validActions.length === 1) {
            whereClauses.push('al.action = ?');
            queryParams.push(validActions[0]);
          } else {
            const placeholders = validActions.map(() => '?').join(',');
            whereClauses.push(`al.action IN (${placeholders})`);
            queryParams.push(...validActions);
          }
        }
      }

      // Handle targetEntity as array or single value
      if (targetEntity) {
        const entities = Array.isArray(targetEntity) ? targetEntity : [targetEntity];
        
        if (entities.length === 1) {
          whereClauses.push('al.target_entity = ?');
          queryParams.push(entities[0]);
        } else {
          const placeholders = entities.map(() => '?').join(',');
          whereClauses.push(`al.target_entity IN (${placeholders})`);
          queryParams.push(...entities);
        }
      }

      if (targetId) {
        whereClauses.push('al.target_id = ?');
        queryParams.push(targetId);
      }

      if (startDate) {
        whereClauses.push('al.timestamp >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereClauses.push('al.timestamp <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      // Count total records
      const countQuery = `
        SELECT COUNT(*) as total
        FROM Audit_Logs al
        ${whereClause}
      `;

      const [countResult] = await executeQuery(countQuery, queryParams);
      const total = countResult[0].total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const query = `
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), parseInt(offset));
      const [rows] = await executeQuery(query, queryParams);

      const logs = rows.map(row => this._transformAuditLog(row));

      return {
        logs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('Error finding audit logs:', error);
      throw error;
    }
  }

  /**
   * Find audit logs by user ID
   * @param {number} userId - User ID
   * @param {Object} options - Query options (page, limit, startDate, endDate)
   * @returns {Promise<Object>} Audit logs with pagination
   */
  static async findByUser(userId, options = {}) {
    return this.findAll({ ...options, userId });
  }

  /**
   * Find audit logs by entity
   * @param {string} targetEntity - Target entity name
   * @param {number} targetId - Optional target ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Audit logs with pagination
   */
  static async findByEntity(targetEntity, targetId = null, options = {}) {
    return this.findAll({ ...options, targetEntity, targetId });
  }

  /**
   * Find a single audit log by ID
   * @param {number} id - Audit log ID
   * @returns {Promise<Object|null>} Audit log or null
   */
  static async findById(id) {
    try {
      const query = `
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        WHERE al.id = ?
      `;

      const [rows] = await executeQuery(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      return this._transformAuditLog(rows[0]);
    } catch (error) {
      console.error('Error finding audit log by ID:', error);
      throw error;
    }
  }

  /**
   * Search audit logs with advanced filtering
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.searchTerm - Search in user name, email, IP address
   * @param {string} searchParams.action - Filter by action
   * @param {string} searchParams.targetEntity - Filter by entity
   * @param {string} searchParams.startDate - Start date
   * @param {string} searchParams.endDate - End date
   * @param {number} searchParams.page - Page number
   * @param {number} searchParams.limit - Records per page
   * @returns {Promise<Object>} Search results with pagination
   */
  static async searchLogs(searchParams = {}) {
    try {
      const {
        searchTerm = '',
        action = null,
        targetEntity = null,
        startDate = null,
        endDate = null,
        page = 1,
        limit = 50
      } = searchParams;

      const allowedActions = ['create', 'update', 'delete', 'login', 'logout', 'access'];
      const whereClauses = [];
      const queryParams = [];

      // Search term - search in user info, IP, and JSON fields
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        const likeTerm = `%${term}%`;
        
        // Try MySQL JSON_SEARCH first, fallback to LIKE for compatibility
        whereClauses.push(`(
          u.full_name LIKE ? OR 
          u.email LIKE ? OR 
          al.ip_address LIKE ? OR
          JSON_SEARCH(al.details_before, 'one', ?, NULL, '$**') IS NOT NULL OR
          JSON_SEARCH(al.details_after, 'one', ?, NULL, '$**') IS NOT NULL OR
          CAST(al.details_before AS CHAR) LIKE ? OR
          CAST(al.details_after AS CHAR) LIKE ?
        )`);
        queryParams.push(likeTerm, likeTerm, likeTerm, term, term, likeTerm, likeTerm);
      }

      // Handle action as array or single value
      if (action) {
        const actions = Array.isArray(action) ? action : [action];
        const validActions = actions.filter(a => allowedActions.includes(a));
        
        if (validActions.length > 0) {
          if (validActions.length === 1) {
            whereClauses.push('al.action = ?');
            queryParams.push(validActions[0]);
          } else {
            const placeholders = validActions.map(() => '?').join(',');
            whereClauses.push(`al.action IN (${placeholders})`);
            queryParams.push(...validActions);
          }
        }
      }

      // Handle targetEntity as array or single value
      if (targetEntity) {
        const entities = Array.isArray(targetEntity) ? targetEntity : [targetEntity];
        
        if (entities.length === 1) {
          whereClauses.push('al.target_entity = ?');
          queryParams.push(entities[0]);
        } else {
          const placeholders = entities.map(() => '?').join(',');
          whereClauses.push(`al.target_entity IN (${placeholders})`);
          queryParams.push(...entities);
        }
      }

      if (startDate) {
        whereClauses.push('al.timestamp >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereClauses.push('al.timestamp <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      // Count total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        ${whereClause}
      `;

      const [countResult] = await executeQuery(countQuery, queryParams);
      const total = countResult[0].total;

      // Get results
      const offset = (page - 1) * limit;
      const query = `
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), parseInt(offset));
      const [rows] = await executeQuery(query, queryParams);

      const logs = rows.map(row => this._transformAuditLog(row));

      return {
        logs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('Error searching audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Start date
   * @param {string} options.endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  static async getStatistics(options = {}) {
    try {
      const { startDate = null, endDate = null } = options;

      const whereClauses = [];
      const queryParams = [];

      if (startDate) {
        whereClauses.push('timestamp >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereClauses.push('timestamp <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      const query = `
        SELECT 
          action,
          COUNT(*) as count
        FROM Audit_Logs
        ${whereClause}
        GROUP BY action
        ORDER BY count DESC
      `;

      const [rows] = await executeQuery(query, queryParams);

      const entityQuery = `
        SELECT 
          target_entity,
          COUNT(*) as count
        FROM Audit_Logs
        ${whereClause}
        GROUP BY target_entity
        ORDER BY count DESC
        LIMIT 10
      `;

      const [entityRows] = await executeQuery(entityQuery, queryParams);

      return {
        byAction: rows,
        byEntity: entityRows
      };
    } catch (error) {
      console.error('Error getting audit log statistics:', error);
      throw error;
    }
  }

  /**
   * Export audit logs (for compliance reporting)
   * @param {Object} options - Export options
   * @returns {Promise<Array>} Raw audit log data
   */
  static async exportLogs(options = {}) {
    try {
      const {
        userId = null,
        startDate = null,
        endDate = null,
        action = null,
        targetEntity = null
      } = options;

      const allowedActions = ['create', 'update', 'delete', 'login', 'logout', 'access'];
      const whereClauses = [];
      const queryParams = [];

      if (userId) {
        whereClauses.push('al.user_id = ?');
        queryParams.push(userId);
      }

      // Handle action as array or single value
      if (action) {
        const actions = Array.isArray(action) ? action : [action];
        const validActions = actions.filter(a => allowedActions.includes(a));
        
        if (validActions.length > 0) {
          if (validActions.length === 1) {
            whereClauses.push('al.action = ?');
            queryParams.push(validActions[0]);
          } else {
            const placeholders = validActions.map(() => '?').join(',');
            whereClauses.push(`al.action IN (${placeholders})`);
            queryParams.push(...validActions);
          }
        }
      }

      // Handle targetEntity as array or single value
      if (targetEntity) {
        const entities = Array.isArray(targetEntity) ? targetEntity : [targetEntity];
        
        if (entities.length === 1) {
          whereClauses.push('al.target_entity = ?');
          queryParams.push(entities[0]);
        } else {
          const placeholders = entities.map(() => '?').join(',');
          whereClauses.push(`al.target_entity IN (${placeholders})`);
          queryParams.push(...entities);
        }
      }

      if (startDate) {
        whereClauses.push('al.timestamp >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereClauses.push('al.timestamp <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

      const query = `
        SELECT 
          al.id,
          al.user_id,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT 10000
      `;

      const [rows] = await executeQuery(query, queryParams);
      return rows.map(row => this._transformAuditLog(row));
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  }

  /**
   * Get recent critical actions (deletes and sensitive updates)
   * @param {number} limit - Maximum number of records to return (default: 10)
   * @returns {Promise<Array>} Array of critical audit logs
   */
  static async getRecentCriticalActions(limit = 10) {
    try {
      const query = `
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        WHERE 
          al.action = 'delete' OR 
          (al.action = 'update' AND al.target_entity IN ('Users', 'Staff_Members'))
        ORDER BY al.timestamp DESC
        LIMIT ?
      `;

      const [rows] = await executeQuery(query, [parseInt(limit)]);
      return rows.map(row => this._transformAuditLog(row));
    } catch (error) {
      console.error('Error getting recent critical actions:', error);
      throw error;
    }
  }

  /**
   * Get failed login attempts within a time period
   * @param {string} since - Time period (e.g., '1 HOUR', '24 HOUR', '7 DAY')
   * @returns {Promise<Array>} Array of failed login audit logs
   */
  static async getFailedLogins(since = '1 HOUR') {
    try {
      // Validate time period
      const validPeriods = ['1 HOUR', '24 HOUR', '7 DAY', '30 DAY'];
      const timePeriod = validPeriods.includes(since) ? since : '1 HOUR';

      const query = `
        SELECT 
          al.id,
          al.user_id,
          al.action,
          al.target_entity,
          al.target_id,
          al.details_before,
          al.details_after,
          al.ip_address,
          al.user_agent,
          al.timestamp,
          u.full_name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM Audit_Logs al
        LEFT JOIN Users u ON al.user_id = u.id
        WHERE 
          al.action = 'login' AND
          al.timestamp >= DATE_SUB(NOW(), INTERVAL ${timePeriod}) AND
          (
            JSON_EXTRACT(al.details_after, '$.success') = false OR
            JSON_EXTRACT(al.details_after, '$.error') IS NOT NULL OR
            al.details_after LIKE '%"success":false%' OR
            al.details_after LIKE '%error%'
          )
        ORDER BY al.timestamp DESC
      `;

      const [rows] = await executeQuery(query, []);
      return rows.map(row => this._transformAuditLog(row));
    } catch (error) {
      console.error('Error getting failed logins:', error);
      throw error;
    }
  }

  /**
   * Transform database row to audit log object
   * @param {Object} row - Database row
   * @returns {Object} Transformed audit log
   */
  static _transformAuditLog(row) {
    const log = {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      targetEntity: row.target_entity,
      targetId: row.target_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.timestamp
    };

    // Parse JSON fields
    try {
      log.detailsBefore = row.details_before 
        ? JSON.parse(row.details_before) 
        : null;
    } catch (error) {
      console.error('Error parsing details_before:', error);
      log.detailsBefore = null;
    }

    try {
      log.detailsAfter = row.details_after 
        ? JSON.parse(row.details_after) 
        : null;
    } catch (error) {
      console.error('Error parsing details_after:', error);
      log.detailsAfter = null;
    }

    // Include user data if present
    if (row.user_name) {
      log.user = {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        role: row.user_role
      };
    }

    return log;
  }
}

module.exports = AuditLog;
