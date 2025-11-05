const { executeQuery } = require('../config/database');

// Shift type constants
const SHIFT_TYPES = ['full_night', 'day', 'intermediate'];

// Shift time windows
const SHIFT_WINDOWS = {
  full_night: { start: '20:00', end: '13:00' }, // 8pm to 1pm next day
  day: { start: '13:00', end: '21:00' },        // 1pm to 9pm
  intermediate: { start: '11:00', end: '20:00' } // 11am to 8pm
};

class StaffShift {
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        s.*,
        u.full_name as staff_name
      FROM Staff_Shifts s
      LEFT JOIN Users u ON s.staff_user_id = u.id
      WHERE s.id = ?
    `;
    const rows = await executeQuery(query, [id], connection);
    return rows.length > 0 ? this._transformShift(rows[0]) : null;
  }

  static async findByStaffUserId(staffUserId, filters = {}) {
    const {
      shift_type,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = filters;

    let conditions = ['s.staff_user_id = ?'];
    let params = [staffUserId];

    if (shift_type) {
      conditions.push('s.shift_type = ?');
      params.push(shift_type);
    }

    if (startDate) {
      conditions.push('s.login_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('s.login_at <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Staff_Shifts s
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Get paginated data
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        s.*,
        u.full_name as staff_name
      FROM Staff_Shifts s
      LEFT JOIN Users u ON s.staff_user_id = u.id
      ${whereClause}
      ORDER BY s.login_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await executeQuery(dataQuery, [...params, parseInt(limit), offset]);

    return {
      shifts: rows.map(row => this._transformShift(row)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async create(shiftData, connection = null) {
    const {
      staff_user_id,
      shift_type,
      login_at,
      logout_at = null,
      total_hours = null,
      notes = null
    } = shiftData;

    // Validate shift_type
    if (!SHIFT_TYPES.includes(shift_type)) {
      throw new Error(`Invalid shift type. Must be one of: ${SHIFT_TYPES.join(', ')}`);
    }

    const query = `
      INSERT INTO Staff_Shifts (
        staff_user_id,
        shift_type,
        login_at,
        logout_at,
        total_hours,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      staff_user_id,
      shift_type,
      login_at,
      logout_at,
      total_hours,
      notes
    ];

