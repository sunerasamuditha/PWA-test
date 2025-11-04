const { executeQuery } = require('../config/database');

class Partner {
  /**
   * Find partner by user ID
   * @param {number} userId - User ID to search for
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object|null} Partner object or null if not found
   */
  static async findByUserId(userId, connection = null) {
    try {
      const query = `
        SELECT 
          p.id,
          p.user_id,
          p.type,
          p.status,
          p.commission_points,
          p.created_at,
          p.updated_at,
          u.uuid,
          u.full_name,
          u.email,
          u.phone_number
        FROM \`partners\` p
        LEFT JOIN \`users\` u ON p.user_id = u.id
        WHERE p.user_id = ?
      `;
      
      const results = await executeQuery(query, [userId], connection);
      
      if (results.length === 0) {
        return null;
      }
      
      return this._transformPartner(results[0]);
    } catch (error) {
      console.error('Error finding partner by user ID:', error);
      throw error;
    }
  }

  /**
   * Find partner by ID
   * @param {number} id - Partner ID
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object|null} Partner object or null if not found
   */
  static async findById(id, connection = null) {
    try {
      const query = `
        SELECT 
          p.id,
          p.user_id,
          p.type,
          p.status,
          p.commission_points,
          p.created_at,
          p.updated_at
        FROM \`partners\` p
        WHERE p.id = ?
      `;
      
      const results = await executeQuery(query, [id], connection);
      
      if (results.length === 0) {
        return null;
      }
      
      return this._transformPartner(results[0]);
    } catch (error) {
      console.error('Error finding partner by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new partner
   * @param {Object} partnerData - Partner data
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object} Created partner object
   */
  static async create(partnerData, connection = null) {
    try {
      const { user_id, type, status = 'pending', commission_points = 0.00 } = partnerData;
      
      const query = `
        INSERT INTO \`partners\` (user_id, type, status, commission_points, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      
      const result = await executeQuery(query, [user_id, type, status, commission_points], connection);
      
      // Return the created partner
      return await this.findById(result.insertId, connection);
    } catch (error) {
      console.error('Error creating partner:', error);
      throw error;
    }
  }

  /**
   * Update partner by user ID
   * @param {number} userId - User ID
   * @param {Object} partnerData - Updated partner data
   * @returns {Object} Updated partner object
   */
  static async updateByUserId(userId, partnerData) {
    try {
      const updateFields = [];
      const updateValues = [];
      
      if (partnerData.type !== undefined) {
        updateFields.push('type = ?');
        updateValues.push(partnerData.type);
      }
      
      if (partnerData.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(partnerData.status);
      }
      
      if (partnerData.commission_points !== undefined) {
        updateFields.push('commission_points = ?');
        updateValues.push(partnerData.commission_points);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      updateFields.push('updated_at = NOW()');
      updateValues.push(userId);
      
      const query = `
        UPDATE \`partners\` 
        SET ${updateFields.join(', ')}
        WHERE user_id = ?
      `;
      
      await executeQuery(query, updateValues);
      
      return await this.findByUserId(userId);
    } catch (error) {
      console.error('Error updating partner:', error);
      throw error;
    }
  }

  /**
   * Update commission points by user ID
   * @param {number} userId - User ID
   * @param {number} pointsToAdd - Points to add to current commission
   * @returns {Object} Updated partner object
   */
  static async updateCommissionPoints(userId, pointsToAdd, connection = null) {
    try {
      const query = `
        UPDATE \`partners\` 
        SET commission_points = commission_points + ?,
            updated_at = NOW()
        WHERE user_id = ?
      `;
      
      await executeQuery(query, [pointsToAdd, userId], connection);
      
      return await this.findByUserId(userId);
    } catch (error) {
      console.error('Error updating commission points:', error);
      throw error;
    }
  }

  /**
   * Get all partners with filters
   * @param {Object} filters - Filter options
   * @returns {Object} Partners list with pagination info
   */
  static async getAllPartners(filters = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        type = '', 
        status = '', 
        sortBy = 'created_at', 
        sortOrder = 'desc' 
      } = filters;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      const whereConditions = [];
      const queryParams = [];
      
      if (search) {
        whereConditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }
      
      if (type) {
        whereConditions.push('p.type = ?');
        queryParams.push(type);
      }
      
      if (status) {
        whereConditions.push('p.status = ?');
        queryParams.push(status);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Map sort columns to table-qualified names
      const sortColumnMap = {
        'created_at': 'p.created_at',
        'updated_at': 'p.updated_at',
        'full_name': 'u.full_name',
        'email': 'u.email',
        'type': 'p.type',
        'status': 'p.status',
        'commission_points': 'p.commission_points'
      };
      
      const validSortBy = sortColumnMap[sortBy] || 'p.created_at';
      const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Get partners
      const partnersQuery = `
        SELECT 
          p.id,
          p.user_id,
          p.type,
          p.status,
          p.commission_points,
          p.created_at,
          p.updated_at,
          u.uuid,
          u.full_name,
          u.email,
          u.phone_number
        FROM \`partners\` p
        LEFT JOIN \`users\` u ON p.user_id = u.id
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const partners = await executeQuery(partnersQuery, [...queryParams, limit, offset]);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM \`partners\` p
        LEFT JOIN \`users\` u ON p.user_id = u.id
        ${whereClause}
      `;
      
      const countResult = await executeQuery(countQuery, queryParams);
      const totalCount = countResult[0].total;
      
      return {
        partners: partners.map(partner => this._transformPartner(partner)),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit
        }
      };
    } catch (error) {
      console.error('Error getting all partners:', error);
      throw error;
    }
  }

  /**
   * Transform database partner object to camelCase
   * @param {Object} dbPartner - Database partner object
   * @returns {Object} Transformed partner object
   */
  static _transformPartner(dbPartner) {
    if (!dbPartner) return null;
    
    return {
      id: dbPartner.id,
      userId: dbPartner.user_id,
      type: dbPartner.type,
      status: dbPartner.status,
      commissionPoints: parseFloat(dbPartner.commission_points || 0),
      createdAt: dbPartner.created_at,
      updatedAt: dbPartner.updated_at,
      // Include user data if present
      uuid: dbPartner.uuid,
      fullName: dbPartner.full_name,
      email: dbPartner.email,
      phoneNumber: dbPartner.phone_number
    };
  }
}

module.exports = Partner;