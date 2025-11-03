const { StaffShift, SHIFT_TYPES } = require('../models/StaffShift');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

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

    // Update shift
    const updatedShift = await StaffShift.updateById(shiftId, updateData);

    return updatedShift;
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
}

module.exports = ShiftService;
