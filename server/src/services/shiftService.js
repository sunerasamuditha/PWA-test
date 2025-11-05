const { StaffShift, SHIFT_TYPES } = require('../models/StaffShift');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

/**
 * ShiftService - Business logic for staff shift tracking
 * 
 * Features:
 * - Manual shift start/end by staff members
 * - Automatic shift type detection based on login time
 * - Admin shift management (view all, update manually)
 * - Monthly reports and statistics
 * - Auto-close stale shifts (configured via cron job)
 * 
 * Auto-Close Functionality:
 * The autoCloseStaleShifts() method automatically closes shifts that remain
 * open beyond a threshold (default 24 hours). This prevents indefinitely open
 * shifts when staff forget to log out, ensuring accurate hours and payroll.
 * 
 * Configuration (via environment variables):
 * - SHIFT_AUTOCLOSE_THRESHOLD_HOURS: Hours before shift is considered stale (default: 24)
 * - SHIFT_AUTOCLOSE_CRON: Cron schedule for auto-close job (default: '0 * * * *')
 * 
 * The auto-close job:
 * 1. Finds shifts with logout_at IS NULL and login_at older than threshold
 * 2. Sets logout_at to login_at + threshold hours
 * 3. Calculates total_hours using TIMESTAMPDIFF
 * 4. Creates audit log entries for each auto-closed shift
 * 5. Returns summary of closed shifts for admin notifications
 */
class ShiftService {
  static async startShift(staffUserId, loginAt) {
    // Validate staff exists
    const staff = await User.findById(staffUserId);
    if (!staff) {
      throw new AppError('Staff user not found', 404);
    }

    // Check if staff already has an active shift
    const activeShift = await StaffShift.getActiveShift(staffUserId);
    if (activeShift) {
      throw new AppError('You already have an active shift. Please end your current shift before starting a new one.', 400);
    }

    // Detect shift type based on login time
    const shiftType = StaffShift.detectShiftType(loginAt);

    // Create shift record
    const shift = await StaffShift.create({
      staff_user_id: staffUserId,
      shift_type: shiftType,
      login_at: loginAt,
      logout_at: null,
      total_hours: null
    });

    return shift;
  }

  static async endShift(staffUserId, logoutAt, notes = null) {
    // Fetch active shift
    const activeShift = await StaffShift.getActiveShift(staffUserId);
    if (!activeShift) {
      throw new AppError('No active shift found to end', 404);
    }

    // Validate logoutAt is after loginAt
    this._validateShiftTimes(activeShift.loginAt, logoutAt);

    // End shift with calculated hours
    const endedShift = await StaffShift.endShift(activeShift.id, logoutAt, notes);

    return endedShift;
  }

  static async getShiftsByStaff(staffUserId, filters = {}, requesterId, requesterRole, requesterPermissions = []) {
    // Validate access: staff can only get their own, admins can get all, staff with 'manage_users' permission can get all
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const hasManagePermission = requesterPermissions.includes('manage_users');
    const isOwnShifts = staffUserId === requesterId;

    if (!isOwnShifts && !isAdmin && !hasManagePermission) {
      throw new AppError('You do not have permission to view these shifts', 403);
    }

    const result = await StaffShift.findByStaffUserId(staffUserId, filters);
    return result;
  }

  static async getShiftById(shiftId, requesterId, requesterRole, requesterPermissions = []) {
    const shift = await StaffShift.findById(shiftId);
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    // Validate access control
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const hasManagePermission = requesterPermissions.includes('manage_users');
    const isOwner = shift.staffUserId === requesterId;

    if (!isOwner && !isAdmin && !hasManagePermission) {
      throw new AppError('You do not have permission to view this shift', 403);
    }

    return shift;
  }

  static async getAllShifts(filters = {}, requesterId, requesterRole, requesterPermissions = []) {
    // Validate access: only admins or staff with manage_users permission
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const hasManagePermission = requesterPermissions.includes('manage_users');

    if (!isAdmin && !hasManagePermission) {
      throw new AppError('You do not have permission to view all shifts', 403);
    }

    const result = await StaffShift.getAllShifts(filters);
    return result;
  }

  static async getMonthlyShiftReport(staffUserId, year, month) {
    // Fetch staff info
    const staff = await User.findById(staffUserId);
    if (!staff) {
      throw new AppError('Staff user not found', 404);
    }

    // Fetch shifts for the month
    const shifts = await StaffShift.getShiftsByMonth(staffUserId, year, month);

    // Aggregate data by shift type
    const summary = {
      totalShifts: 0,
      totalHours: 0,
      hoursByShiftType: {
        full_night: 0,
        day: 0,
        intermediate: 0
      }
    };

    shifts.forEach(shift => {
      if (shift.totalHours) {
        summary.totalShifts++;
        summary.totalHours += shift.totalHours;
        if (summary.hoursByShiftType[shift.shiftType] !== undefined) {
          summary.hoursByShiftType[shift.shiftType] += shift.totalHours;
        }
      }
    });

    // Round to 2 decimals
    summary.totalHours = Math.round(summary.totalHours * 100) / 100;
    Object.keys(summary.hoursByShiftType).forEach(type => {
      summary.hoursByShiftType[type] = Math.round(summary.hoursByShiftType[type] * 100) / 100;
    });

    return {
      staff: {
        fullName: staff.full_name,
        email: staff.email,
        staffRole: staff.role
      },
      month,
      year,
      shifts,
      summary
    };
  }

