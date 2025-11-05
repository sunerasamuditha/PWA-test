const { executeQuery } = require('../config/database');

const SERVICE_CATEGORIES = [
  'consultation',
  'procedure',
  'lab_test',
  'room_charge',
  'service_charge',
  'other'
];

class Service {
  /**
   * Find service by ID
   */
  static async findById(id, connection = null) {
    const query = 'SELECT * FROM Services WHERE id = ?';
    const rows = await executeQuery(query, [id], connection);
    return rows.length > 0 ? this._transformService(rows[0]) : null;
  }

  /**
   * Find all services with filters
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 50,
      search = '',
      category = null,
      is_active = null,
      min_price = null,
      max_price = null,
      sort_by = 'name',
      sort_order = 'ASC'
    } = filters;

    let query = 'SELECT * FROM Services WHERE 1=1';
    const params = [];

    // Search filter
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Category filter
    if (category) {
      query += ' AND service_category = ?';
      params.push(category);
    }

    // Active status filter
    if (is_active !== null) {
      query += ' AND is_active = ?';
      params.push(is_active ? 1 : 0);
    }

    // Price range filter
    if (min_price !== null) {
      query += ' AND price >= ?';
      params.push(min_price);
    }
    if (max_price !== null) {
      query += ' AND price <= ?';
      params.push(max_price);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['name', 'price', 'service_category', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'name';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = await executeQuery(query, params);
    const services = rows.map(row => this._transformService(row));

    return {
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new service
   */
  static async create(serviceData, connection = null) {
    const {
      name,
      description = null,
      price,
      service_category,
      is_active = true
    } = serviceData;

    const query = `
      INSERT INTO Services (name, description, price, service_category, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [name, description, price, service_category, is_active ? 1 : 0];

    const result = await executeQuery(query, params, connection);
    return this.findById(result.insertId, connection);
  }

  /**
   * Update service by ID
   */
  static async updateById(id, serviceData) {
    const allowedFields = ['name', 'description', 'price', 'service_category', 'is_active'];
    const updates = [];
    const params = [];

    Object.keys(serviceData).forEach(key => {
      if (allowedFields.includes(key) && serviceData[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'is_active') {
          params.push(serviceData[key] ? 1 : 0);
        } else {
          params.push(serviceData[key]);
        }
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `UPDATE Services SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(query, params);

    return this.findById(id);
  }

  /**
   * Delete service by ID (soft delete by setting is_active to false)
   */
  static async deleteById(id, hardDelete = false) {
    if (hardDelete) {
      const query = 'DELETE FROM Services WHERE id = ?';
      await executeQuery(query, [id]);
      return { deleted: true };
    } else {
      // Soft delete
      return this.updateById(id, { is_active: false });
    }
  }

  /**
   * Count services by category
   */
  static async countByCategory(category = null) {
    let query = 'SELECT service_category, COUNT(*) as count FROM Services';
    const params = [];

    if (category) {
      query += ' WHERE service_category = ?';
      params.push(category);
    }

    query += ' GROUP BY service_category';
    const rows = await executeQuery(query, params);
    return rows;
  }

  /**
   * Get active services
   */
  static async getActiveServices(category = null) {
    let query = 'SELECT * FROM Services WHERE is_active = 1';
    const params = [];

    if (category) {
      query += ' AND service_category = ?';
      params.push(category);
    }

    query += ' ORDER BY name ASC';
    const rows = await executeQuery(query, params);
    return rows.map(row => this._transformService(row));
  }

  /**
   * Get average price by category for active services
   */
  static async getAveragePriceByCategory() {
    const query = `
      SELECT 
        service_category,
        AVG(price) as average_price,
        COUNT(*) as count
      FROM Services
      WHERE is_active = 1
      GROUP BY service_category
    `;
    
    const rows = await executeQuery(query);
    return rows.map(row => ({
      category: row.service_category,
      averagePrice: parseFloat(row.average_price),
      count: row.count
    }));
  }

  /**
   * Transform database service object to camelCase
   */
  static _transformService(dbService) {
    if (!dbService) return null;

    return {
      id: dbService.id,
      name: dbService.name,
      description: dbService.description,
      price: parseFloat(dbService.price),
      serviceCategory: dbService.service_category,
      isActive: Boolean(dbService.is_active),
      createdAt: dbService.created_at,
      updatedAt: dbService.updated_at
    };
  }
}

module.exports = { Service, SERVICE_CATEGORIES };