    const result = await executeQuery(query, params, connection);
    return this.findById(result.insertId, connection);
  }

  static async updateById(id, shiftData) {
    // Fetch current shift to check existing timestamps
    const currentShift = await this.findById(id);
    if (!currentShift) {
      throw new Error('Shift not found');
    }

    const updates = [];
    const params = [];

    const allowedFields = ['shift_type', 'login_at', 'logout_at', 'total_hours', 'notes'];

    for (const field of allowedFields) {
      if (shiftData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(shiftData[field]);
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    // Determine final login_at and logout_at after update
    const finalLoginAt = shiftData.login_at !== undefined ? shiftData.login_at : currentShift.loginAt;
    const finalLogoutAt = shiftData.logout_at !== undefined ? shiftData.logout_at : currentShift.logoutAt;

    // Recalculate total_hours if both timestamps will be present after update
    if (finalLoginAt && finalLogoutAt) {
      // Remove total_hours from updates if it was set manually
      const totalHoursIndex = updates.findIndex(u => u.startsWith('total_hours'));
      if (totalHoursIndex !== -1) {
        updates.splice(totalHoursIndex, 1);
        params.splice(totalHoursIndex, 1);
      }
      
      updates.push('total_hours = TIMESTAMPDIFF(MINUTE, ?, ?) / 60.0');
      params.push(finalLoginAt, finalLogoutAt);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE Staff_Shifts
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(query, params);
    return this.findById(id);
  }

  static async endShift(id, logoutAt, notes = null) {
    const query = `
      UPDATE Staff_Shifts
      SET 
        logout_at = ?,
        total_hours = TIMESTAMPDIFF(MINUTE, login_at, ?) / 60.0,
        notes = COALESCE(?, notes),
        updated_at = NOW()
      WHERE id = ?
    `;

    await executeQuery(query, [logoutAt, logoutAt, notes, id]);
    return this.findById(id);
  }

  static async getAllShifts(filters = {}) {
    const {
      staff_user_id,
      shift_type,
      startDate,
      endDate,
      logout_at,
      page = 1,
      limit = 20
    } = filters;

    let conditions = [];
    let params = [];

    if (staff_user_id) {
      conditions.push('s.staff_user_id = ?');
      params.push(staff_user_id);
    }

    if (shift_type) {
      conditions.push('s.shift_type = ?');
      params.push(shift_type);
    }

    if (startDate) {
      conditions.push('s.login_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('s.login_at <= ?');
      params.push(endDate);
    }

    // Support logout_at filter: null means active shifts (logout_at IS NULL)
    if (logout_at === null) {
      conditions.push('s.logout_at IS NULL');
    } else if (logout_at !== undefined) {
      conditions.push('s.logout_at = ?');
      params.push(logout_at);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Staff_Shifts s
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    // Get paginated data
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT 
        s.*,
        u.full_name as staff_name,
        u.email as staff_email
      FROM Staff_Shifts s
      LEFT JOIN Users u ON s.staff_user_id = u.id
      ${whereClause}
      ORDER BY s.login_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await executeQuery(dataQuery, [...params, parseInt(limit), offset]);

    return {
      shifts: rows.map(row => this._transformShift(row)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getActiveShift(staffUserId) {
    const query = `
      SELECT 
        s.*,
        u.full_name as staff_name
      FROM Staff_Shifts s
      LEFT JOIN Users u ON s.staff_user_id = u.id
      WHERE s.staff_user_id = ? AND s.logout_at IS NULL
      ORDER BY s.login_at DESC
      LIMIT 1
    `;
    const rows = await executeQuery(query, [staffUserId]);
    return rows.length > 0 ? this._transformShift(rows[0]) : null;
  }

  static async getShiftsByMonth(staffUserId, year, month) {
    const query = `
      SELECT 
        s.*,
        u.full_name as staff_name
      FROM Staff_Shifts s
      LEFT JOIN Users u ON s.staff_user_id = u.id
      WHERE s.staff_user_id = ?
        AND YEAR(s.login_at) = ?
        AND MONTH(s.login_at) = ?
      ORDER BY s.login_at ASC
    `;
    const rows = await executeQuery(query, [staffUserId, year, month]);
    return rows.map(row => this._transformShift(row));
  }

  static async getShiftStats(staffUserId, startDate, endDate) {
    let conditions = ['staff_user_id = ?'];
    let params = [staffUserId];

    if (startDate) {
      conditions.push('login_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('login_at <= ?');
      params.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total shifts and hours
    const totalQuery = `
      SELECT 
        COUNT(*) as total_shifts,
        COALESCE(SUM(total_hours), 0) as total_hours,
        COALESCE(AVG(total_hours), 0) as avg_hours_per_shift
      FROM Staff_Shifts
      ${whereClause}
        AND logout_at IS NOT NULL
    `;
    const totalResult = await executeQuery(totalQuery, params);

    // Hours by shift type
    const byTypeQuery = `
      SELECT 
        shift_type,
        COUNT(*) as shift_count,
        COALESCE(SUM(total_hours), 0) as total_hours
      FROM Staff_Shifts
      ${whereClause}
        AND logout_at IS NOT NULL
      GROUP BY shift_type
    `;
    const byTypeResult = await executeQuery(byTypeQuery, params);

    const hoursByShiftType = {};
    byTypeResult.forEach(row => {
      hoursByShiftType[row.shift_type] = {
        count: row.shift_count,
        hours: parseFloat(row.total_hours)
      };
    });

    return {
      totalShifts: totalResult[0].total_shifts,
      totalHours: parseFloat(totalResult[0].total_hours),
      avgHoursPerShift: parseFloat(totalResult[0].avg_hours_per_shift),
      hoursByShiftType
    };
  }

  /**
   * Detect shift type based on login time
   * Uses SHIFT_WINDOWS constant for single-sourced configuration
   * 
   * Priority order (to handle overlaps deterministically):
   * 1. full_night (20:00-13:00, crosses midnight) - highest priority for evening logins
   * 2. day (13:00-21:00)
   * 3. intermediate (11:00-20:00)
   * 
   * @param {Date|string} loginTime - Login timestamp
   * @returns {string} Shift type
   */
  static detectShiftType(loginTime) {
    const date = new Date(loginTime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Helper to parse HH:MM time string to minutes
    const parseTimeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // Parse shift windows from SHIFT_WINDOWS constant
    const fullNightStart = parseTimeToMinutes(SHIFT_WINDOWS.full_night.start); // 20:00 = 1200 minutes
    const fullNightEnd = parseTimeToMinutes(SHIFT_WINDOWS.full_night.end);     // 13:00 = 780 minutes
    const dayStart = parseTimeToMinutes(SHIFT_WINDOWS.day.start);               // 13:00 = 780 minutes
    const dayEnd = parseTimeToMinutes(SHIFT_WINDOWS.day.end);                   // 21:00 = 1260 minutes
    const intermediateStart = parseTimeToMinutes(SHIFT_WINDOWS.intermediate.start); // 11:00 = 660 minutes
    const intermediateEnd = parseTimeToMinutes(SHIFT_WINDOWS.intermediate.end);     // 20:00 = 1200 minutes

    // Priority 1: Check full_night shift first (20:00-13:00, crosses midnight)
    // This covers 20:00-23:59 and 00:00-12:59
    // Prefer full_night for times >= 20:00 to resolve overlap with intermediate/day
    if (timeInMinutes >= fullNightStart || timeInMinutes < fullNightEnd) {
      return 'full_night';
    }

    // Priority 2: Check day shift (13:00-20:59)
    // At this point, times >= 20:00 already handled by full_night
    if (timeInMinutes >= dayStart && timeInMinutes < dayEnd) {
      return 'day';
    }

    // Priority 3: Check intermediate shift (11:00-12:59)
    // Times 13:00-19:59 handled by day shift
    if (timeInMinutes >= intermediateStart && timeInMinutes < intermediateEnd) {
      return 'intermediate';
    }

    // Fallback: Default to day shift (should not reach here with proper windows)
    return 'day';
  }

  static _transformShift(dbShift) {
    if (!dbShift) return null;

    return {
      id: dbShift.id,
      staffUserId: dbShift.staff_user_id,
      shiftType: dbShift.shift_type,
      loginAt: dbShift.login_at,
      logoutAt: dbShift.logout_at,
      totalHours: dbShift.total_hours ? parseFloat(dbShift.total_hours) : null,
      notes: dbShift.notes,
      createdAt: dbShift.created_at,
      updatedAt: dbShift.updated_at,
      staffName: dbShift.staff_name || null,
      staffEmail: dbShift.staff_email || null
    };
  }
}

module.exports = { StaffShift, SHIFT_TYPES, SHIFT_WINDOWS };
