const { executeQuery } = require('../config/database');

/**
 * Valid appointment types
 */
const APPOINTMENT_TYPES = ['opd', 'admission'];

/**
 * Valid appointment statuses
 */
const APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'completed', 'cancelled'];

/**
 * Convert ISO datetime string to UTC for MySQL storage
 * MySQL DATETIME does not store timezone, so we normalize to UTC
 * @param {string} datetime - ISO datetime string (e.g., "2024-01-15T14:30:00.000Z" or "2024-01-15T14:30:00")
 * @returns {string} MySQL-compatible UTC datetime string (e.g., "2024-01-15 14:30:00")
 */
const toUTCForMySQL = (datetime) => {
  if (!datetime) return null;
  const date = new Date(datetime);
  // Format as MySQL DATETIME: YYYY-MM-DD HH:mm:ss in UTC
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Convert MySQL datetime to ISO string for client
 * MySQL stores datetime without timezone info; we treat stored values as UTC
 * @param {string} mysqlDatetime - MySQL datetime string (e.g., "2024-01-15 14:30:00")
 * @returns {string} ISO datetime string (e.g., "2024-01-15T14:30:00.000Z")
 */
const fromMySQLToISO = (mysqlDatetime) => {
  if (!mysqlDatetime) return null;
  // Replace space with 'T' and append 'Z' to indicate UTC
  return new Date(mysqlDatetime.replace(' ', 'T') + 'Z').toISOString();
};

/**
 * Appointment Model
 * Handles database operations for the Appointments table
 * 
 * TIMEZONE HANDLING:
 * - All appointment datetimes are stored in MySQL as UTC
 * - Client sends ISO strings which may include timezone offset
 * - We convert to UTC before storage using toUTCForMySQL()
 * - We convert back to ISO (UTC) when reading using fromMySQLToISO()
 * - Client is responsible for displaying in local timezone
 */
class Appointment {
  /**
   * Find appointment by ID
   * @param {number} id - Appointment ID
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Promise<Object|null>} Appointment object or null
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone_number as patient_phone,
        s.full_name as creator_name
      FROM \`Appointments\` a
      LEFT JOIN \`Users\` p ON a.patient_user_id = p.id
      LEFT JOIN \`Users\` s ON a.created_by_staff_id = s.id
      WHERE a.id = ?
    `;
    
    const results = await executeQuery(query, [id], connection);
    return results.length > 0 ? this._transformAppointment(results[0]) : null;
  }

  /**
   * Find all appointments for a patient with filtering and pagination
   * @param {number} patientUserId - Patient user ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Object containing appointments array and pagination info
   */
  /**
   * Find appointments by patient user ID
   * @param {number} patientUserId - Patient's user ID
   * @param {Object} filters - Query filters (status, type, dates, pagination)
   * @returns {Promise<Object>} Appointments with pagination
   * 
   * @note Patient name JOIN (p.*) is technically redundant when requester is the patient,
   *       but kept for consistency in the response structure. Consider adding a `includePatientInfo`
   *       parameter to optimize queries when patient data is not needed.
   */
  static async findByPatientUserId(patientUserId, filters = {}) {
    const {
      status,
      appointment_type,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'appointment_datetime',
      sortOrder = 'ASC'
    } = filters;

    let query = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone_number as patient_phone,
        s.full_name as creator_name
      FROM \`Appointments\` a
      LEFT JOIN \`Users\` p ON a.patient_user_id = p.id
      LEFT JOIN \`Users\` s ON a.created_by_staff_id = s.id
      WHERE a.patient_user_id = ?
    `;
    const params = [patientUserId];

    // Apply status filter
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    // Apply appointment type filter
    if (appointment_type) {
      query += ' AND a.appointment_type = ?';
      params.push(appointment_type);
    }

    // Apply date range filter (convert to UTC)
    if (startDate) {
      query += ' AND a.appointment_datetime >= ?';
      params.push(toUTCForMySQL(startDate));
    }
    if (endDate) {
      query += ' AND a.appointment_datetime <= ?';
      params.push(toUTCForMySQL(endDate));
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`Appointments\` a
      WHERE a.patient_user_id = ?
      ${status ? 'AND a.status = ?' : ''}
      ${appointment_type ? 'AND a.appointment_type = ?' : ''}
      ${startDate ? 'AND a.appointment_datetime >= ?' : ''}
      ${endDate ? 'AND a.appointment_datetime <= ?' : ''}
    `;
    const countParams = [...params];
    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['appointment_datetime', 'status', 'appointment_type', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'appointment_datetime';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    query += ` ORDER BY a.${sortField} ${order}`;

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const results = await executeQuery(query, params);
    
    return {
      appointments: results.map(apt => this._transformAppointment(apt)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new appointment
   * @param {Object} appointmentData - Appointment data
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Promise<Object>} Created appointment
   */
  static async create(appointmentData, connection = null) {
    const {
      patient_user_id,
      created_by_staff_id,
      appointment_datetime,
      status = 'scheduled',
      appointment_type,
      notes
    } = appointmentData;

    // Validate required fields
    if (!patient_user_id || !appointment_datetime || !appointment_type) {
      throw new Error('Missing required fields for appointment creation');
    }

    // Validate appointment type
    if (!APPOINTMENT_TYPES.includes(appointment_type)) {
      throw new Error(`Invalid appointment type: ${appointment_type}`);
    }

    // Validate status
    if (!APPOINTMENT_STATUSES.includes(status)) {
      throw new Error(`Invalid appointment status: ${status}`);
    }

    const query = `
      INSERT INTO \`Appointments\` (
        patient_user_id,
        created_by_staff_id,
        appointment_datetime,
        status,
        appointment_type,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      patient_user_id,
      created_by_staff_id || null,
      toUTCForMySQL(appointment_datetime),
      status,
      appointment_type,
      notes || null
    ];

    const result = await executeQuery(query, params, connection);
    
    // Fetch and return the created appointment
    return await this.findById(result.insertId, connection);
  }

  /**
   * Update appointment by ID
   * @param {number} id - Appointment ID
   * @param {Object} appointmentData - Appointment data to update
   * @returns {Promise<Object>} Updated appointment
   */
  static async updateById(id, appointmentData) {
    const allowedFields = ['appointment_datetime', 'status', 'appointment_type', 'notes'];
    const updates = [];
    const params = [];

    Object.keys(appointmentData).forEach(key => {
      if (allowedFields.includes(key) && appointmentData[key] !== undefined) {
        updates.push(`${key} = ?`);
        // Convert appointment_datetime to UTC if present
        if (key === 'appointment_datetime') {
          params.push(toUTCForMySQL(appointmentData[key]));
        } else {
          params.push(appointmentData[key]);
        }
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE \`Appointments\`
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(query, params);
    
    // Return updated appointment
    return await this.findById(id);
  }

  /**
   * Delete appointment by ID
   * @param {number} id - Appointment ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteById(id) {
    const query = 'DELETE FROM `Appointments` WHERE id = ?';
    const result = await executeQuery(query, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Get all appointments with filtering (for admin/staff use)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Object containing appointments array and pagination info
   */
  static async getAllAppointments(filters = {}) {
    const {
      patient_user_id,
      status,
      appointment_type,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'appointment_datetime',
      sortOrder = 'ASC'
    } = filters;

    let query = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone_number as patient_phone,
        s.full_name as creator_name
      FROM \`Appointments\` a
      LEFT JOIN \`Users\` p ON a.patient_user_id = p.id
      LEFT JOIN \`Users\` s ON a.created_by_staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    // Apply patient filter
    if (patient_user_id) {
      query += ' AND a.patient_user_id = ?';
      params.push(patient_user_id);
    }

    // Apply status filter
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    // Apply appointment type filter
    if (appointment_type) {
      query += ' AND a.appointment_type = ?';
      params.push(appointment_type);
    }

    // Apply search filter (patient name)
    if (search) {
      query += ' AND p.full_name LIKE ?';
      params.push(`%${search}%`);
    }

    // Apply date range filter (convert to UTC)
    if (startDate) {
      query += ' AND a.appointment_datetime >= ?';
      params.push(toUTCForMySQL(startDate));
    }
    if (endDate) {
      query += ' AND a.appointment_datetime <= ?';
      params.push(toUTCForMySQL(endDate));
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`Appointments\` a
      LEFT JOIN \`Users\` p ON a.patient_user_id = p.id
      WHERE 1=1
      ${patient_user_id ? 'AND a.patient_user_id = ?' : ''}
      ${status ? 'AND a.status = ?' : ''}
      ${appointment_type ? 'AND a.appointment_type = ?' : ''}
      ${search ? 'AND p.full_name LIKE ?' : ''}
      ${startDate ? 'AND a.appointment_datetime >= ?' : ''}
      ${endDate ? 'AND a.appointment_datetime <= ?' : ''}
    `;
    const countParams = [...params];
    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['appointment_datetime', 'status', 'appointment_type', 'patient_name', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'appointment_datetime';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    if (sortBy === 'patient_name') {
      query += ` ORDER BY p.full_name ${order}`;
    } else {
      query += ` ORDER BY a.${sortField} ${order}`;
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const results = await executeQuery(query, params);
    
    return {
      appointments: results.map(apt => this._transformAppointment(apt)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Check for appointment conflicts
   * @param {number} patientUserId - Patient user ID
   * @param {string} appointmentDatetime - Appointment datetime
   * @param {number} excludeAppointmentId - Appointment ID to exclude (for updates)
   * @returns {Promise<boolean>} True if conflict exists
   */
  static async checkConflict(patientUserId, appointmentDatetime, excludeAppointmentId = null) {
    // Convert input datetime to UTC for comparison
    const utcDatetime = toUTCForMySQL(appointmentDatetime);
    
    // Check for appointments within ±30 minutes for the same patient
    const query = `
      SELECT COUNT(*) as count
      FROM \`Appointments\`
      WHERE patient_user_id = ?
        AND status IN ('scheduled', 'checked_in')
        AND appointment_datetime BETWEEN 
          DATE_SUB(?, INTERVAL 30 MINUTE) AND DATE_ADD(?, INTERVAL 30 MINUTE)
        ${excludeAppointmentId ? 'AND id != ?' : ''}
    `;
    
    const params = excludeAppointmentId 
      ? [patientUserId, utcDatetime, utcDatetime, excludeAppointmentId]
      : [patientUserId, utcDatetime, utcDatetime];

    const results = await executeQuery(query, params);
    return results[0].count > 0;
  }

  /**
   * Count appointments by status
   * @param {string} status - Appointment status
   * @returns {Promise<number>} Appointment count
   */
  static async countByStatus(status) {
    const query = 'SELECT COUNT(*) as count FROM `Appointments` WHERE status = ?';
    const results = await executeQuery(query, [status]);
    return results[0].count;
  }

  /**
   * Count appointments by date range and status
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {string} status - Optional status filter
   * @returns {Promise<number>} Appointment count
   */
  static async countByDateRange(startDate, endDate, status = null) {
    let query = `
      SELECT COUNT(*) as count 
      FROM \`Appointments\` 
      WHERE appointment_datetime BETWEEN ? AND ?
    `;
    const params = [toUTCForMySQL(startDate), toUTCForMySQL(endDate)];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    const results = await executeQuery(query, params);
    return results[0].count;
  }

  /**
   * Transform database appointment object to camelCase
   * @param {Object} dbAppointment - Database appointment object
   * @returns {Object} Transformed appointment object
   * @private
   */
  static _transformAppointment(dbAppointment) {
    if (!dbAppointment) return null;

    return {
      id: dbAppointment.id,
      patientUserId: dbAppointment.patient_user_id,
      createdByStaffId: dbAppointment.created_by_staff_id,
      appointmentDatetime: fromMySQLToISO(dbAppointment.appointment_datetime),
      status: dbAppointment.status,
      appointmentType: dbAppointment.appointment_type,
      notes: dbAppointment.notes,
      createdAt: fromMySQLToISO(dbAppointment.created_at),
      updatedAt: fromMySQLToISO(dbAppointment.updated_at),
      // Joined fields
      patientName: dbAppointment.patient_name || null,
      patientEmail: dbAppointment.patient_email || null,
      patientPhone: dbAppointment.patient_phone || null,
      creatorName: dbAppointment.creator_name || null
    };
  }

  /**
   * Transform appointment for client response (exclude staff-only fields for patients)
   * @param {Object} appointment - Appointment object
   * @param {string} userRole - User role (patient, staff, admin, super_admin)
   * @returns {Object} Sanitized appointment object for client
   */
  static toClientResponse(appointment, userRole) {
    if (!appointment) return null;

    // Remove notes field if user is a patient
    if (userRole === 'patient') {
      const { notes, ...clientSafeAppointment } = appointment;
      return clientSafeAppointment;
    }

    return appointment;
  }
}

module.exports = Appointment;
module.exports.APPOINTMENT_TYPES = APPOINTMENT_TYPES;
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES;