  static async generateMonthlyReportForAllStaff(year, month) {
    // This would be for admin payroll - fetch all staff and generate reports
    const { executeQuery } = require('../config/database');
    
    // Get all staff members
    const [staffMembers] = await executeQuery(
      "SELECT id, full_name, email, role FROM Users WHERE role = 'staff'"
    );

    const reports = [];
    for (const staff of staffMembers) {
      const report = await this.getMonthlyShiftReport(staff.id, year, month);
      reports.push(report);
    }

    return reports;
  }

  static async getShiftStats(staffUserId, startDate, endDate) {
    const stats = await StaffShift.getShiftStats(staffUserId, startDate, endDate);
    return stats;
  }

  static async getCurrentlyOnShift(requesterId, requesterRole, requesterPermissions = []) {
    // Validate access: only admins or staff with manage_users permission
    const isAdmin = requesterRole === 'admin' || requesterRole === 'super_admin';
    const hasManagePermission = requesterPermissions.includes('manage_users');

    if (!isAdmin && !hasManagePermission) {
      throw new AppError('You do not have permission to view currently on shift staff', 403);
    }

    const result = await StaffShift.getAllShifts({ logout_at: null });
    return result.shifts;
  }

  static async updateShift(shiftId, updateData, updatedBy) {
    // Fetch existing shift
    const shift = await StaffShift.findById(shiftId);
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    // Validate times if provided
    const loginAt = updateData.login_at || shift.loginAt;
    const logoutAt = updateData.logout_at || shift.logoutAt;
    
    if (loginAt && logoutAt) {
      this._validateShiftTimes(loginAt, logoutAt);
    }

    // Re-detect shift_type if login_at is being updated
    if (updateData.login_at) {
      const detectedShiftType = StaffShift.detectShiftType(updateData.login_at);
      updateData.shift_type = detectedShiftType;
    }

    // Update shift
    const updatedShift = await StaffShift.updateById(shiftId, updateData);

    return updatedShift;
  }

