const { executeQuery } = require('../config/database');

// Define allowed payable statuses matching the database ENUM
const PAYABLE_STATUSES = ['due', 'paid', 'overdue'];

class AccountsPayable {
  /**
   * Find accounts payable by ID with entity details
   * @param {number} id - Payable ID
   * @param {object} connection - Optional transaction connection
   * @returns {Promise<object|null>} Payable object or null if not found
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        ap.id,
        ap.entity_id,
        ap.reference_code,
        ap.description,
        ap.total_amount,
        ap.due_date,
        ap.paid_date,
        ap.status,
        ap.payment_method,
        ap.notes,
        ap.created_at,
        ap.updated_at,
        ee.name as entity_name,
        ee.type as entity_type
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      WHERE ap.id = ?
    `;

    const rows = await executeQuery(query, [id], connection);
    
    if (rows.length === 0) {
      return null;
    }

    return this._transformAccountsPayable(rows[0]);
  }

  /**
   * Find all payables for a specific entity
   * @param {number} entityId - Entity ID
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated payables
   */
  static async findByEntityId(entityId, filters = {}) {
    const {
      status = '',
      startDate = '',
      endDate = '',
      dateField = 'due_date', // 'due_date' or 'paid_date'
      page = 1,
      limit = 20
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = ['ap.entity_id = ?'];
    const params = [entityId];

    if (status && PAYABLE_STATUSES.includes(status)) {
      conditions.push('ap.status = ?');
      params.push(status);
    }

    // Validate dateField
    const validDateFields = ['due_date', 'paid_date'];
    const dateColumn = validDateFields.includes(dateField) ? dateField : 'due_date';

    if (startDate) {
      conditions.push(`ap.${dateColumn} >= ?`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`ap.${dateColumn} <= ?`);
      params.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM Accounts_Payable ap ${whereClause}`;
    const countRows = await executeQuery(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    const query = `
      SELECT 
        ap.*,
        ee.name as entity_name,
        ee.type as entity_type
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      ${whereClause}
      ORDER BY ap.${dateColumn} ASC
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery(query, [...params, limit, offset]);
    const payables = rows.map(row => this._transformAccountsPayable(row));

    return {
      payables,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find all payables with filters
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated payables
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      entity_id = '',
      status = '',
      startDate = '',
      endDate = '',
      dateField = 'due_date', // 'due_date' or 'paid_date'
      sort_by = 'due_date',
      sort_order = 'ASC'
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    // Search filter
    if (search) {
      conditions.push('(ap.reference_code LIKE ? OR ap.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Entity filter
    if (entity_id) {
      conditions.push('ap.entity_id = ?');
      params.push(entity_id);
    }

    // Status filter
    if (status && PAYABLE_STATUSES.includes(status)) {
      conditions.push('ap.status = ?');
      params.push(status);
    }

    // Validate dateField
    const validDateFields = ['due_date', 'paid_date'];
    const dateColumn = validDateFields.includes(dateField) ? dateField : 'due_date';

    // Date range filter - apply to selected date field
    if (startDate) {
      conditions.push(`ap.${dateColumn} >= ?`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`ap.${dateColumn} <= ?`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const allowedSortColumns = ['due_date', 'total_amount', 'created_at', 'paid_date'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'due_date';
    const sortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM Accounts_Payable ap ${whereClause}`;
    const countRows = await executeQuery(countQuery, params);
    const total = countRows[0].total;

    // Get paginated results
    const query = `
      SELECT 
        ap.*,
        ee.name as entity_name,
        ee.type as entity_type
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      ${whereClause}
      ORDER BY ap.${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery(query, [...params, limit, offset]);
    const payables = rows.map(row => this._transformAccountsPayable(row));

    return {
      payables,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new accounts payable
   * @param {object} payableData - Payable data
   * @param {object} connection - Optional transaction connection
   * @returns {Promise<object>} Created payable
   */
  static async create(payableData, connection = null) {
    const {
      entity_id,
      reference_code = null,
      description = null,
      total_amount,
      due_date,
      notes = null
    } = payableData;

    const query = `
      INSERT INTO Accounts_Payable 
      (entity_id, reference_code, description, total_amount, due_date, status, notes)
      VALUES (?, ?, ?, ?, ?, 'due', ?)
    `;

    const result = await executeQuery(
      query,
      [entity_id, reference_code, description, total_amount, due_date, notes],
      connection
    );

    return this.findById(result.insertId, connection);
  }

  /**
   * Update payable by ID
   * @param {number} id - Payable ID
   * @param {object} payableData - Update data
   * @returns {Promise<object>} Updated payable
   */
  static async updateById(id, payableData) {
    const {
      reference_code,
      description,
      total_amount,
      due_date,
      status,
      payment_method,
      notes
    } = payableData;

    const updates = [];
    const params = [];

    if (reference_code !== undefined) {
      updates.push('reference_code = ?');
      params.push(reference_code);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (total_amount !== undefined) {
      updates.push('total_amount = ?');
      params.push(total_amount);
    }

    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
    }

    if (status !== undefined) {
      if (!PAYABLE_STATUSES.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${PAYABLE_STATUSES.join(', ')}`);
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      params.push(payment_method);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE Accounts_Payable
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(query, params);

    return this.findById(id);
  }

  /**
   * Mark payable as paid
   * @param {number} id - Payable ID
   * @param {string} paidDate - Paid date
   * @param {string} paymentMethod - Payment method
   * @param {string} notes - Optional notes
   * @returns {Promise<object>} Updated payable
   */
  static async markAsPaid(id, paidDate, paymentMethod, notes = null) {
    const query = `
      UPDATE Accounts_Payable
      SET status = 'paid',
          paid_date = ?,
          payment_method = ?,
          notes = CASE WHEN ? IS NOT NULL THEN CONCAT(COALESCE(notes, ''), '\n', ?) ELSE notes END,
          updated_at = NOW()
      WHERE id = ?
    `;

    await executeQuery(query, [paidDate, paymentMethod, notes, notes, id]);

    return this.findById(id);
  }

  /**
   * Update overdue status for payables past due date
   * @returns {Promise<number>} Number of records updated
   */
  static async updateOverdueStatus() {
    const query = `
      UPDATE Accounts_Payable
      SET status = 'overdue', updated_at = NOW()
      WHERE due_date < CURDATE() AND status = 'due'
    `;

    const result = await executeQuery(query);

    return result.affectedRows;
  }

  /**
   * Get all overdue payables
   * @returns {Promise<Array>} Array of overdue payables
   */
  static async getOverduePayables() {
    const query = `
      SELECT 
        ap.*,
        ee.name as entity_name,
        ee.type as entity_type
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      WHERE ap.status = 'overdue' OR (ap.status = 'due' AND ap.due_date < CURDATE())
      ORDER BY ap.due_date ASC
    `;

    const rows = await executeQuery(query);

    return rows.map(row => this._transformAccountsPayable(row));
  }

  /**
   * Get payables due soon (within specified days)
   * @param {number} daysAhead - Number of days to look ahead (default 7)
   * @returns {Promise<Array>} Array of payables due soon
   */
  static async getDueSoonPayables(daysAhead = 7) {
    const query = `
      SELECT 
        ap.*,
        ee.name as entity_name,
        ee.type as entity_type
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      WHERE ap.status = 'due' 
        AND ap.due_date >= CURDATE()
        AND ap.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY ap.due_date ASC
    `;

    const rows = await executeQuery(query, [daysAhead]);

    return rows.map(row => this._transformAccountsPayable(row));
  }

  /**
   * Get total payables amount by entity
   * @param {number} entityId - Entity ID
   * @param {string} status - Optional status filter
   * @returns {Promise<number>} Total amount
   */
  static async getTotalByEntity(entityId, status = null) {
    let query = `
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM Accounts_Payable
      WHERE entity_id = ?
    `;
    const params = [entityId];

    if (status && PAYABLE_STATUSES.includes(status)) {
      query += ' AND status = ?';
      params.push(status);
    }

    const rows = await executeQuery(query, params);

    return parseFloat(rows[0].total);
  }

  /**
   * Get payable statistics
   * @returns {Promise<object>} Statistics object
   */
  static async getPayableStats() {
    // Total payables
    const totalQuery = 'SELECT COUNT(*) as total FROM Accounts_Payable';
    const totalRows = await executeQuery(totalQuery);
    const totalPayables = totalRows[0].total;

    // Amount by status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as amount
      FROM Accounts_Payable
      GROUP BY status
    `;
    const statusRows = await executeQuery(statusQuery);

    const statusStats = {
      due: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 }
    };

    statusRows.forEach(row => {
      statusStats[row.status] = {
        count: row.count,
        amount: parseFloat(row.amount)
      };
    });

    // Due soon count
    const dueSoonQuery = `
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
      FROM Accounts_Payable
      WHERE status = 'due' AND due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    `;
    const dueSoonRows = await executeQuery(dueSoonQuery);

    // Payables by entity type
    const entityTypeQuery = `
      SELECT 
        ee.type,
        COUNT(ap.id) as count,
        COALESCE(SUM(ap.total_amount), 0) as amount
      FROM Accounts_Payable ap
      LEFT JOIN External_Entities ee ON ap.entity_id = ee.id
      GROUP BY ee.type
    `;
    const entityTypeRows = await executeQuery(entityTypeQuery);

    const byEntityType = {};
    entityTypeRows.forEach(row => {
      byEntityType[row.type] = {
        count: row.count,
        amount: parseFloat(row.amount)
      };
    });

    return {
      totalPayables,
      totalAmountDue: statusStats.due.amount,
      totalAmountPaid: statusStats.paid.amount,
      totalAmountOverdue: statusStats.overdue.amount,
      overdueCount: statusStats.overdue.count,
      dueSoonCount: dueSoonRows[0].count,
      dueSoonAmount: parseFloat(dueSoonRows[0].amount),
      byStatus: statusStats,
      byEntityType
    };
  }

  /**
   * Transform database payable to camelCase format
   * @private
   */
  static _transformAccountsPayable(dbPayable) {
    return {
      id: dbPayable.id,
      entityId: dbPayable.entity_id,
      entityName: dbPayable.entity_name,
      entityType: dbPayable.entity_type,
      referenceCode: dbPayable.reference_code,
      description: dbPayable.description,
      totalAmount: parseFloat(dbPayable.total_amount),
      dueDate: dbPayable.due_date,
      paidDate: dbPayable.paid_date,
      status: dbPayable.status,
      paymentMethod: dbPayable.payment_method,
      notes: dbPayable.notes,
      createdAt: dbPayable.created_at,
      updatedAt: dbPayable.updated_at
    };
  }
}

module.exports = { AccountsPayable, PAYABLE_STATUSES };
