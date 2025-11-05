const { executeQuery } = require('../config/database');

// Define allowed entity types matching the database ENUM
const ENTITY_TYPES = ['hospital', 'lab', 'supplier', 'insurance_company', 'other'];

class ExternalEntity {
  /**
   * Find external entity by ID
   * @param {number} id - Entity ID
   * @param {object} connection - Optional transaction connection
   * @returns {Promise<object|null>} Entity object or null if not found
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT id, name, type, contact_info, created_at, updated_at
      FROM External_Entities
      WHERE id = ?
    `;

    const rows = await executeQuery(query, [id], connection);
    
    if (rows.length === 0) {
      return null;
    }

    return this._transformExternalEntity(rows[0]);
  }

  /**
   * Find all external entities with optional filters
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated entities and total count
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      type = '',
      sort_by = 'name',
      sort_order = 'ASC'
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    // Add search filter
    if (search) {
      conditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }

    // Add type filter
    if (type && ENTITY_TYPES.includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const allowedSortColumns = ['name', 'type', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'name';
    const sortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM External_Entities ${whereClause}`;
    const countRows = await executeQuery(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    const query = `
      SELECT id, name, type, contact_info, created_at, updated_at
      FROM External_Entities
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery(query, [...params, limit, offset]);

    const entities = rows.map(row => this._transformExternalEntity(row));

    return {
      entities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new external entity
   * @param {object} entityData - Entity data
   * @param {object} connection - Optional transaction connection
   * @returns {Promise<object>} Created entity
   */
  static async create(entityData, connection = null) {
    const { name, type, contact_info = {} } = entityData;

    // Validate type
    if (!ENTITY_TYPES.includes(type)) {
      throw new Error(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`);
    }

    // Validate contact_info structure
    this._validateContactInfo(contact_info);

    const query = `
      INSERT INTO External_Entities (name, type, contact_info)
      VALUES (?, ?, ?)
    `;

    const contactInfoJson = JSON.stringify(contact_info);
    const result = await executeQuery(query, [name, type, contactInfoJson], connection);

    return this.findById(result.insertId, connection);
  }

  /**
   * Update external entity by ID
   * @param {number} id - Entity ID
   * @param {object} entityData - Update data
   * @returns {Promise<object>} Updated entity
   */
  static async updateById(id, entityData) {
    const { name, type, contact_info } = entityData;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }

    if (type !== undefined) {
      if (!ENTITY_TYPES.includes(type)) {
        throw new Error(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`);
      }
      updates.push('type = ?');
      params.push(type);
    }

    if (contact_info !== undefined) {
      this._validateContactInfo(contact_info);
      updates.push('contact_info = ?');
      params.push(JSON.stringify(contact_info));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE External_Entities
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(query, params);

    return this.findById(id);
  }

  /**
   * Delete external entity by ID
   * @param {number} id - Entity ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteById(id) {
    const query = 'DELETE FROM External_Entities WHERE id = ?';
    const result = await executeQuery(query, [id]);
    
    return result.affectedRows > 0;
  }

  /**
   * Count entities by type
   * @param {string} type - Entity type
   * @returns {Promise<number>} Count
   */
  static async countByType(type) {
    if (!ENTITY_TYPES.includes(type)) {
      throw new Error(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`);
    }

    const query = 'SELECT COUNT(*) as count FROM External_Entities WHERE type = ?';
    const rows = await executeQuery(query, [type]);
    
    return rows[0].count;
  }

  /**
   * Get entity counts grouped by type (optimized single query)
   * @returns {Promise<Array>} Array of {type, count} objects
   */
  static async getCountsByType() {
    const query = `
      SELECT type, COUNT(*) AS count
      FROM External_Entities
      GROUP BY type
    `;

    const rows = await executeQuery(query);
    return rows;
  }

  /**
   * Get all entities of a specific type
   * @param {string} type - Entity type
   * @returns {Promise<Array>} Array of entities
   */
  static async getByType(type) {
    if (!ENTITY_TYPES.includes(type)) {
      throw new Error(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`);
    }

    const query = `
      SELECT id, name, type, contact_info, created_at, updated_at
      FROM External_Entities
      WHERE type = ?
      ORDER BY name ASC
    `;

    const rows = await executeQuery(query, [type]);
    
    return rows.map(row => this._transformExternalEntity(row));
  }

  /**
   * Search entities by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching entities
   */
  static async searchByName(searchTerm) {
    const query = `
      SELECT id, name, type, contact_info, created_at, updated_at
      FROM External_Entities
      WHERE name LIKE ?
      ORDER BY name ASC
      LIMIT 20
    `;

    const rows = await executeQuery(query, [`%${searchTerm}%`]);
    
    return rows.map(row => this._transformExternalEntity(row));
  }

  /**
   * Transform database entity to camelCase format
   * @private
   */
  static _transformExternalEntity(dbEntity) {
    let contactInfo = {};
    
    // Parse JSON with error handling
    if (dbEntity.contact_info) {
      try {
        contactInfo = typeof dbEntity.contact_info === 'string' 
          ? JSON.parse(dbEntity.contact_info) 
          : dbEntity.contact_info;
      } catch (error) {
        console.error('Error parsing contact_info JSON:', error);
        contactInfo = {};
      }
    }

    return {
      id: dbEntity.id,
      name: dbEntity.name,
      type: dbEntity.type,
      contactInfo,
      createdAt: dbEntity.created_at,
      updatedAt: dbEntity.updated_at
    };
  }

  /**
   * Validate contact_info JSON structure
   * @private
   */
  static _validateContactInfo(contactInfo) {
    if (!contactInfo || typeof contactInfo !== 'object') {
      return; // Empty object is valid
    }

    // Validate nested objects if provided
    const { address, contact_person, billing_contact } = contactInfo;

    if (address && typeof address !== 'object') {
      throw new Error('contact_info.address must be an object');
    }

    if (contact_person && typeof contact_person !== 'object') {
      throw new Error('contact_info.contact_person must be an object');
    }

    if (billing_contact && typeof billing_contact !== 'object') {
      throw new Error('contact_info.billing_contact must be an object');
    }
  }
}

module.exports = { ExternalEntity, ENTITY_TYPES };
