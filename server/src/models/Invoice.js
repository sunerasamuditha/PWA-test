const { executeQuery } = require('../config/database');

const PAYMENT_METHODS = ['cash', 'card', 'insurance_credit', 'bank_transfer']; // Canonical payment method values
const INVOICE_STATUSES = ['pending', 'paid', 'overdue', 'partially_paid'];
const INVOICE_TYPES = ['opd', 'admission', 'running_bill'];

class Invoice {
  /**
   * Find invoice by ID with complete details
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        i.*,
        u_patient.first_name as patient_first_name,
        u_patient.last_name as patient_last_name,
        u_patient.email as patient_email,
        u_patient.phone as patient_phone,
        u_staff.first_name as staff_first_name,
        u_staff.last_name as staff_last_name,
        a.appointment_datetime
      FROM Invoices i
      LEFT JOIN Users u_patient ON i.patient_user_id = u_patient.id
      LEFT JOIN Users u_staff ON i.prepared_by_staff_id = u_staff.id
      LEFT JOIN Appointments a ON i.appointment_id = a.id
      WHERE i.id = ?
    `;
    
    const [rows] = await executeQuery(query, [id], connection);
    if (rows.length === 0) return null;

    const invoice = this._transformInvoice(rows[0]);
    
    // Fetch invoice items
    const itemsQuery = `
      SELECT 
        ii.*,
        s.name as service_name,
        s.service_category
      FROM Invoice_Items ii
      LEFT JOIN Services s ON ii.service_id = s.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id
    `;
    
    const [itemRows] = await executeQuery(itemsQuery, [id], connection);
    invoice.items = itemRows.map(item => this._transformInvoiceItem(item));

    return invoice;
  }

  /**
   * Find invoices by patient user ID
   */
  static async findByPatientUserId(patientUserId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      invoice_type = null,
      startDate = null,
      endDate = null,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = filters;

    // Build base FROM and WHERE clause
    let fromWhereClause = `
      FROM Invoices i
      LEFT JOIN Users u_patient ON i.patient_user_id = u_patient.id
      WHERE i.patient_user_id = ?
    `;
    const params = [patientUserId];

    // Status filter
    if (status) {
      fromWhereClause += ' AND i.status = ?';
      params.push(status);
    }

    // Invoice type filter
    if (invoice_type) {
      fromWhereClause += ' AND i.invoice_type = ?';
      params.push(invoice_type);
    }

    // Date range filter
    if (startDate) {
      fromWhereClause += ' AND i.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      fromWhereClause += ' AND i.created_at <= ?';
      params.push(endDate);
    }

    // Build count query explicitly
    const countQuery = `SELECT COUNT(*) as total ${fromWhereClause}`;
    const [countResult] = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Build data query explicitly
    let dataQuery = `
      SELECT 
        i.*,
        u_patient.first_name as patient_first_name,
        u_patient.last_name as patient_last_name,
        u_patient.email as patient_email
      ${fromWhereClause}
    `;

    // Add sorting
    const allowedSortFields = ['created_at', 'total_amount', 'status', 'invoice_number'];
    const sortField = allowedSortFields.includes(sort_by) ? `i.${sort_by}` : 'i.created_at';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    dataQuery += ` ORDER BY ${sortField} ${sortDirection}`;

    // Add pagination
    const offset = (page - 1) * limit;
    dataQuery += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await executeQuery(dataQuery, params);
    const invoices = rows.map(row => this._transformInvoice(row));

    return {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new invoice
   */
  static async create(invoiceData, connection = null) {
    const {
      invoice_number,
      appointment_id = null,
      patient_user_id,
      prepared_by_staff_id = null,
      total_amount,
      payment_method,
      status = 'pending',
      invoice_type,
      due_date = null
    } = invoiceData;

    const query = `
      INSERT INTO Invoices 
      (invoice_number, appointment_id, patient_user_id, prepared_by_staff_id, 
       total_amount, payment_method, status, invoice_type, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      invoice_number,
      appointment_id,
      patient_user_id,
      prepared_by_staff_id,
      total_amount,
      payment_method,
      status,
      invoice_type,
      due_date
    ];

    const [result] = await executeQuery(query, params, connection);
    return this.findById(result.insertId, connection);
  }

  /**
   * Update invoice by ID
   */
  static async updateById(id, invoiceData, connection = null) {
    const allowedFields = ['total_amount', 'status', 'due_date', 'payment_method'];
    const updates = [];
    const params = [];

    Object.keys(invoiceData).forEach(key => {
      if (allowedFields.includes(key) && invoiceData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(invoiceData[key]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `UPDATE Invoices SET ${updates.join(', ')} WHERE id = ?`;
    await executeQuery(query, params, connection);

    return this.findById(id, connection);
  }

  /**
   * Update invoice status
   */
  static async updateStatus(id, newStatus, connection = null) {
    if (!INVOICE_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const query = 'UPDATE Invoices SET status = ? WHERE id = ?';
    await executeQuery(query, [newStatus, id], connection);
    return this.findById(id, connection);
  }

  /**
   * Get all invoices with filters (for staff/admin)
   */
  static async getAllInvoices(filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      invoice_type = null,
      patient_user_id = null,
      startDate = null,
      endDate = null,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = filters;

    // Build base FROM and WHERE clause
    let fromWhereClause = `
      FROM Invoices i
      LEFT JOIN Users u_patient ON i.patient_user_id = u_patient.id
      LEFT JOIN Users u_staff ON i.prepared_by_staff_id = u_staff.id
      WHERE 1=1
    `;
    const params = [];

    // Patient filter
    if (patient_user_id) {
      fromWhereClause += ' AND i.patient_user_id = ?';
      params.push(patient_user_id);
    }

    // Status filter
    if (status) {
      fromWhereClause += ' AND i.status = ?';
      params.push(status);
    }

    // Invoice type filter
    if (invoice_type) {
      fromWhereClause += ' AND i.invoice_type = ?';
      params.push(invoice_type);
    }

    // Date range filter
    if (startDate) {
      fromWhereClause += ' AND i.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      fromWhereClause += ' AND i.created_at <= ?';
      params.push(endDate);
    }

    // Build count query explicitly
    const countQuery = `SELECT COUNT(*) as total ${fromWhereClause}`;
    const [countResult] = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Build data query explicitly
    let dataQuery = `
      SELECT 
        i.*,
        u_patient.first_name as patient_first_name,
        u_patient.last_name as patient_last_name,
        u_patient.email as patient_email,
        u_staff.first_name as staff_first_name,
        u_staff.last_name as staff_last_name
      ${fromWhereClause}
    `;

    // Add sorting
    const allowedSortFields = ['created_at', 'total_amount', 'status', 'invoice_number'];
    const sortField = allowedSortFields.includes(sort_by) ? `i.${sort_by}` : 'i.created_at';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    dataQuery += ` ORDER BY ${sortField} ${sortDirection}`;

    // Add pagination
    const offset = (page - 1) * limit;
    dataQuery += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await executeQuery(dataQuery, params);
    const invoices = rows.map(row => this._transformInvoice(row));

    return {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get invoice with items
   */
  static async getInvoiceWithItems(id, connection = null) {
    return this.findById(id, connection);
  }

  /**
   * Calculate remaining balance for invoice
   */
  static async calculateRemainingBalance(id, connection = null) {
    const query = `
      SELECT 
        i.total_amount,
        COALESCE(SUM(p.amount), 0) as paid_amount
      FROM Invoices i
      LEFT JOIN Payments p ON i.id = p.invoice_id AND p.payment_status = 'completed'
      WHERE i.id = ?
      GROUP BY i.id, i.total_amount
    `;
    
    const [rows] = await executeQuery(query, [id], connection);
    if (rows.length === 0) return null;

    const totalAmount = parseFloat(rows[0].total_amount);
    const paidAmount = parseFloat(rows[0].paid_amount);
    const remainingBalance = totalAmount - paidAmount;

    return {
      totalAmount,
      paidAmount,
      remainingBalance: Math.max(0, remainingBalance)
    };
  }

  /**
   * Get overdue invoices
   */
  static async getOverdueInvoices() {
    const query = `
      SELECT i.*
      FROM Invoices i
      WHERE (i.status = 'pending' OR i.status = 'partially_paid')
        AND i.due_date < CURDATE()
      ORDER BY i.due_date ASC
    `;
    
    const [rows] = await executeQuery(query);
    return rows.map(row => this._transformInvoice(row));
  }

  /**
   * Transform database invoice object to camelCase
   */
  static _transformInvoice(dbInvoice) {
    if (!dbInvoice) return null;

    return {
      id: dbInvoice.id,
      invoiceNumber: dbInvoice.invoice_number,
      appointmentId: dbInvoice.appointment_id,
      patientUserId: dbInvoice.patient_user_id,
      preparedByStaffId: dbInvoice.prepared_by_staff_id,
      totalAmount: parseFloat(dbInvoice.total_amount),
      paymentMethod: dbInvoice.payment_method,
      status: dbInvoice.status,
      invoiceType: dbInvoice.invoice_type,
      dueDate: dbInvoice.due_date,
      createdAt: dbInvoice.created_at,
      updatedAt: dbInvoice.updated_at,
      // Patient info
      patientFirstName: dbInvoice.patient_first_name,
      patientLastName: dbInvoice.patient_last_name,
      patientEmail: dbInvoice.patient_email,
      patientPhone: dbInvoice.patient_phone,
      // Staff info
      staffFirstName: dbInvoice.staff_first_name,
      staffLastName: dbInvoice.staff_last_name,
      // Appointment info
      appointmentDatetime: dbInvoice.appointment_datetime
    };
  }

  /**
   * Transform invoice item
   */
  static _transformInvoiceItem(dbItem) {
    if (!dbItem) return null;

    return {
      id: dbItem.id,
      invoiceId: dbItem.invoice_id,
      serviceId: dbItem.service_id,
      itemDescription: dbItem.item_description,
      quantity: dbItem.quantity,
      unitPrice: parseFloat(dbItem.unit_price),
      totalPrice: parseFloat(dbItem.total_price),
      createdAt: dbItem.created_at,
      // Service info if joined
      serviceName: dbItem.service_name,
      serviceCategory: dbItem.service_category
    };
  }
}

module.exports = { Invoice, PAYMENT_METHODS, INVOICE_STATUSES, INVOICE_TYPES };
