const { executeQuery } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class Staff {
  /**
   * Find staff by user ID
   * @param {number} userId - User ID
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object|null} Staff object with parsed permissions or null
   */
  static async findByUserId(userId, connection = null) {
    try {
      const query = `
        SELECT 
          s.*,
          u.full_name,
          u.email,
          u.phone_number,
          u.date_of_birth,
          u.address,
          u.emergency_contact,
          u.is_active,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at
        FROM Staff_Members s
        LEFT JOIN Users u ON s.user_id = u.id
        WHERE s.user_id = ?
      `;
      
      const results = await executeQuery(query, [userId], connection);
      
      if (results.length === 0) {
        return null;
      }
      
      return this._transformStaff(results[0]);
    } catch (error) {
      console.error('Error finding staff by user ID:', error);
      throw error;
    }
  }

  /**
   * Find staff by ID
   * @param {number} id - Staff ID
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object|null} Staff object with parsed permissions or null
   */
  static async findById(id, connection = null) {
    try {
      const query = `
        SELECT 
          s.*,
          u.full_name,
          u.email,
          u.phone_number,
          u.date_of_birth,
          u.address,
          u.emergency_contact,
          u.is_active,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at
        FROM Staff_Members s
        LEFT JOIN Users u ON s.user_id = u.id
        WHERE s.id = ?
      `;
      
      const results = await executeQuery(query, [id], connection);
      
      if (results.length === 0) {
        return null;
      }
      
      return this._transformStaff(results[0]);
    } catch (error) {
      console.error('Error finding staff by ID:', error);
      throw error;
    }
  }

  /**
   * Create new staff record
   * @param {Object} staffData - Staff data
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object} Created staff object
   */
  static async create(staffData, connection = null) {
    try {
      const { user_id, staff_role, permissions = [] } = staffData;
      
      const query = `
        INSERT INTO Staff_Members (user_id, staff_role, permissions, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `;
      
      const result = await executeQuery(query, [
        user_id,
        staff_role,
        JSON.stringify(permissions)
      ], connection);
      
      // Return the created staff record
      return await this.findById(result.insertId, connection);
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  /**
   * Update staff by user ID
   * @param {number} userId - User ID
   * @param {Object} staffData - Staff data to update
   * @returns {Object} Updated staff object
   */
  static async updateByUserId(userId, staffData) {
    try {
      const updateFields = [];
      const values = [];
      
      if (staffData.staff_role !== undefined) {
        updateFields.push('staff_role = ?');
        values.push(staffData.staff_role);
      }
      
      if (staffData.permissions !== undefined) {
        updateFields.push('permissions = ?');
        values.push(JSON.stringify(staffData.permissions));
      }
      
      if (updateFields.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }
      
      updateFields.push('updated_at = NOW()');
      values.push(userId);
      
      const query = `
        UPDATE Staff_Members 
        SET ${updateFields.join(', ')}
        WHERE user_id = ?
      `;
      
      const result = await executeQuery(query, values);
      
      // Check if any rows were affected
      if (result.affectedRows === 0) {
        throw new AppError('Staff profile not found', 404);
      }
      
      // Return the updated staff record
      return await this.findByUserId(userId);
    } catch (error) {
      console.error('Error updating staff by user ID:', error);
      throw error;
    }
  }

  /**
   * Get all staff with pagination and filters
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated staff list with user data
   */
  static async getAllStaff(filters = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        staff_role = null,
        sortBy = 'created_at', 
        sortOrder = 'desc' 
      } = filters;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      const whereConditions = ['1 = 1'];
      const queryParams = [];
      
      if (search) {
        whereConditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }
      
      if (staff_role) {
        whereConditions.push('s.staff_role = ?');
        queryParams.push(staff_role);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // Validate sort column
      const allowedSortColumns = ['created_at', 'updated_at', 'full_name', 'email', 'staff_role'];
      const sortMapping = {
        'created_at': 's.created_at',
        'updated_at': 's.updated_at',
        'full_name': 'u.full_name',
        'email': 'u.email',
        'staff_role': 's.staff_role'
      };
      const validSortBy = sortMapping[allowedSortColumns.includes(sortBy) ? sortBy : 'created_at'];
      const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Get staff records
      const staffQuery = `
        SELECT 
          s.*,
          u.full_name,
          u.email,
          u.phone_number,
          u.date_of_birth,
          u.address,
          u.emergency_contact,
          u.is_active,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at
        FROM Staff_Members s
        LEFT JOIN Users u ON s.user_id = u.id
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const staff = await executeQuery(staffQuery, [...queryParams, limit, offset]);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM Staff_Members s
        LEFT JOIN Users u ON s.user_id = u.id
        ${whereClause}
      `;
      
      const countResult = await executeQuery(countQuery, queryParams);
      const totalCount = countResult[0].total;
      
      return {
        staff: staff.map(s => this._transformStaff(s)),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit
        }
      };
    } catch (error) {
      console.error('Error getting all staff:', error);
      throw error;
    }
  }

  /**
   * Transform database staff object to camelCase
   * @param {Object} dbStaff - Database staff object
   * @returns {Object} Transformed staff object
   */
  static _transformStaff(dbStaff) {
    if (!dbStaff) return null;
    
    let parsedPermissions = [];
    
    // Parse permissions JSON safely
    if (dbStaff.permissions) {
      try {
        parsedPermissions = JSON.parse(dbStaff.permissions);
      } catch (error) {
        console.error('Error parsing permissions JSON:', error);
        parsedPermissions = [];
      }
    }
    
    return {
      id: dbStaff.id,
      userId: dbStaff.user_id,
      staffRole: dbStaff.staff_role,
      permissions: Array.isArray(parsedPermissions) ? parsedPermissions : [],
      createdAt: dbStaff.created_at,
      updatedAt: dbStaff.updated_at,
      // User data
      fullName: dbStaff.full_name,
      email: dbStaff.email,
      phoneNumber: dbStaff.phone_number,
      dateOfBirth: dbStaff.date_of_birth,
      address: dbStaff.address,
      emergencyContact: dbStaff.emergency_contact,
      isActive: dbStaff.is_active,
      userCreatedAt: dbStaff.user_created_at,
      userUpdatedAt: dbStaff.user_updated_at
    };
  }
}

module.exports = Staff;