const { executeQuery } = require('../config/database');
const { encryptField, decryptField } = require('../utils/encryption');

class Patient {
  /**
   * Find patient by user ID
   * @param {number} userId - User ID
   * @returns {Object|null} Patient object with parsed JSON fields or null
   */
  static async findByUserId(userId) {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          passport_info,
          insurance_info,
          current_address,
          created_at,
          updated_at
        FROM Patients 
        WHERE user_id = ?
      `;
      
      const [rows] = await executeQuery(query, [userId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this._transformPatient(rows[0]);
    } catch (error) {
      console.error('Error finding patient by user ID:', error);
      throw error;
    }
  }

  /**
   * Find patient by ID
   * @param {number} id - Patient ID
   * @param {Object} connection - Optional transaction connection
   * @returns {Object|null} Patient object or null
   */
  static async findById(id, connection = null) {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          passport_info,
          insurance_info,
          current_address,
          created_at,
          updated_at
        FROM Patients 
        WHERE id = ?
      `;
      
      const [rows] = connection 
        ? await connection.execute(query, [id])
        : await executeQuery(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      return this._transformPatient(rows[0]);
    } catch (error) {
      console.error('Error finding patient by ID:', error);
      throw error;
    }
  }

  /**
   * Create new patient record
   * @param {Object} patientData - Patient data
   * @param {Object} connection - Optional transaction connection
   * @returns {Object} Created patient object
   */
  static async create(patientData, connection = null) {
    try {
      const { 
        user_id, 
        passportInfo, 
        insuranceInfo, 
        currentAddress 
      } = patientData;

      // Encrypt sensitive fields before storing
      let passportInfoJson = null;
      if (passportInfo) {
        const encryptedPassport = { ...passportInfo };
        if (passportInfo.number) {
          encryptedPassport.number = encryptField(passportInfo.number);
        }
        passportInfoJson = JSON.stringify(encryptedPassport);
      }

      let insuranceInfoJson = null;
      if (insuranceInfo) {
        const encryptedInsurance = { ...insuranceInfo };
        if (insuranceInfo.policyNumber) {
          encryptedInsurance.policyNumber = encryptField(insuranceInfo.policyNumber);
        }
        insuranceInfoJson = JSON.stringify(encryptedInsurance);
      }

      const query = `
        INSERT INTO Patients (
          user_id,
          passport_info,
          insurance_info,
          current_address
        ) VALUES (?, ?, ?, ?)
      `;
      
      const values = [
        user_id,
        passportInfoJson,
        insuranceInfoJson,
        currentAddress || null
      ];
      
      const result = connection 
        ? await connection.execute(query, values)
        : await executeQuery(query, values);
      
      const insertId = connection ? result[0].insertId : result.insertId;
      
      // Return the created patient (use same connection if in transaction)
      return connection 
        ? this.findById(insertId, connection)
        : this.findById(insertId);
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  }

  /**
   * Update patient by user ID
   * @param {number} userId - User ID
   * @param {Object} patientData - Updated patient data
   * @returns {Object} Updated patient object
   */
  static async updateByUserId(userId, patientData) {
    try {
      const updateFields = [];
      const values = [];

      if (patientData.passportInfo !== undefined) {
        const encryptedPassport = patientData.passportInfo ? { ...patientData.passportInfo } : null;
        if (encryptedPassport && encryptedPassport.number) {
          encryptedPassport.number = encryptField(encryptedPassport.number);
        }
        updateFields.push('passport_info = ?');
        values.push(encryptedPassport ? JSON.stringify(encryptedPassport) : null);
      }

      if (patientData.insuranceInfo !== undefined) {
        const encryptedInsurance = patientData.insuranceInfo ? { ...patientData.insuranceInfo } : null;
        if (encryptedInsurance && encryptedInsurance.policyNumber) {
          encryptedInsurance.policyNumber = encryptField(encryptedInsurance.policyNumber);
        }
        updateFields.push('insurance_info = ?');
        values.push(encryptedInsurance ? JSON.stringify(encryptedInsurance) : null);
      }

      if (patientData.currentAddress !== undefined) {
        updateFields.push('current_address = ?');
        values.push(patientData.currentAddress);
      }

      if (updateFields.length === 0) {
        // No fields to update, return current patient
        return this.findByUserId(userId);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(userId);

      const query = `
        UPDATE Patients 
        SET ${updateFields.join(', ')}
        WHERE user_id = ?
      `;
      
      await executeQuery(query, values);
      
      // Return updated patient
      return this.findByUserId(userId);
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  }

  /**
   * Delete patient by user ID - REMOVED
   * Patient deletion should be handled by soft-deleting the associated User record,
   * which will cascade appropriately based on database constraints and business logic.
   * Direct patient record deletion may violate referential integrity.
   * 
   * To deactivate a patient, use User.deactivate(userId) or User.softDelete(userId)
   * 
   * @deprecated Use User soft delete instead
   */
  // static async deleteByUserId(userId) {
  //   // Method removed - use User soft delete to maintain referential integrity
  // }

  /**
   * Get all patients with pagination and filtering
   * @param {Object} filters - Filter options
   * @returns {Object} Patients list with pagination
   */
  static async getAllPatients(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = filters;

      // Whitelist allowed sort columns and orders to prevent SQL injection
      const allowedSortColumns = ['created_at', 'updated_at', 'id'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      const offset = (page - 1) * limit;
      
      let whereClause = '';
      let queryParams = [];
      
      if (search) {
        whereClause = `WHERE 
          u.full_name LIKE ? OR 
          u.email LIKE ? OR 
          JSON_UNQUOTE(JSON_EXTRACT(p.passport_info, '$.country')) LIKE ? OR
          JSON_UNQUOTE(JSON_EXTRACT(p.insurance_info, '$.provider')) LIKE ?
        `;
        const searchTerm = `%${search}%`;
        queryParams = [searchTerm, searchTerm, searchTerm, searchTerm];
      }

      // Count total records
      const countQuery = `
        SELECT COUNT(*) as total
        FROM Patients p
        JOIN Users u ON p.user_id = u.id
        ${whereClause}
      `;
      
      const [countResult] = await executeQuery(countQuery, queryParams);
      const total = countResult[0].total;

      // Get paginated results
      const query = `
        SELECT 
          p.id,
          p.user_id,
          p.passport_info,
          p.insurance_info,
          p.current_address,
          p.created_at,
          p.updated_at,
          u.full_name,
          u.email,
          u.phone_number,
          u.is_active
        FROM Patients p
        JOIN Users u ON p.user_id = u.id
        ${whereClause}
        ORDER BY p.${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      queryParams.push(parseInt(limit), parseInt(offset));
      const [rows] = await executeQuery(query, queryParams);
      
      const patients = rows.map(row => this._transformPatient(row));
      
      return {
        patients,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('Error getting all patients:', error);
      throw error;
    }
  }

  /**
   * Transform database row to patient object
   * @param {Object} dbPatient - Database row
   * @returns {Object} Transformed patient object
   */
  static _transformPatient(dbPatient) {
    const patient = {
      id: dbPatient.id,
      userId: dbPatient.user_id,
      currentAddress: dbPatient.current_address,
      createdAt: dbPatient.created_at,
      updatedAt: dbPatient.updated_at
    };

    // Parse JSON fields safely and decrypt sensitive fields
    try {
      if (dbPatient.passport_info) {
        const passportInfo = JSON.parse(dbPatient.passport_info);
        if (passportInfo && passportInfo.number) {
          passportInfo.number = decryptField(passportInfo.number);
        }
        patient.passportInfo = passportInfo;
      } else {
        patient.passportInfo = null;
      }
    } catch (error) {
      console.error('Error parsing/decrypting passport_info JSON:', error);
      patient.passportInfo = null;
    }

    try {
      if (dbPatient.insurance_info) {
        const insuranceInfo = JSON.parse(dbPatient.insurance_info);
        if (insuranceInfo && insuranceInfo.policyNumber) {
          insuranceInfo.policyNumber = decryptField(insuranceInfo.policyNumber);
        }
        patient.insuranceInfo = insuranceInfo;
      } else {
        patient.insuranceInfo = null;
      }
    } catch (error) {
      console.error('Error parsing/decrypting insurance_info JSON:', error);
      patient.insuranceInfo = null;
    }

    // Include user data if present (from JOIN queries)
    if (dbPatient.full_name) {
      patient.user = {
        fullName: dbPatient.full_name,
        email: dbPatient.email,
        phoneNumber: dbPatient.phone_number,
        isActive: dbPatient.is_active
      };
    }

    return patient;
  }
}

module.exports = Patient;