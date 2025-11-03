const { executeQuery, executeTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

class PatientService {
  /**
   * Register a new patient with user and patient data
   * @param {Object} userData - User registration data
   * @param {Object} patientData - Patient-specific data
   * @returns {Object} Created user and patient data with tokens
   */
  static async registerPatient(userData, patientData) {
    return await executeTransaction(async (connection) => {
      try {
        // Validate passport and insurance data structure
        if (patientData.passportInfo) {
          this._validatePassportInfo(patientData.passportInfo);
        }
        
        if (patientData.insuranceInfo) {
          this._validateInsuranceInfo(patientData.insuranceInfo);
        }

        // Create user record first (pass connection for transaction)
        const user = await User.create(userData, connection);
        
        // Create patient record with the new user ID (pass connection for transaction)
        const patientRecord = await Patient.create({
          user_id: user.id,
          passportInfo: patientData.passportInfo,
          insuranceInfo: patientData.insuranceInfo,
          currentAddress: patientData.currentAddress
        }, connection);

        // Generate tokens
        const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
        const accessToken = generateAccessToken({
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          role: user.role
        });
        const refreshToken = generateRefreshToken({
          id: user.id
        });

        return {
          user,
          patient: patientRecord,
          accessToken,
          refreshToken
        };
      } catch (error) {
        console.error('Error in patient registration:', error);
        throw error;
      }
    });
  }

  /**
   * Get patient profile with user and patient data
   * @param {number} userId - User ID
   * @returns {Object} Complete patient profile
   */
  static async getPatientProfile(userId) {
    try {
      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.role !== 'patient') {
        throw new AppError('User is not a patient', 400);
      }

      // Get patient data
      const patient = await Patient.findByUserId(userId);
      if (!patient) {
        throw new AppError('Patient profile not found', 404);
      }

      // Remove password hash from user data before merging
      const { passwordHash, ...safeUser } = user;
      
      // Merge user and patient data
      return {
        ...safeUser,
        passportInfo: patient.passportInfo,
        insuranceInfo: patient.insuranceInfo,
        currentAddress: patient.currentAddress,
        patientId: patient.id,
        patientCreatedAt: patient.createdAt,
        patientUpdatedAt: patient.updatedAt
      };
    } catch (error) {
      console.error('Error getting patient profile:', error);
      throw error;
    }
  }

  /**
   * Update patient profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated patient profile
   */
  static async updatePatientProfile(userId, updateData) {
    try {
      // Separate user fields from patient fields
      const userFields = {};
      const patientFields = {};

      // User fields
      if (updateData.fullName !== undefined) userFields.fullName = updateData.fullName;
      if (updateData.email !== undefined) userFields.email = updateData.email;
      if (updateData.phoneNumber !== undefined) userFields.phoneNumber = updateData.phoneNumber;
      if (updateData.dateOfBirth !== undefined) userFields.dateOfBirth = updateData.dateOfBirth;
      if (updateData.address !== undefined) userFields.address = updateData.address;
      if (updateData.emergencyContact !== undefined) userFields.emergencyContact = updateData.emergencyContact;

      // Patient fields
      if (updateData.passportInfo !== undefined) {
        if (updateData.passportInfo) {
          this._validatePassportInfo(updateData.passportInfo);
        }
        patientFields.passportInfo = updateData.passportInfo;
      }
      
      if (updateData.insuranceInfo !== undefined) {
        if (updateData.insuranceInfo) {
          this._validateInsuranceInfo(updateData.insuranceInfo);
        }
        patientFields.insuranceInfo = updateData.insuranceInfo;
      }
      
      if (updateData.currentAddress !== undefined) {
        patientFields.currentAddress = updateData.currentAddress;
      }

      // Update user data if there are user fields to update
      if (Object.keys(userFields).length > 0) {
        await User.updateById(userId, userFields);
      }

      // Update patient data if there are patient fields to update
      if (Object.keys(patientFields).length > 0) {
        await Patient.updateByUserId(userId, patientFields);
      }

      // Return updated profile
      return this.getPatientProfile(userId);
    } catch (error) {
      console.error('Error updating patient profile:', error);
      throw error;
    }
  }

  /**
   * Get health history timeline for a patient
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Array} Chronologically sorted health events
   */
  static async getHealthHistory(userId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        type,
        limit = 50
      } = filters;

      let healthEvents = [];

      // Build date filter conditions
      let dateCondition = '';
      let dateParams = [userId];
      
      if (startDate) {
        dateCondition += ' AND DATE(created_at) >= ?';
        dateParams.push(startDate);
      }
      
      if (endDate) {
        dateCondition += ' AND DATE(created_at) <= ?';
        dateParams.push(endDate);
      }

      // Fetch appointments if type allows
      if (!type || type === 'appointment') {
        const appointmentQuery = `
          SELECT 
            id,
            appointment_datetime as date,
            appointment_type,
            status,
            notes,
            created_at,
            'appointment' as event_type
          FROM Appointments 
          WHERE patient_user_id = ? ${dateCondition.replace('created_at', 'appointment_datetime')}
          ORDER BY appointment_datetime DESC
        `;
        
        try {
          const [appointments] = await executeQuery(appointmentQuery, dateParams);
          healthEvents.push(...appointments.map(apt => ({
            type: 'appointment',
            date: apt.date,
            data: {
              id: apt.id,
              appointmentType: apt.appointment_type,
              status: apt.status,
              notes: apt.notes,
              createdAt: apt.created_at
            }
          })));
        } catch (error) {
          console.warn('Error fetching appointments:', error.message);
        }
      }

      // Fetch invoices if type allows
      if (!type || type === 'invoice') {
        const invoiceQuery = `
          SELECT 
            id,
            invoice_number,
            total_amount,
            status,
            payment_method,
            due_date,
            created_at,
            'invoice' as event_type
          FROM Invoices 
          WHERE patient_user_id = ? ${dateCondition}
          ORDER BY created_at DESC
        `;
        
        try {
          const [invoices] = await executeQuery(invoiceQuery, dateParams);
          healthEvents.push(...invoices.map(inv => ({
            type: 'invoice',
            date: inv.created_at,
            data: {
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              totalAmount: inv.total_amount,
              paymentStatus: inv.status,
              paymentMethod: inv.payment_method,
              dueDate: inv.due_date,
              createdAt: inv.created_at
            }
          })));
        } catch (error) {
          console.warn('Error fetching invoices:', error.message);
        }
      }

      // Fetch documents if type allows
      if (!type || type === 'document') {
        const documentQuery = `
          SELECT 
            id,
            type,
            original_filename,
            file_size,
            uploaded_at,
            'document' as event_type
          FROM \`Documents\`
          WHERE patient_user_id = ? ${dateCondition.replace('created_at', 'uploaded_at')}
          ORDER BY uploaded_at DESC
        `;
        
        try {
          const [documents] = await executeQuery(documentQuery, dateParams);
          healthEvents.push(...documents.map(doc => ({
            type: 'document',
            date: doc.uploaded_at,
            data: {
              id: doc.id,
              documentType: doc.type,
              fileName: doc.original_filename,
              fileSize: doc.file_size,
              uploadedAt: doc.uploaded_at
            }
          })));
        } catch (error) {
          console.warn('Error fetching documents:', error.message);
        }
      }

      // Sort chronologically (newest first) and limit results
      healthEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (limit) {
        healthEvents = healthEvents.slice(0, parseInt(limit));
      }

      return healthEvents;
    } catch (error) {
      console.error('Error getting health history:', error);
      throw error;
    }
  }

  /**
   * Get all patients for admin use
   * @param {Object} filters - Filter options
   * @returns {Object} Patients list with pagination
   */
  static async getAllPatients(filters = {}) {
    try {
      return await Patient.getAllPatients(filters);
    } catch (error) {
      console.error('Error getting all patients:', error);
      throw error;
    }
  }

  /**
   * Create patient record for existing user (admin function)
   * @param {number} userId - User ID
   * @param {Object} patientData - Patient data
   * @returns {Object} Created patient profile
   */
  static async createPatientForUser(userId, patientData) {
    try {
      // Verify user exists and is not already a patient
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.role !== 'patient') {
        throw new AppError('User must have patient role', 400);
      }

      const existingPatient = await Patient.findByUserId(userId);
      if (existingPatient) {
        throw new AppError('Patient record already exists for this user', 400);
      }

      // Validate patient data
      if (patientData.passportInfo) {
        this._validatePassportInfo(patientData.passportInfo);
      }
      
      if (patientData.insuranceInfo) {
        this._validateInsuranceInfo(patientData.insuranceInfo);
      }

      // Create patient record
      const patient = await Patient.create({
        user_id: userId,
        passportInfo: patientData.passportInfo,
        insuranceInfo: patientData.insuranceInfo,
        currentAddress: patientData.currentAddress
      });

      return this.getPatientProfile(userId);
    } catch (error) {
      console.error('Error creating patient for user:', error);
      throw error;
    }
  }

  /**
   * Delete patient record by user ID (admin function)
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  static async deletePatientByUserId(userId) {
    try {
      const patient = await Patient.findByUserId(userId);
      if (!patient) {
        throw new AppError('Patient record not found', 404);
      }

      await Patient.deleteByUserId(userId);
      return true;
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  }

  /**
   * Validate passport information structure
   * @param {Object} passportInfo - Passport information object
   */
  static _validatePassportInfo(passportInfo) {
    const requiredFields = ['number', 'country'];
    const optionalFields = ['expiryDate', 'issueDate', 'placeOfIssue'];
    
    for (const field of requiredFields) {
      if (!passportInfo[field]) {
        throw new AppError(`Passport ${field} is required`, 400);
      }
    }

    // Validate passport number format (6-20 alphanumeric)
    if (!/^[A-Za-z0-9]{6,20}$/.test(passportInfo.number)) {
      throw new AppError('Passport number must be 6-20 alphanumeric characters', 400);
    }

    // Validate country length
    if (passportInfo.country.length < 2 || passportInfo.country.length > 100) {
      throw new AppError('Passport country must be 2-100 characters', 400);
    }

    // Validate dates if provided
    if (passportInfo.expiryDate) {
      const expiryDate = new Date(passportInfo.expiryDate);
      if (expiryDate <= new Date()) {
        throw new AppError('Passport expiry date must be in the future', 400);
      }
    }

    if (passportInfo.issueDate) {
      const issueDate = new Date(passportInfo.issueDate);
      if (issueDate > new Date()) {
        throw new AppError('Passport issue date cannot be in the future', 400);
      }
    }
  }

  /**
   * Validate insurance information structure
   * @param {Object} insuranceInfo - Insurance information object
   */
  static _validateInsuranceInfo(insuranceInfo) {
    const allowedCoverageTypes = ['comprehensive', 'basic', 'emergency'];
    
    // Validate provider length if provided
    if (insuranceInfo.provider && (insuranceInfo.provider.length < 2 || insuranceInfo.provider.length > 200)) {
      throw new AppError('Insurance provider must be 2-200 characters', 400);
    }

    // Validate policy number format if provided
    if (insuranceInfo.policyNumber && !/^[A-Za-z0-9]{5,50}$/.test(insuranceInfo.policyNumber)) {
      throw new AppError('Insurance policy number must be 5-50 alphanumeric characters', 400);
    }

    // Validate coverage type if provided
    if (insuranceInfo.coverageType && !allowedCoverageTypes.includes(insuranceInfo.coverageType)) {
      throw new AppError(`Insurance coverage type must be one of: ${allowedCoverageTypes.join(', ')}`, 400);
    }

    // Validate expiry date if provided
    if (insuranceInfo.expiryDate) {
      const expiryDate = new Date(insuranceInfo.expiryDate);
      if (isNaN(expiryDate.getTime())) {
        throw new AppError('Invalid insurance expiry date format', 400);
      }
    }

    // Validate contact info structure if provided
    if (insuranceInfo.contactInfo) {
      const { phone, email, emergencyHotline } = insuranceInfo.contactInfo;
      
      if (phone && !/^\+?[\d\s\-\(\)]{10,20}$/.test(phone)) {
        throw new AppError('Invalid insurance contact phone format', 400);
      }
      
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError('Invalid insurance contact email format', 400);
      }
      
      if (emergencyHotline && !/^\+?[\d\s\-\(\)]{10,20}$/.test(emergencyHotline)) {
        throw new AppError('Invalid insurance emergency hotline format', 400);
      }
    }
  }

  /**
   * Search patients by name or email (for invoice creation)
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum number of results
   * @returns {Array} List of patients with minimal info
   */
  static async searchPatients(searchTerm, limit = 50) {
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM Users u
      WHERE u.role = 'patient'
        AND u.deleted_at IS NULL
        AND (
          CONCAT(u.first_name, ' ', u.last_name) LIKE ?
          OR u.email LIKE ?
          OR u.phone LIKE ?
        )
      ORDER BY u.first_name, u.last_name
      LIMIT ?
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const [patients] = await executeQuery(query, [searchPattern, searchPattern, searchPattern, limit]);
    
    return patients.map(patient => ({
      id: patient.id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      fullName: `${patient.first_name} ${patient.last_name}`,
      email: patient.email,
      phone: patient.phone
    }));
  }
}

module.exports = PatientService;