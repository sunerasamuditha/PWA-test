const invoiceService = require('../services/invoiceService');
const { generateInvoiceReceipt } = require('../utils/pdfGenerator');

/**
 * Create new invoice
 */
const createInvoice = async (req, res, next) => {
  try {
    const invoiceData = {
      patient_user_id: req.body.patient_user_id,
      appointment_id: req.body.appointment_id,
      invoice_type: req.body.invoice_type,
      payment_method: req.body.payment_method,
      due_date: req.body.due_date,
      items: req.body.items
    };

    const invoice = await invoiceService.createInvoice(invoiceData, req.user.id);

    // Store for audit logging
    res.locals.auditData = {
      invoice,
      action: 'create'
    };

    res.status(201).json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} created successfully`,
      data: { invoice }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoices
 * 
 * Query parameters:
 * - updateStatus: 'true' to update invoice statuses based on current state, omit or 'false' for read-only (default: false)
 */
const getInvoices = async (req, res, next) => {
  try {
    const filters = {
      patient_user_id: req.query.patient_user_id,
      status: req.query.status,
      invoice_type: req.query.invoice_type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      updateStatus: req.query.updateStatus === 'true' // Parse string to boolean, default false
    };

    // If patient role, restrict to own invoices
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
          message: 'You do not have permission to list all invoices'
        });
      }
    }

    let result;
    if (filters.patient_user_id) {
      result = await invoiceService.getInvoicesByPatient(filters.patient_user_id, filters);
    } else {
      result = await invoiceService.getAllInvoices(filters);
    }

    res.json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const invoice = await invoiceService.getInvoiceById(
      invoiceId,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: { invoice }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update invoice
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    // Capture before state
    const beforeInvoice = await invoiceService.getInvoiceById(invoiceId, req.user.id, req.user.role);
    res.locals.beforeData = beforeInvoice;
    
    const updateData = {
      total_amount: req.body.total_amount,
      status: req.body.status,
      due_date: req.body.due_date,
      payment_method: req.body.payment_method
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const invoice = await invoiceService.updateInvoice(invoiceId, updateData, req.user.id);

    // Capture after state and store for audit logging
    res.locals.afterData = invoice;
    res.locals.auditData = {
      invoice,
      action: 'update'
    };

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add invoice item
 */
const addInvoiceItem = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const itemData = {
      service_id: req.body.service_id,
      item_description: req.body.item_description,
      quantity: req.body.quantity,
      unit_price: req.body.unit_price
    };

    const invoice = await invoiceService.addInvoiceItem(invoiceId, itemData, req.user.id);

    res.json({
      success: true,
      message: 'Item added to invoice successfully',
      data: { invoice }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove invoice item
 */
const removeInvoiceItem = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);

    const invoice = await invoiceService.removeInvoiceItem(invoiceId, itemId, req.user.id);

    res.json({
      success: true,
      message: 'Item removed from invoice successfully',
      data: { invoice }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice receipt PDF
 */
const getInvoiceReceipt = async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    // Get invoice with access control (includes payments)
    const invoice = await invoiceService.getInvoiceById(
      invoiceId,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );
    
    // Generate PDF
    const pdfBuffer = await generateInvoiceReceipt(invoice);

    // Store for audit logging
    res.locals.auditData = {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      action: 'download_receipt'
    };

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice statistics
 */
const getInvoiceStats = async (req, res, next) => {
  try {
    const stats = await invoiceService.getInvoiceStats();

    res.json({
      success: true,
      message: 'Invoice statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

const getMyInvoiceStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await invoiceService.getInvoiceStatsByPatient(userId);

    res.json({
      success: true,
      message: 'Invoice statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  addInvoiceItem,
  removeInvoiceItem,
  getInvoiceReceipt,
  getInvoiceStats,
  getMyInvoiceStats
};
