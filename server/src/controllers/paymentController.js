const paymentService = require('../services/paymentService');
const invoiceService = require('../services/invoiceService');
const { generatePaymentReport } = require('../utils/pdfGenerator');

/**
 * Record new payment
 */
const recordPayment = async (req, res, next) => {
  try {
    const paymentData = {
      invoice_id: req.body.invoice_id,
      amount: req.body.amount,
      payment_method: req.body.payment_method,
      transaction_id: req.body.transaction_id,
      payment_status: req.body.payment_status,
      notes: req.body.notes,
      paid_at: req.body.paid_at
    };

    const result = await paymentService.recordPayment(paymentData, req.user.id);

    // Store for audit logging
    res.locals.auditData = {
      payment: result.payment,
      invoiceStatus: result.invoiceStatus,
      action: 'record_payment'
    };

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payments
 */
const getPayments = async (req, res, next) => {
  try {
    const filters = {
      invoice_id: req.query.invoice_id,
      patient_user_id: req.query.patient_user_id,
      payment_method: req.query.payment_method,
      payment_status: req.query.payment_status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order
    };

    // If patient role, restrict to own payments
    if (req.user.role === 'patient') {
      filters.patient_user_id = req.user.id;
    }

    // Non-privileged users without patient filter are blocked by route middleware
    // But add extra guard for non-patient roles without process_payments permission
    if (req.user.role !== 'patient' && !filters.patient_user_id) {
      const hasPermission = req.user.permissions?.includes('process_payments') ||
                            ['admin', 'super_admin'].includes(req.user.role);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to list all payments'
        });
      }
    }

    let result;
    if (filters.patient_user_id) {
      result = await paymentService.getPaymentsByPatient(filters.patient_user_id, filters);
    } else {
      result = await paymentService.getAllPayments(filters);
    }

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by ID
 */
const getPaymentById = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.id);
    const payment = await paymentService.getPaymentById(
      paymentId,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'Payment retrieved successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payments by invoice
 */
const getPaymentsByInvoice = async (req, res, next) => {
  try {
    // Support both :invoiceId and :id params
    const invoiceId = parseInt(req.params.invoiceId || req.params.id);

    // Verify access to invoice first
    await invoiceService.getInvoiceById(
      invoiceId,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    const payments = await paymentService.getPaymentsByInvoice(invoiceId);

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment statistics
 */
const getPaymentStats = async (req, res, next) => {
  try {
    const stats = await paymentService.getPaymentStats();

    res.json({
      success: true,
      message: 'Payment statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate payment report PDF
 */
const generatePaymentReportPDF = async (req, res, next) => {
  try {
    const patientUserId = parseInt(req.query.patient_user_id);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Verify access
    if (req.user.role === 'patient' && req.user.id !== patientUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only generate reports for your own payments'
      });
    }

    // Get patient info
    const { User } = require('../models/User');
    const patient = await User.findById(patientUserId);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get payments filtered by paid_at date range (not invoice.created_at)
    const { Payment } = require('../models/Payment');
    const paymentsResult = await Payment.getAllPayments({
      patient_user_id: patientUserId,
      startDate,
      endDate,
      payment_status: 'completed',
      limit: 10000
    });

    // Extract unique invoice IDs
    const uniqueInvoiceIds = [...new Set(paymentsResult.payments.map(p => p.invoiceId))];
    
    // Batch fetch all invoices and items to avoid N+1 query
    const { Invoice } = require('../models/Invoice');
    const { InvoiceItem } = require('../models/InvoiceItem');
    const invoiceMap = new Map();
    
    if (uniqueInvoiceIds.length > 0) {
      // Step 1: Fetch all invoices in one batch query (without items)
      const invoices = await Invoice.findByIds(uniqueInvoiceIds);
      
      // Step 2: Fetch all items for these invoices in one batch query
      const placeholders = uniqueInvoiceIds.map(() => '?').join(',');
      const { executeQuery } = require('../config/database');
      const itemsQuery = `
        SELECT 
          ii.*,
          s.name as service_name,
          s.service_category
        FROM Invoice_Items ii
        LEFT JOIN Services s ON ii.service_id = s.id
        WHERE ii.invoice_id IN (${placeholders})
        ORDER BY ii.invoice_id, ii.id
      `;
      const [itemRows] = await executeQuery(itemsQuery, uniqueInvoiceIds);
      
      // Step 3: Group items by invoice_id in memory
      const itemsByInvoiceId = new Map();
      for (const item of itemRows) {
        if (!itemsByInvoiceId.has(item.invoice_id)) {
          itemsByInvoiceId.set(item.invoice_id, []);
        }
        itemsByInvoiceId.get(item.invoice_id).push(Invoice._transformInvoiceItem(item));
      }
      
      // Step 4: Assemble invoices with their items and calculate balances
      for (const invoice of invoices) {
        // Attach items
        invoice.items = itemsByInvoiceId.get(invoice.id) || [];
        
        // Calculate paidAmount and remainingBalance from the payments we already fetched
        // Filter completed payments for this invoice
        const invoicePayments = paymentsResult.payments.filter(
          p => p.invoiceId === invoice.id && p.paymentStatus === 'completed'
        );
        const paidAmount = invoicePayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const remainingBalance = parseFloat(invoice.totalAmount) - paidAmount;
        
        invoiceMap.set(invoice.id, {
          ...invoice,
          paidAmount,
          remainingBalance: Math.max(0, remainingBalance),
          payments: invoicePayments
        });
      }
    }

    const invoices = Array.from(invoiceMap.values());

    // Calculate summary based on payments in the date range
    const summary = {
      totalInvoices: invoices.length,
      totalBilled: invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0),
      totalPaid: paymentsResult.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
    };

    // Prepare report data
    const reportData = {
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email
      },
      startDate,
      endDate,
      invoices: invoices,
      summary
    };

    // Generate PDF
    const pdfBuffer = await generatePaymentReport(reportData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payment-report-${startDate}-to-${endDate}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordPayment,
  getPayments,
  getPaymentById,
  getPaymentsByInvoice,
  getPaymentStats,
  generatePaymentReport: generatePaymentReportPDF
};
