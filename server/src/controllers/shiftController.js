const ShiftService = require('../services/shiftService');
const asyncHandler = require('../utils/asyncHandler');

const shiftController = {
  // Get my shifts (staff viewing their own)
  getMyShifts: asyncHandler(async (req, res) => {
    const { shift_type, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filters = {
      shift_type,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await ShiftService.getShiftsByStaff(
      req.user.id,
      filters,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'Shifts retrieved successfully',
      data: result
    });
  }),

  // Get my active shift
  getMyActiveShift: asyncHandler(async (req, res) => {
    const { StaffShift } = require('../models/StaffShift');
    const activeShift = await StaffShift.getActiveShift(req.user.id);

    res.json({
      success: true,
      message: activeShift ? 'Active shift found' : 'No active shift',
      data: { shift: activeShift }
    });
  }),

  // Get my shift statistics
  getMyShiftStats: asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    // Default to current month if no dates provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const stats = await ShiftService.getShiftStats(
      req.user.id,
      startDate || defaultStartDate,
      endDate || defaultEndDate
    );

    res.json({
      success: true,
      message: 'Shift statistics retrieved successfully',
      data: stats
    });
  }),

  // Get all shifts (admin view)
  getAllShifts: asyncHandler(async (req, res) => {
    const { staff_user_id, shift_type, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filters = {
      staff_user_id: staff_user_id ? parseInt(staff_user_id) : undefined,
      shift_type,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await ShiftService.getAllShifts(
      filters,
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'All shifts retrieved successfully',
      data: result
    });
  }),

  // Get shift by ID
  getShiftById: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const shift = await ShiftService.getShiftById(
      parseInt(id),
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'Shift retrieved successfully',
      data: { shift }
    });
  }),

  // Update shift (admin manual edit)
  updateShift: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const updatedShift = await ShiftService.updateShift(
      parseInt(id),
      updateData,
      req.user.id
    );

    // Store updated shift in res.locals for audit logging
    res.locals.shift = updatedShift;

    res.json({
      success: true,
      message: 'Shift updated successfully',
      data: { shift: updatedShift }
    });
  }),

  // Get monthly report (JSON)
  getMonthlyReport: asyncHandler(async (req, res) => {
    const { staffUserId, year, month } = req.query;

    // Staff can only get their own report, admins can get any
    const targetStaffId = staffUserId ? parseInt(staffUserId) : req.user.id;

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const hasManagePermission = (req.user.permissions || []).includes('manage_users');

    if (targetStaffId !== req.user.id && !isAdmin && !hasManagePermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this report'
      });
    }

    let report;
    if (!staffUserId && (isAdmin || hasManagePermission)) {
      // Generate report for all staff (admin payroll)
      report = await ShiftService.generateMonthlyReportForAllStaff(
        parseInt(year),
        parseInt(month)
      );
    } else {
      // Generate report for specific staff
      report = await ShiftService.getMonthlyShiftReport(
        targetStaffId,
        parseInt(year),
        parseInt(month)
      );
    }

    res.json({
      success: true,
      message: 'Monthly report generated successfully',
      data: report
    });
  }),

  // Download monthly report PDF
  downloadMonthlyReportPDF: asyncHandler(async (req, res) => {
    const { staffUserId, year, month } = req.query;

    // Staff can only get their own report, admins can get any
    const targetStaffId = staffUserId ? parseInt(staffUserId) : req.user.id;

    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const hasManagePermission = (req.user.permissions || []).includes('manage_users');

    if (targetStaffId !== req.user.id && !isAdmin && !hasManagePermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to download this report'
      });
    }

    const report = await ShiftService.getMonthlyShiftReport(
      targetStaffId,
      parseInt(year),
      parseInt(month)
    );

    const { generateMonthlyShiftReport } = require('../utils/pdfGenerator');
    const pdfBuffer = await generateMonthlyShiftReport(report);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=shift-report-${year}-${String(month).padStart(2, '0')}.pdf`
    );

    res.send(pdfBuffer);
  }),

  // Get currently on shift (admin dashboard)
  getCurrentlyOnShift: asyncHandler(async (req, res) => {
    const currentlyOnShift = await ShiftService.getCurrentlyOnShift(
      req.user.id,
      req.user.role,
      req.user.permissions || []
    );

    res.json({
      success: true,
      message: 'Currently on shift staff retrieved successfully',
      data: { shifts: currentlyOnShift }
    });
  }),

  // Export shifts to CSV (server-side streaming)
  exportShiftsCSV: asyncHandler(async (req, res) => {
    const { staff_user_id, shift_type, startDate, endDate } = req.query;

    // Validate access: only admins or staff with manage_users permission
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const hasManagePermission = (req.user.permissions || []).includes('manage_users');

    if (!isAdmin && !hasManagePermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to export shifts'
      });
    }

    const filters = {
      staff_user_id: staff_user_id ? parseInt(staff_user_id) : undefined,
      shift_type,
      startDate,
      endDate
    };

    // Set CSV headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `shifts-export-${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream CSV data
    await ShiftService.streamShiftsAsCSV(filters, res);
  })
};

module.exports = shiftController;
