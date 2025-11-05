const { executeQuery } = require('../config/database');

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'insurance', 'insurance_credit']; // Use canonical enum values
const PAYMENT_STATUSES = ['completed', 'pending', 'failed'];

class Payment {
  /**
   * Find payment by ID
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        p.*,
        u_staff.first_name as staff_first_name,
        u_staff.last_name as staff_last_name,
        i.invoice_number,
        i.patient_user_id
      FROM Payments p
      LEFT JOIN Users u_staff ON p.recorded_by_staff_id = u_staff.id
      LEFT JOIN Invoices i ON p.invoice_id = i.id
      WHERE p.id = ?
    `;
    
    const [rows] = await executeQuery(query, [id], connection);
    return rows.length > 0 ? this._transformPayment(rows[0]) : null;
  }

  /**
   * Find payments by invoice ID
   */
  static async findByInvoiceId(invoiceId, connection = null) {
    const query = `
      SELECT 
        p.*,
        u_staff.first_name as staff_first_name,
        u_staff.last_name as staff_last_name
      FROM Payments p
      LEFT JOIN Users u_staff ON p.recorded_by_staff_id = u_staff.id
      WHERE p.invoice_id = ?
      ORDER BY p.paid_at DESC
    `;
    
    const [rows] = await executeQuery(query, [invoiceId], connection);
    return rows.map(row => this._transformPayment(row));
  }

  /**
   * Create new payment
   */
  static async create(paymentData, connection = null) {
    const {
      invoice_id,
      amount,
      payment_method,
      transaction_id = null,
      payment_status = 'completed',
      notes = null,
      paid_at = null,
      recorded_by_staff_id = null
    } = paymentData;

    const query = `
      INSERT INTO Payments 
      (invoice_id, amount, payment_method, transaction_id, payment_status, 
       notes, paid_at, recorded_by_staff_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      invoice_id,
      amount,
      payment_method,
      transaction_id,
      payment_status,
      notes,
      paid_at || new Date(),
      recorded_by_staff_id
    ];

    const [result] = await executeQuery(query, params, connection);
    return this.findById(result.insertId, connection);
  }

  /**
   * Get all payments with filters
   */
  static async getAllPayments(filters = {}) {
    const {
      page = 1,
      limit = 20,
      invoice_id = null,
      patient_user_id = null,
      payment_method = null,
      payment_status = null,
      startDate = null,
      endDate = null,
      sort_by = 'paid_at',
      sort_order = 'DESC'
    } = filters;

    let query = `
      SELECT 
        p.*,
        u_staff.first_name as staff_first_name,
        u_staff.last_name as staff_last_name,
        i.invoice_number,
        i.patient_user_id
      FROM Payments p
      LEFT JOIN Users u_staff ON p.recorded_by_staff_id = u_staff.id
      LEFT JOIN Invoices i ON p.invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    // Invoice filter
    if (invoice_id) {
      query += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }

    // Patient filter
    if (patient_user_id) {
      query += ' AND i.patient_user_id = ?';
      params.push(patient_user_id);
    }

    // Payment method filter
    if (payment_method) {
      query += ' AND p.payment_method = ?';
      params.push(payment_method);
    }

    // Payment status filter
    if (payment_status) {
      query += ' AND p.payment_status = ?';
      params.push(payment_status);
    }

    // Date range filter
    if (startDate) {
      query += ' AND p.paid_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND p.paid_at <= ?';
      params.push(endDate);
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['paid_at', 'amount', 'payment_method'];
    const sortField = allowedSortFields.includes(sort_by) ? `p.${sort_by}` : 'p.paid_at';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await executeQuery(query, params);
    const payments = rows.map(row => this._transformPayment(row));

    return {
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get total payments for an invoice
   */
  static async getTotalByInvoice(invoiceId, connection = null) {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM Payments
      WHERE invoice_id = ? AND payment_status = 'completed'
    `;
    
    const [rows] = await executeQuery(query, [invoiceId], connection);
    return parseFloat(rows[0].total);
  }

  /**
   * Get payment statistics
   */
  static async getPaymentStats() {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'card' AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as card_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'bank_transfer' AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as bank_transfer_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'insurance_credit' AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as insurance_revenue,
        COALESCE(SUM(CASE WHEN DATE(paid_at) = CURDATE() AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as week_revenue,
        COALESCE(SUM(CASE WHEN MONTH(paid_at) = MONTH(CURDATE()) AND YEAR(paid_at) = YEAR(CURDATE()) AND payment_status = 'completed' THEN amount ELSE 0 END), 0) as month_revenue,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_payments
      FROM Payments
    `;
    
    const [rows] = await executeQuery(query);
    const stats = rows[0];

    return {
      totalPayments: stats.total_payments,
      totalRevenue: parseFloat(stats.total_revenue),
      revenueByMethod: {
        cash: parseFloat(stats.cash_revenue),
        card: parseFloat(stats.card_revenue),
        bankTransfer: parseFloat(stats.bank_transfer_revenue),
        insurance: parseFloat(stats.insurance_revenue)
      },
      revenueByPeriod: {
        today: parseFloat(stats.today_revenue),
        week: parseFloat(stats.week_revenue),
        month: parseFloat(stats.month_revenue)
      },
      pendingPayments: stats.pending_payments,
      failedPayments: stats.failed_payments
    };
  }

  /**
   * Transform database payment object to camelCase
   */
  static _transformPayment(dbPayment) {
    if (!dbPayment) return null;

    return {
      id: dbPayment.id,
      invoiceId: dbPayment.invoice_id,
      amount: parseFloat(dbPayment.amount),
      paymentMethod: dbPayment.payment_method,
      transactionId: dbPayment.transaction_id,
      paymentStatus: dbPayment.payment_status,
      notes: dbPayment.notes,
      paidAt: dbPayment.paid_at,
      recordedByStaffId: dbPayment.recorded_by_staff_id,
      createdAt: dbPayment.created_at,
      // Staff info
      staffFirstName: dbPayment.staff_first_name,
      staffLastName: dbPayment.staff_last_name,
      staffName: dbPayment.staff_first_name && dbPayment.staff_last_name 
        ? `${dbPayment.staff_first_name} ${dbPayment.staff_last_name}` 
        : null,
      // Invoice info
      invoiceNumber: dbPayment.invoice_number,
      patientUserId: dbPayment.patient_user_id
    };
  }
}

module.exports = { Payment, PAYMENT_METHODS, PAYMENT_STATUSES };
