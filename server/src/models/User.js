const { executeQuery } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class User {
  /**
   * Find user by email
   * @param {string} email 
   * @returns {object|null} User object or null if not found
   */
  static async findByEmail(email) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, password_hash, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE email = ? AND is_active = 1
      `;
      const results = await executeQuery(sql, [email]);
      
      if (results.length === 0) {
        return null;
      }

      // Convert snake_case to camelCase
      const user = this._transformUser(results[0]);
      return user;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  /**
   * Find user by email including inactive users
   * @param {string} email - User email
   * @returns {object|null} User object or null if not found
   */
  static async findByEmailIncludeInactive(email) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, password_hash, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE email = ?
      `;
      const results = await executeQuery(sql, [email]);
      
      if (results.length === 0) {
        return null;
      }

      // Convert snake_case to camelCase
      const user = this._transformUser(results[0]);
      return user;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  /**
   * Find user by ID
   * @param {number} id 
   * @param {object} connection - Optional transaction connection
   * @returns {object|null} User object or null if not found
   */
  static async findById(id, connection = null) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, password_hash, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE id = ? AND is_active = 1
      `;
      const results = connection 
        ? await connection.execute(sql, [id])
        : await executeQuery(sql, [id]);
      
      const rows = connection ? results[0] : results;
      
      if (rows.length === 0) {
        return null;
      }

      const user = this._transformUser(rows[0]);
      return user;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  /**
   * Find user by UUID
   * @param {string} uuid 
   * @returns {object|null} User object or null if not found
   */
  static async findByUuid(uuid) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, password_hash, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE uuid = ? AND is_active = 1
      `;
      const results = await executeQuery(sql, [uuid]);
      
      if (results.length === 0) {
        return null;
      }

      const user = this._transformUser(results[0]);
      return user;
    } catch (error) {
      throw new Error(`Error finding user by UUID: ${error.message}`);
    }
  }

  /**
   * Create new user
   * @param {object} userData - User data to insert
   * @param {object} connection - Optional transaction connection
   * @returns {object} Created user object
   */
  static async create(userData, connection = null) {
    try {
      const {
        fullName,
        email,
        passwordHash,
        role,
        phoneNumber = null,
        dateOfBirth = null,
        address = null,
        emergencyContact = null
      } = userData;

      // Validate role
      const validRoles = ['patient', 'partner', 'staff', 'admin', 'super_admin'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
      }

      // Generate UUID for the user
      const uuid = uuidv4();

      const sql = `
        INSERT INTO users (
          uuid, full_name, email, password_hash, role, phone_number, 
          date_of_birth, address, emergency_contact, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      
      const params = [
        uuid,
        fullName,
        email,
        passwordHash,
        role,
        phoneNumber,
        dateOfBirth,
        address,
        emergencyContact
      ];

      const result = connection 
        ? await connection.execute(sql, params)
        : await executeQuery(sql, params);

      // Fetch the created user (use same connection if in transaction)
      const createdUser = connection 
        ? await this.findById(result[0].insertId, connection)
        : await this.findById(result.insertId);
      return createdUser;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Email already exists');
      }
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  /**
   * Update user by ID
   * @param {number} id 
   * @param {object} userData - Data to update
   * @returns {object} Updated user object
   */
  static async updateById(id, userData) {
    try {
      const updateFields = [];
      const updateValues = [];

      // Build dynamic update query
      const allowedFields = [
        'full_name', 'email', 'phone_number', 'date_of_birth', 
        'address', 'emergency_contact', 'role', 'password_hash', 'is_active'
      ];

      Object.keys(userData).forEach(key => {
        const snakeKey = this._camelToSnake(key);
        if (allowedFields.includes(snakeKey)) {
          updateFields.push(`${snakeKey} = ?`);
          updateValues.push(userData[key]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      // Check if we're updating is_active, if so don't filter by is_active
      const isUpdatingIsActive = Object.keys(userData).some(key => this._camelToSnake(key) === 'is_active');
      
      const whereClause = isUpdatingIsActive ? 'WHERE id = ?' : 'WHERE id = ? AND is_active = 1';

      const sql = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        ${whereClause}
      `;

      const result = await executeQuery(sql, updateValues);
      
      if (result.affectedRows === 0) {
        throw new Error('User not found or no changes made');
      }

      // Return updated user (including inactive users if we deactivated)
      const updatedUser = isUpdatingIsActive 
        ? await this.findByIdIncludeInactive(id)
        : await this.findById(id);
      return updatedUser;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Email address already exists');
      }
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  /**
   * Update only is_active status bypassing the is_active = 1 filter
   * Used for deactivation/reactivation of users
   * @param {number} id - User ID
   * @param {boolean} isActive - Active status
   * @returns {object} Updated user object
   */
  static async updateIsActiveById(id, isActive) {
    try {
      const sql = `
        UPDATE users 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await executeQuery(sql, [isActive ? 1 : 0, id]);
      
      if (result.affectedRows === 0) {
        throw new Error('User not found');
      }

      // Return updated user (include inactive users after deactivation)
      const updatedUser = await this.findByIdIncludeInactive(id);
      return updatedUser;
    } catch (error) {
      throw new Error(`Error updating user is_active status: ${error.message}`);
    }
  }

  /**
   * Soft delete user by ID (deactivate)
   * @param {number} id 
   * @returns {boolean} Success status
   */
  static async deleteById(id) {
    try {
      const sql = `
        UPDATE users 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `;
      
      const result = await executeQuery(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  /**
   * Find all users with filtering and pagination
   * @param {object} filters - Filter options
   * @returns {object} Object with users array and total count
   */
  static async findAll(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        isActive = null
      } = filters;

      let whereConditions = [];
      let queryParams = [];

      // Add search condition
      if (search) {
        whereConditions.push('(full_name LIKE ? OR email LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // Add role filter
      if (role) {
        whereConditions.push('role = ?');
        queryParams.push(role);
      }

      // Add active status filter
      if (isActive !== null) {
        whereConditions.push('is_active = ?');
        queryParams.push(isActive ? 1 : 0);
      }

      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const countResult = await executeQuery(countSql, queryParams);
      const total = countResult[0].total;

      // Get paginated results (exclude password_hash from list)
      const offset = (page - 1) * limit;
      const sql = `
        SELECT id, uuid, full_name, email, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const results = await executeQuery(sql, [...queryParams, limit, offset]);
      const users = results.map(user => this._transformUser(user));

      return {
        users,
        total
      };
    } catch (error) {
      throw new Error(`Error finding all users: ${error.message}`);
    }
  }

  /**
   * Search users by name or email
   * @param {string} searchTerm - Search term
   * @returns {array} Array of matching users
   */
  static async searchByNameOrEmail(searchTerm) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE (full_name LIKE ? OR email LIKE ?) AND is_active = 1
        ORDER BY full_name ASC
        LIMIT 50
      `;
      
      const results = await executeQuery(sql, [`%${searchTerm}%`, `%${searchTerm}%`]);
      return results.map(user => this._transformUser(user));
    } catch (error) {
      throw new Error(`Error searching users: ${error.message}`);
    }
  }

  /**
   * Find user by ID including inactive users
   * @param {number} id 
   * @returns {object|null} User object or null if not found
   */
  static async findByIdIncludeInactive(id) {
    try {
      const sql = `
        SELECT id, uuid, full_name, email, password_hash, role, phone_number, 
               date_of_birth, address, emergency_contact, is_active, 
               created_at, updated_at
        FROM users 
        WHERE id = ?
      `;
      const results = await executeQuery(sql, [id]);
      
      if (results.length === 0) {
        return null;
      }

      const user = this._transformUser(results[0]);
      return user;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  /**
   * Count users matching filters
   * @param {object} filters - Filter options
   * @returns {number} Count of matching users
   */
  static async countUsers(filters = {}) {
    try {
      const { search = '', role = '', isActive = null } = filters;

      let whereConditions = [];
      let queryParams = [];

      if (search) {
        whereConditions.push('(full_name LIKE ? OR email LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (role) {
        whereConditions.push('role = ?');
        queryParams.push(role);
      }

      if (isActive !== null) {
        whereConditions.push('is_active = ?');
        queryParams.push(isActive ? 1 : 0);
      }

      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';

      const sql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const result = await executeQuery(sql, queryParams);
      
      return result[0].total;
    } catch (error) {
      throw new Error(`Error counting users: ${error.message}`);
    }
  }

  /**
   * Transform database user object to camelCase
   * @private
   */
  static _transformUser(dbUser) {
    return {
      id: dbUser.id,
      uuid: dbUser.uuid,
      fullName: dbUser.full_name,
      email: dbUser.email,
      passwordHash: dbUser.password_hash,
      role: dbUser.role,
      phoneNumber: dbUser.phone_number,
      dateOfBirth: dbUser.date_of_birth,
      address: dbUser.address,
      emergencyContact: dbUser.emergency_contact,
      isActive: dbUser.is_active,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  /**
   * Convert camelCase to snake_case
   * @private
   */
  static _camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

module.exports = User;