  /**
   * Stream shifts data as CSV (server-side export)
   * @param {object} filters - Query filters
   * @param {object} res - Express response object
   */
  static async streamShiftsAsCSV(filters, res) {
    const { pool } = require('../config/database');

    // Build query similar to getAllShifts but without pagination
    let query = `
      SELECT 
        ss.id,
        ss.staff_user_id,
        u.full_name as staff_name,
        u.email as staff_email,
        ss.shift_type,
        ss.login_at,
        ss.logout_at,
        ss.total_hours,
        ss.notes,
        ss.created_at,
        ss.updated_at
      FROM staff_shifts ss
      JOIN users u ON ss.staff_user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.staff_user_id) {
      query += ' AND ss.staff_user_id = ?';
      params.push(filters.staff_user_id);
    }

    if (filters.shift_type) {
      query += ' AND ss.shift_type = ?';
      params.push(filters.shift_type);
    }

    if (filters.startDate) {
      query += ' AND DATE(ss.login_at) >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND DATE(ss.login_at) <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY ss.login_at DESC';

    try {
      // Get connection from pool
      const connection = await pool.getConnection();

      // Execute query and get stream
      const [rows] = await connection.execute(query, params);
      
      // CSV Headers
      const headers = [
        'ID',
        'Staff ID',
        'Staff Name',
        'Staff Email',
        'Shift Type',
        'Login Time',
        'Logout Time',
        'Total Hours',
        'Notes',
        'Created At',
        'Updated At'
      ];

      // Helper to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Helper to format date
      const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('en-US', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      };

      // Write CSV header row
      res.write(headers.map(escapeCSV).join(',') + '\n');

      // Write data rows
      for (const row of rows) {
        const csvRow = [
          row.id,
          row.staff_user_id,
          row.staff_name,
          row.staff_email,
          row.shift_type,
          formatDate(row.login_at),
          formatDate(row.logout_at),
          row.total_hours !== null ? row.total_hours.toFixed(2) : '',
          row.notes || '',
          formatDate(row.created_at),
          formatDate(row.updated_at)
        ];

        res.write(csvRow.map(escapeCSV).join(',') + '\n');
      }

      // End response
      res.end();

      // Release connection
      connection.release();

      console.log(`✅ CSV export completed: ${rows.length} shifts exported`);

    } catch (error) {
      console.error('CSV export error:', error);
      throw new AppError(`CSV export failed: ${error.message}`, 500);
    }
  }

  static _validateShiftTimes(loginAt, logoutAt) {
    const login = new Date(loginAt);
    const logout = new Date(logoutAt);

    if (isNaN(login.getTime())) {
      throw new AppError('Invalid login time', 400);
    }

    if (isNaN(logout.getTime())) {
      throw new AppError('Invalid logout time', 400);
    }

    if (logout <= login) {
      throw new AppError('Logout time must be after login time', 400);
    }

    return true;
  }

  /**
   * Auto-close stale active shifts older than threshold
   * @param {number} thresholdHours - Number of hours after which to consider a shift stale (default 24)
   * @returns {Promise<object>} Summary of auto-closed shifts
   */
  static async autoCloseStaleShifts(thresholdHours = 24) {
    const { logAction } = require('../middleware/auditLog');
    const startTime = new Date();
    
    try {
      console.log(`\n🔍 [${startTime.toISOString()}] Auto-close job: checking for stale shifts (threshold: ${thresholdHours}h)...`);

      // Find stale shifts using model method
      const staleShifts = await StaffShift.findStaleActiveShifts(thresholdHours);

      if (!staleShifts || staleShifts.length === 0) {
        console.log('✅ No stale shifts found');
        return {
          totalFound: 0,
          successfullyClosed: 0,
          failed: 0,
          errors: []
        };
      }

      console.log(`⚠️  Found ${staleShifts.length} stale shift(s) to auto-close`);

      let closedCount = 0;
      let failedCount = 0;
      const errors = [];
      const closedShifts = [];

      // Process each stale shift
      for (const shift of staleShifts) {
        try {
          // Store original state for audit
          const originalShift = { ...shift };

          // Calculate cutoff time: login_at + thresholdHours
          const cutoffTime = new Date(shift.loginAt);
          cutoffTime.setHours(cutoffTime.getHours() + thresholdHours);

          // Auto-close the shift using model method
          const closedShift = await StaffShift.autoCloseShift(shift.id, cutoffTime);

          closedCount++;
          closedShifts.push(closedShift);

          console.log(`  ✓ Closed shift #${shift.id} for ${shift.staffName} (login: ${shift.loginAt}, logout: ${cutoffTime.toISOString()})`);

          // Create audit log for automatic closure
          try {
            await logAction({
              userId: null, // System action
              action: 'update',
              targetEntity: 'Staff_Shifts',
              targetId: shift.id,
              detailsBefore: {
                id: originalShift.id,
                staff_user_id: originalShift.staffUserId,
                staff_name: originalShift.staffName,
                staff_email: originalShift.staffEmail,
                login_at: originalShift.loginAt,
                logout_at: null,
                shift_type: originalShift.shiftType,
                notes: originalShift.notes
              },
              detailsAfter: {
                id: closedShift.id,
                staff_user_id: closedShift.staffUserId,
                staff_name: closedShift.staffName,
                login_at: closedShift.loginAt,
                logout_at: closedShift.logoutAt,
                total_hours: closedShift.totalHours,
                shift_type: closedShift.shiftType,
                notes: closedShift.notes,
                auto_closed: true,
                reason: `Auto-closed: shift exceeded ${thresholdHours} hours without logout`,
                cutoff_time: cutoffTime.toISOString()
              },
              ipAddress: 'SYSTEM',
              userAgent: 'Cron Job - Auto Close Stale Shifts'
            });
          } catch (auditError) {
            console.warn(`  ⚠️  Failed to create audit log for shift #${shift.id}:`, auditError.message);
          }

        } catch (error) {
          failedCount++;
          errors.push({
            shiftId: shift.id,
            staffName: shift.staffName,
            error: error.message
          });
          console.error(`  ✗ Failed to close shift #${shift.id}:`, error.message);
        }
      }

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      console.log(`\n📊 Auto-close job summary:`);
      console.log(`  - Total found: ${staleShifts.length}`);
      console.log(`  - Successfully closed: ${closedCount}`);
      console.log(`  - Failed: ${failedCount}`);
      console.log(`  - Duration: ${duration.toFixed(2)}s`);

      if (errors.length > 0) {
        console.error(`\n❌ Errors encountered:`);
        errors.forEach(err => {
          console.error(`  - Shift #${err.shiftId} (${err.staffName}): ${err.error}`);
        });
      }

      return {
        totalFound: staleShifts.length,
        successfullyClosed: closedCount,
        failed: failedCount,
        errors,
        closedShifts,
        durationSeconds: duration
      };

    } catch (error) {
      console.error('❌ Auto-close stale shifts job failed:', error);
      throw new AppError(`Auto-close stale shifts failed: ${error.message}`, 500);
    }
  }
}

module.exports = ShiftService;
