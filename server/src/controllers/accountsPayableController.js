const AccountsPayableService = require('../services/accountsPayableService');
const asyncHandler = require('../utils/asyncHandler');

class AccountsPayableController {
  /**
   * Create new accounts payable
   * POST /api/accounts-payable
   */
  static createPayable = asyncHandler(async (req, res) => {
    const { entity_id, reference_code, description, total_amount, due_date, notes } = req.body;

    const payable = await AccountsPayableService.createPayable(
      { entity_id, reference_code, description, total_amount, due_date, notes },
      req.user.id
    );

    // Store for audit logging
    res.locals.payable = payable;

    res.status(201).json({
      success: true,
      message: 'Accounts payable created successfully',
      data: { payable }
    });
  });

  /**
   * Get all payables
   * GET /api/accounts-payable
   */
  static getAllPayables = asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search || '',
      entity_id: req.query.entity_id || '',
      status: req.query.status || '',
      dateField: req.query.dateField || 'due_date',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      sort_by: req.query.sort_by || 'due_date',
      sort_order: req.query.sort_order || 'ASC'
    };

    const result = await AccountsPayableService.getAllPayables(filters);

    res.status(200).json({
      success: true,
      message: 'Payables retrieved successfully',
      data: result
    });
  });

  /**
   * Get payable by ID
   * GET /api/accounts-payable/:id
   */
  static getPayableById = asyncHandler(async (req, res) => {
    const payableId = parseInt(req.params.id);

    const payable = await AccountsPayableService.getPayableById(
      payableId,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.status(200).json({
      success: true,
      message: 'Payable retrieved successfully',
      data: { payable }
    });
  });

  /**
   * Update payable
   * PUT /api/accounts-payable/:id
   */
  static updatePayable = asyncHandler(async (req, res) => {
    const payableId = parseInt(req.params.id);
    const { reference_code, description, total_amount, due_date, status, payment_method, notes } = req.body;

    const payable = await AccountsPayableService.updatePayable(
      payableId,
      { reference_code, description, total_amount, due_date, status, payment_method, notes },
      req.user.id
    );

    // Store for audit logging
    res.locals.payable = payable;

    res.status(200).json({
      success: true,
      message: 'Payable updated successfully',
      data: { payable }
    });
  });

  /**
   * Mark payable as paid
   * PUT /api/accounts-payable/:id/mark-paid
   */
  static markAsPaid = asyncHandler(async (req, res) => {
    const payableId = parseInt(req.params.id);
    const { paid_date, payment_method, notes } = req.body;

    const payable = await AccountsPayableService.markAsPaid(
      payableId,
      paid_date,
      payment_method,
      notes,
      req.user.id
    );

    // Store for audit logging
    res.locals.payable = payable;

    res.status(200).json({
      success: true,
      message: 'Payable marked as paid successfully',
      data: { payable }
    });
  });

  /**
   * Get overdue payables
   * GET /api/accounts-payable/overdue
   */
  static getOverduePayables = asyncHandler(async (req, res) => {
    const payables = await AccountsPayableService.getOverduePayables();

    res.status(200).json({
      success: true,
      message: 'Overdue payables retrieved successfully',
      data: { payables }
    });
  });

  /**
   * Get payables due soon
   * GET /api/accounts-payable/due-soon
   */
  static getDueSoonPayables = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;

    const payables = await AccountsPayableService.getDueSoonPayables(days);

    res.status(200).json({
      success: true,
      message: 'Due soon payables retrieved successfully',
      data: { payables }
    });
  });

  /**
   * Get payables by entity
   * GET /api/accounts-payable/entity/:entityId
   */
  static getPayablesByEntity = asyncHandler(async (req, res) => {
    const entityId = parseInt(req.params.entityId);
    const filters = {
      status: req.query.status || '',
      dateField: req.query.dateField || 'due_date',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await AccountsPayableService.getPayablesByEntity(entityId, filters);

    res.status(200).json({
      success: true,
      message: 'Payables retrieved successfully',
      data: result
    });
  });

  /**
   * Get payable statistics
   * GET /api/accounts-payable/stats
   */
  static getPayableStats = asyncHandler(async (req, res) => {
    const stats = await AccountsPayableService.getPayableStats();

    res.status(200).json({
      success: true,
      message: 'Payable statistics retrieved successfully',
      data: stats
    });
  });
}

module.exports = AccountsPayableController;
