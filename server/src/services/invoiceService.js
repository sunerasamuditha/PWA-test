const { Invoice, PAYMENT_METHODS, INVOICE_STATUSES, INVOICE_TYPES } = require('../models/Invoice');
const { InvoiceItem } = require('../models/InvoiceItem');
const { Payment } = require('../models/Payment');
const { User } = require('../models/User');
const { Appointment } = require('../models/Appointment');
const { executeTransaction, executeQuery } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceNumberGenerator');
const { AppError } = require('../middleware/errorHandler');

class InvoiceService {
  /**
   * Create new invoice with items
   */
  async createInvoice(invoiceData, createdBy) {
    return executeTransaction(async (connection) => {
      try {
        // Validate invoice data
        this._validateInvoiceData(invoiceData);

        // Validate items
        if (!invoiceData.items || invoiceData.items.length === 0) {
          throw new AppError('Invoice must have at least one item', 400);
        }

        this._validateInvoiceItems(invoiceData.items);

        // Validate patient exists
        const patient = await User.findById(invoiceData.patient_user_id, connection);
        if (!patient) {
          throw new AppError('Patient not found', 404);
        }

        if (patient.role !== 'patient') {
          throw new AppError('User is not a patient', 400);
        }

        // Validate appointment if provided
        if (invoiceData.appointment_id) {
          const appointment = await Appointment.findById(invoiceData.appointment_id, connection);
          if (!appointment) {
            throw new AppError('Appointment not found', 404);
          }

          if (appointment.patientUserId !== invoiceData.patient_user_id) {
            throw new AppError('Appointment does not belong to the specified patient', 400);
          }
        }

        // Calculate total from items
        const totalAmount = invoiceData.items.reduce((sum, item) => {
          return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price));
        }, 0);

        // Generate invoice number atomically within same transaction
        const invoiceNumber = await generateInvoiceNumber(connection);

        // Create invoice
        const invoice = await Invoice.create({
          invoice_number: invoiceNumber,
          appointment_id: invoiceData.appointment_id || null,
          patient_user_id: invoiceData.patient_user_id,
          prepared_by_staff_id: createdBy || null,
          total_amount: totalAmount,
          payment_method: invoiceData.payment_method,
          status: 'pending',
          invoice_type: invoiceData.invoice_type,
          due_date: invoiceData.due_date || null
        }, connection);

        // Create invoice items - ensure total_price is computed
        const itemsWithTotals = invoiceData.items.map(item => ({
          ...item,
          total_price: Math.round(parseFloat(item.quantity) * parseFloat(item.unit_price) * 100) / 100
        }));

        const items = await InvoiceItem.createBatch(
          invoice.id,
          itemsWithTotals,
          connection
        );

        // Recalculate total from inserted items to avoid rounding drift
        const recalculatedTotal = await InvoiceItem.calculateInvoiceTotal(invoice.id, connection);
        
        // Update invoice with recalculated total
        await Invoice.updateById(invoice.id, { total_amount: recalculatedTotal }, connection);
        invoice.totalAmount = recalculatedTotal;

        // Return complete invoice with items
        return {
          ...invoice,
          items
        };

      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to create invoice', 500, error);
      }
    });
  }

  /**
   * Get invoices by patient
   * 
   * NOTE: This method can perform on-demand status updates based on payment state and due dates.
   * Status updates are opt-in via updateStatus parameter to avoid side effects on reads.
   * For automatic updates, consider using a scheduled background job instead.
   * 
   * @param {number} patientUserId - Patient user ID
   * @param {Object} filters - Query filters
   * @param {boolean} filters.updateStatus - If true, update invoice statuses based on current state (default: false)
   */
  async getInvoicesByPatient(patientUserId, filters = {}) {
    try {
      const { updateStatus = false, ...queryFilters } = filters;
      const result = await Invoice.findByPatientUserId(patientUserId, queryFilters);
      
      // Build aggregated query for balances and overdue status in one go
      if (result.invoices.length > 0) {
        const invoiceIds = result.invoices.map(inv => inv.id);
        const placeholders = invoiceIds.map(() => '?').join(',');
        
        const aggregateQuery = `
          SELECT 
            i.id,
            i.status as current_status,
            i.total_amount,
            i.due_date,
            COALESCE(SUM(p.amount), 0) as paid_amount,
            (i.total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance,
            CASE 
              WHEN i.due_date IS NOT NULL AND i.due_date < CURDATE() 
                AND (i.total_amount - COALESCE(SUM(p.amount), 0)) > 0 
              THEN 1 
              ELSE 0 
            END as is_overdue
          FROM Invoices i
          LEFT JOIN Payments p ON i.id = p.invoice_id AND p.payment_status = 'completed'
          WHERE i.id IN (${placeholders})
          GROUP BY i.id, i.status, i.total_amount, i.due_date
        `;
        
        const [balanceRows] = await executeQuery(aggregateQuery, invoiceIds);
        const balanceMap = new Map(balanceRows.map(row => [row.id, row]));
        
        // Update invoices with balances and optionally update status
        for (const invoice of result.invoices) {
          const balanceData = balanceMap.get(invoice.id);
          if (balanceData) {
            invoice.paidAmount = parseFloat(balanceData.paid_amount);
            invoice.remainingBalance = parseFloat(balanceData.remaining_balance);
            
            // Only update status if explicitly requested via flag
            if (updateStatus) {
              const newStatus = this._determineNewStatus(balanceData);
              
              // Only update if status actually changed
              if (newStatus !== balanceData.current_status) {
                await Invoice.updateStatus(invoice.id, newStatus);
                invoice.status = newStatus;
              }
            }
          }
        }
      }

      return result;
    } catch (error) {
      throw new AppError('Failed to fetch invoices', 500, error);
    }
  }

  /**
   * Get invoice by ID with access control
   */
  async getInvoiceById(invoiceId, requesterId, requesterRole, requesterPermissions = []) {
    try {
      const invoice = await Invoice.getInvoiceWithItems(invoiceId);
      
      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      // Access control
      const isPatient = requesterRole === 'patient';
      const isAdmin = ['admin', 'super_admin'].includes(requesterRole);
      const hasPermission = requesterPermissions.includes('process_payments');
      const isOwnInvoice = invoice.patientUserId === requesterId;

      if (isPatient && !isOwnInvoice) {
        throw new AppError('Access denied: You can only view your own invoices', 403);
      }

      if (!isPatient && !isAdmin && !hasPermission) {
        throw new AppError('Access denied: Insufficient permissions', 403);
      }

      // Calculate remaining balance
      const balance = await Invoice.calculateRemainingBalance(invoiceId);
      invoice.paidAmount = balance.paidAmount;
      invoice.remainingBalance = balance.remainingBalance;

      // Fetch payments for this invoice
      invoice.payments = await Payment.findByInvoiceId(invoiceId);

      return invoice;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch invoice', 500, error);
    }
  }

  /**
   * Get all invoices (for staff/admin)
   * 
   * NOTE: This method can perform on-demand status updates based on payment state and due dates.
   * Status updates are opt-in via updateStatus parameter to avoid side effects on reads.
   * For automatic updates, consider using a scheduled background job instead.
   * 
   * @param {Object} filters - Query filters
   * @param {boolean} filters.updateStatus - If true, update invoice statuses based on current state (default: false)
   */
  async getAllInvoices(filters = {}) {
    try {
      const { updateStatus = false, ...queryFilters } = filters;
      const result = await Invoice.getAllInvoices(queryFilters);
      
      // Build aggregated query for balances and overdue status in one go
      if (result.invoices.length > 0) {
        const invoiceIds = result.invoices.map(inv => inv.id);
        const placeholders = invoiceIds.map(() => '?').join(',');
        
        const aggregateQuery = `
          SELECT 
            i.id,
            i.status as current_status,
            i.total_amount,
            i.due_date,
            COALESCE(SUM(p.amount), 0) as paid_amount,
            (i.total_amount - COALESCE(SUM(p.amount), 0)) as remaining_balance,
            CASE 
              WHEN i.due_date IS NOT NULL AND i.due_date < CURDATE() 
                AND (i.total_amount - COALESCE(SUM(p.amount), 0)) > 0 
              THEN 1 
              ELSE 0 
            END as is_overdue
          FROM Invoices i
          LEFT JOIN Payments p ON i.id = p.invoice_id AND p.payment_status = 'completed'
          WHERE i.id IN (${placeholders})
          GROUP BY i.id, i.status, i.total_amount, i.due_date
        `;
        
        const [balanceRows] = await executeQuery(aggregateQuery, invoiceIds);
        const balanceMap = new Map(balanceRows.map(row => [row.id, row]));
        
        // Update invoices with balances and optionally update status
        for (const invoice of result.invoices) {
          const balanceData = balanceMap.get(invoice.id);
          if (balanceData) {
            // Always enrich response with computed balances
            invoice.paidAmount = parseFloat(balanceData.paid_amount);
            invoice.remainingBalance = parseFloat(balanceData.remaining_balance);
            
            // Only update status if explicitly requested via flag
            if (updateStatus) {
              const newStatus = this._determineNewStatus(balanceData);
              
              // Only update if status actually changed
              if (newStatus !== balanceData.current_status) {
                await Invoice.updateStatus(invoice.id, newStatus);
                invoice.status = newStatus;
              }
            }
          }
        }
      }

      return result;
    } catch (error) {
      throw new AppError('Failed to fetch invoices', 500, error);
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(invoiceId, updateData, updatedBy) {
    return executeTransaction(async (connection) => {
      try {
        const existingInvoice = await Invoice.findById(invoiceId, connection);
        
        if (!existingInvoice) {
          throw new AppError('Invoice not found', 404);
        }

        // Don't allow updating paid invoices
        if (existingInvoice.status === 'paid') {
          throw new AppError('Cannot update a paid invoice', 400);
        }

        // Validate payment method if provided
        if (updateData.payment_method && !PAYMENT_METHODS.includes(updateData.payment_method)) {
          throw new AppError(`Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
        }

        // Validate status if provided
        if (updateData.status && !INVOICE_STATUSES.includes(updateData.status)) {
          throw new AppError(`Invalid status. Must be one of: ${INVOICE_STATUSES.join(', ')}`, 400);
        }

        const updatedInvoice = await Invoice.updateById(invoiceId, updateData, connection);
        return updatedInvoice;
        
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to update invoice', 500, error);
      }
    });
  }

  /**
   * Add item to invoice
   */
  async addInvoiceItem(invoiceId, itemData, addedBy) {
    return executeTransaction(async (connection) => {
      try {
        const invoice = await Invoice.findById(invoiceId, connection);
        
        if (!invoice) {
          throw new AppError('Invoice not found', 404);
        }

        if (invoice.status === 'paid') {
          throw new AppError('Cannot add items to a paid invoice', 400);
        }

        // Validate and create item
        this._validateInvoiceItems([itemData]);
        
        const item = await InvoiceItem.create({
          invoice_id: invoiceId,
          ...itemData,
          total_price: parseFloat(itemData.quantity) * parseFloat(itemData.unit_price)
        }, connection);

        // Recalculate total and round to avoid floating-point artifacts
        const newTotal = await InvoiceItem.calculateInvoiceTotal(invoiceId, connection);
        const roundedTotal = Math.round(newTotal * 100) / 100;
        await Invoice.updateById(invoiceId, { total_amount: roundedTotal }, connection);

        // Update invoice status after total amount change
        await this.updateInvoiceStatus(invoiceId, connection);

        // Return updated invoice with current status and balances
        return await Invoice.getInvoiceWithItems(invoiceId, connection);
        
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to add invoice item', 500, error);
      }
    });
  }

  /**
   * Remove item from invoice
   */
  async removeInvoiceItem(invoiceId, itemId, removedBy) {
    return executeTransaction(async (connection) => {
      try {
        const invoice = await Invoice.findById(invoiceId, connection);
        
        if (!invoice) {
          throw new AppError('Invoice not found', 404);
        }

        if (invoice.status === 'paid') {
          throw new AppError('Cannot remove items from a paid invoice', 400);
        }

        // Ensure invoice has items
        const items = await InvoiceItem.findByInvoiceId(invoiceId, connection);
        if (items.length <= 1) {
          throw new AppError('Cannot remove the last item from an invoice', 400);
        }

        // Verify item belongs to invoice
        const item = items.find(i => i.id === itemId);
        if (!item) {
          throw new AppError('Item not found in this invoice', 404);
        }

        await InvoiceItem.deleteById(itemId, connection);

        // Recalculate total and round to avoid floating-point artifacts
        const newTotal = await InvoiceItem.calculateInvoiceTotal(invoiceId, connection);
        const roundedTotal = Math.round(newTotal * 100) / 100;
        await Invoice.updateById(invoiceId, { total_amount: roundedTotal }, connection);

        // Update invoice status after total amount change
        await this.updateInvoiceStatus(invoiceId, connection);

        // Return updated invoice with current status and balances
        return await Invoice.getInvoiceWithItems(invoiceId, connection);
        
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to remove invoice item', 500, error);
      }
    });
  }

  /**
   * Update invoice status based on payments
   * Uses database time (CURDATE()) to avoid timezone drift
   */
  async updateInvoiceStatus(invoiceId, connection = null) {
    try {
      const balance = await Invoice.calculateRemainingBalance(invoiceId, connection);
      const invoice = await Invoice.findById(invoiceId, connection);
      
      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      let newStatus = invoice.status;

      // Check if past due using database current date to avoid timezone drift
      const [dateCheck] = await executeQuery(
        'SELECT ? < CURDATE() as is_past_due',
        [invoice.dueDate],
        connection
      );
      const isPastDue = invoice.dueDate && dateCheck[0].is_past_due === 1;

      // Determine status in priority order
      if (balance.remainingBalance <= 0) {
        newStatus = 'paid';
      } else if (isPastDue && balance.remainingBalance > 0) {
        newStatus = 'overdue';
      } else if (balance.paidAmount > 0 && balance.remainingBalance > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'pending';
      }

      if (newStatus !== invoice.status) {
        await Invoice.updateStatus(invoiceId, newStatus, connection);
      }

      return newStatus;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update invoice status', 500, error);
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats() {
    try {
      // Single SQL query to get all statistics with aggregation
      const statsQuery = `
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) as overdue_count,
          COUNT(CASE WHEN i.status = 'partially_paid' THEN 1 END) as partially_paid_count,
          COUNT(CASE WHEN i.invoice_type = 'opd' THEN 1 END) as opd_count,
          COUNT(CASE WHEN i.invoice_type = 'admission' THEN 1 END) as admission_count,
          COUNT(CASE WHEN i.invoice_type = 'running_bill' THEN 1 END) as running_bill_count,
          SUM(i.total_amount) as total_billed,
          SUM(i.total_amount - COALESCE(p.paid_amount, 0)) as total_outstanding
        FROM Invoices i
        LEFT JOIN (
          SELECT 
            invoice_id,
            SUM(amount) as paid_amount
          FROM Payments
          WHERE payment_status = 'completed'
          GROUP BY invoice_id
        ) p ON i.id = p.invoice_id
      `;
      
      const [rows] = await executeQuery(statsQuery);
      const result = rows[0];
      
      const stats = {
        totalInvoices: parseInt(result.total_invoices) || 0,
        invoicesByStatus: {
          pending: parseInt(result.pending_count) || 0,
          paid: parseInt(result.paid_count) || 0,
          overdue: parseInt(result.overdue_count) || 0,
          partially_paid: parseInt(result.partially_paid_count) || 0
        },
        invoicesByType: {
          opd: parseInt(result.opd_count) || 0,
          admission: parseInt(result.admission_count) || 0,
          running_bill: parseInt(result.running_bill_count) || 0
        },
        totalBilled: parseFloat(result.total_billed) || 0,
        outstandingBalance: parseFloat(result.total_outstanding) || 0
      };

      return stats;
    } catch (error) {
      throw new AppError('Failed to fetch invoice statistics', 500, error);
    }
  }

  /**
   * Get invoice statistics for a specific patient
   */
  async getInvoiceStatsByPatient(patientUserId) {
    try {
      // Single SQL query to get patient-specific statistics with aggregation
      const statsQuery = `
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) as overdue_count,
          COUNT(CASE WHEN i.status = 'partially_paid' THEN 1 END) as partially_paid_count,
          COUNT(CASE WHEN i.invoice_type = 'opd' THEN 1 END) as opd_count,
          COUNT(CASE WHEN i.invoice_type = 'admission' THEN 1 END) as admission_count,
          COUNT(CASE WHEN i.invoice_type = 'running_bill' THEN 1 END) as running_bill_count,
          SUM(i.total_amount) as total_billed,
          SUM(i.total_amount - COALESCE(p.paid_amount, 0)) as total_outstanding
        FROM Invoices i
        LEFT JOIN (
          SELECT 
            invoice_id,
            SUM(amount) as paid_amount
          FROM Payments
          WHERE payment_status = 'completed'
          GROUP BY invoice_id
        ) p ON i.id = p.invoice_id
        WHERE i.patient_user_id = ?
      `;
      
      const [rows] = await executeQuery(statsQuery, [patientUserId]);
      const result = rows[0];
      
      const stats = {
        totalInvoices: parseInt(result.total_invoices) || 0,
        invoicesByStatus: {
          pending: parseInt(result.pending_count) || 0,
          paid: parseInt(result.paid_count) || 0,
          overdue: parseInt(result.overdue_count) || 0,
          partially_paid: parseInt(result.partially_paid_count) || 0
        },
        invoicesByType: {
          opd: parseInt(result.opd_count) || 0,
          admission: parseInt(result.admission_count) || 0,
          running_bill: parseInt(result.running_bill_count) || 0
        },
        totalBilled: parseFloat(result.total_billed) || 0,
        outstandingBalance: parseFloat(result.total_outstanding) || 0
      };

      return stats;
    } catch (error) {
      throw new AppError('Failed to fetch patient invoice statistics', 500, error);
    }
  }

  /**
   * Determine new status based on balance data
   * Shared logic used by both getInvoicesByPatient and getAllInvoices
   * 
   * @private
   * @param {Object} balanceData - Balance data containing is_overdue, remaining_balance, paid_amount, current_status
   * @returns {string} New status
   */
  _determineNewStatus(balanceData) {
    const shouldBeOverdue = balanceData.is_overdue === 1;
    const shouldBePaid = balanceData.remaining_balance <= 0;
    const shouldBePartiallyPaid = balanceData.paid_amount > 0 && balanceData.remaining_balance > 0;
    
    let newStatus = balanceData.current_status;
    if (shouldBePaid && balanceData.current_status !== 'paid') {
      newStatus = 'paid';
    } else if (shouldBeOverdue && balanceData.current_status !== 'overdue' && balanceData.current_status !== 'paid') {
      newStatus = 'overdue';
    } else if (shouldBePartiallyPaid && balanceData.current_status === 'pending') {
      newStatus = 'partially_paid';
    }
    
    return newStatus;
  }

  /**
   * Validate invoice data
   */
  _validateInvoiceData(invoiceData) {
    if (!invoiceData.patient_user_id) {
      throw new AppError('Patient user ID is required', 400);
    }

    if (!invoiceData.invoice_type || !INVOICE_TYPES.includes(invoiceData.invoice_type)) {
      throw new AppError(`Invalid invoice type. Must be one of: ${INVOICE_TYPES.join(', ')}`, 400);
    }

    if (!invoiceData.payment_method || !PAYMENT_METHODS.includes(invoiceData.payment_method)) {
      throw new AppError(`Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
    }

    // If payment method is insurance_credit, due_date is required
    if (invoiceData.payment_method === 'insurance_credit' && !invoiceData.due_date) {
      throw new AppError('Due date is required for insurance credit payment method', 400);
    }
  }

  /**
   * Validate invoice items array
   */
  _validateInvoiceItems(items) {
    if (!Array.isArray(items)) {
      throw new AppError('Items must be an array', 400);
    }

    for (const item of items) {
      if (!item.item_description || item.item_description.trim() === '') {
        throw new AppError('Item description is required', 400);
      }

      if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
        throw new AppError('Item quantity must be a positive number', 400);
      }

      if (!item.unit_price || isNaN(item.unit_price) || item.unit_price <= 0) {
        throw new AppError('Item unit price must be a positive number', 400);
      }

      // Validate decimal places
      if (!/^\d+(\.\d{1,2})?$/.test(item.unit_price.toString())) {
        throw new AppError('Unit price can have maximum 2 decimal places', 400);
      }
    }
  }
}

module.exports = new InvoiceService();
