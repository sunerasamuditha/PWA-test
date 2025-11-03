const { Payment, PAYMENT_METHODS, PAYMENT_STATUSES } = require('../models/Payment');
const { Invoice } = require('../models/Invoice');
const { executeTransaction, executeQuery } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const invoiceService = require('./invoiceService');

class PaymentService {
  /**
   * Record new payment
   */
  async recordPayment(paymentData, recordedBy) {
    return executeTransaction(async (connection) => {
      try {
        // Validate payment data
        this._validatePaymentData(paymentData);

        // Check invoice exists
        const invoice = await Invoice.findById(paymentData.invoice_id, connection);
        if (!invoice) {
          throw new AppError('Invoice not found', 404);
        }

        // Validate payment amount doesn't exceed remaining balance
        await this._validatePaymentAmount(paymentData.invoice_id, paymentData.amount, connection);

        // Create payment record
        const payment = await Payment.create({
          invoice_id: paymentData.invoice_id,
          amount: parseFloat(paymentData.amount),
          payment_method: paymentData.payment_method,
          transaction_id: paymentData.transaction_id || null,
          payment_status: paymentData.payment_status || 'completed',
          notes: paymentData.notes || null,
          paid_at: paymentData.paid_at || new Date(),
          recorded_by_staff_id: recordedBy || null
        }, connection);

        // Update invoice status
        const newStatus = await invoiceService.updateInvoiceStatus(paymentData.invoice_id, connection);

        return {
          payment,
          invoiceStatus: newStatus
        };

      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Failed to record payment', 500, error);
      }
    });
  }

  /**
   * Get payments by invoice
   */
  async getPaymentsByInvoice(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      return await Payment.findByInvoiceId(invoiceId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch payments', 500, error);
    }
  }

  /**
   * Get payments by patient
   */
  async getPaymentsByPatient(patientUserId, filters = {}) {
    try {
      // Use Payment.getAllPayments with patient_user_id filter
      const allFilters = {
        ...filters,
        patient_user_id: patientUserId
      };

      return await Payment.getAllPayments(allFilters);

    } catch (error) {
      throw new AppError('Failed to fetch patient payments', 500, error);
    }
  }

  /**
   * Get payment by ID with access control
   */
  async getPaymentById(paymentId, requesterId, requesterRole, requesterPermissions = []) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      // Access control
      const isPatient = requesterRole === 'patient';
      const isAdmin = ['admin', 'super_admin'].includes(requesterRole);
      const hasPermission = requesterPermissions.includes('process_payments');
      const isOwnPayment = payment.patientUserId === requesterId;

      if (isPatient && !isOwnPayment) {
        throw new AppError('Access denied: You can only view your own payments', 403);
      }

      if (!isPatient && !isAdmin && !hasPermission) {
        throw new AppError('Access denied: Insufficient permissions', 403);
      }

      return payment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch payment', 500, error);
    }
  }

  /**
   * Get all payments (for staff/admin)
   */
  async getAllPayments(filters = {}) {
    try {
      return await Payment.getAllPayments(filters);
    } catch (error) {
      throw new AppError('Failed to fetch payments', 500, error);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    try {
      return await Payment.getPaymentStats();
    } catch (error) {
      throw new AppError('Failed to fetch payment statistics', 500, error);
    }
  }

  /**
   * Validate payment data
   */
  _validatePaymentData(paymentData) {
    if (!paymentData.invoice_id) {
      throw new AppError('Invoice ID is required', 400);
    }

    if (!paymentData.amount || isNaN(paymentData.amount) || paymentData.amount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    if (!paymentData.payment_method || !PAYMENT_METHODS.includes(paymentData.payment_method)) {
      throw new AppError(`Invalid payment method. Must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
    }

    // Transaction ID required for card and bank_transfer
    if (['card', 'bank_transfer'].includes(paymentData.payment_method) && !paymentData.transaction_id) {
      throw new AppError('Transaction ID is required for card and bank transfer payments', 400);
    }

    if (paymentData.payment_status && !PAYMENT_STATUSES.includes(paymentData.payment_status)) {
      throw new AppError(`Invalid payment status. Must be one of: ${PAYMENT_STATUSES.join(', ')}`, 400);
    }

    // Validate decimal places
    if (!/^\d+(\.\d{1,2})?$/.test(paymentData.amount.toString())) {
      throw new AppError('Amount can have maximum 2 decimal places', 400);
    }
  }

  /**
   * Validate payment amount doesn't exceed remaining balance
   */
  async _validatePaymentAmount(invoiceId, paymentAmount, connection = null) {
    // Get remaining balance (considers only completed payments)
    const balance = await Invoice.calculateRemainingBalance(invoiceId, connection);
    
    if (!balance) {
      throw new AppError('Unable to calculate invoice balance', 500);
    }

    // Also check for pending payments to prevent over-collection
    const query = `
      SELECT COALESCE(SUM(amount), 0) as pending_amount
      FROM Payments
      WHERE invoice_id = ? AND payment_status = 'pending'
    `;
    const [rows] = await executeQuery(query, [invoiceId], connection);
    const pendingAmount = parseFloat(rows[0]?.pending_amount || 0);

    const amount = parseFloat(paymentAmount);
    const availableBalance = balance.remainingBalance - pendingAmount;
    
    if (amount > availableBalance) {
      throw new AppError(
        `Payment amount (${amount}) exceeds available balance (${availableBalance}). Remaining: ${balance.remainingBalance}, Pending: ${pendingAmount}`,
        400
      );
    }
  }
}

module.exports = new PaymentService();
