const PatientService = require('../services/patientService');
const asyncHandler = require('../utils/asyncHandler');

class PatientController {
  /**
   * Get current patient's profile
   * GET /api/patients/me
   */
  static getPatientProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    const patientProfile = await PatientService.getPatientProfile(userId);
    
    res.status(200).json({
      success: true,
      message: 'Patient profile retrieved successfully',
      data: patientProfile
    });
  });

  /**
   * Update current patient's profile
   * PUT /api/patients/me
   */
  static updatePatientProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const updateData = req.body;
    
    const updatedProfile = await PatientService.updatePatientProfile(userId, updateData);
    
    // Store updated patient data for audit logging
    res.locals.updatedPatient = updatedProfile;
    
    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: updatedProfile
    });
  });

  /**
   * Get patient's health history timeline
   * GET /api/patients/me/health-history
   */
  static getHealthHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type,
      limit: req.query.limit
    };
    
    const healthHistory = await PatientService.getHealthHistory(userId, filters);
    
    res.status(200).json({
      success: true,
      message: 'Health history retrieved successfully',
      data: {
        healthHistory,
        filters: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          type: filters.type,
          limit: filters.limit || 50
        }
      }
    });
  });

  /**
   * Get all patients (admin only)
   * GET /api/patients
   */
  static getAllPatients = asyncHandler(async (req, res) => {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const result = await PatientService.getAllPatients(filters);
    
    res.status(200).json({
      success: true,
      message: 'Patients retrieved successfully',
      data: result
    });
  });

  /**
   * Get specific patient by ID (admin or owner)
   * GET /api/patients/:userId
   */
  static getPatientById = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    
    const patientProfile = await PatientService.getPatientProfile(userId);
    
    res.status(200).json({
      success: true,
      message: 'Patient profile retrieved successfully',
      data: patientProfile
    });
  });

  /**
   * Create patient record for existing user (admin only)
   * POST /api/patients
   */
  static createPatient = asyncHandler(async (req, res) => {
    const { userId, ...patientData } = req.body;
    
    const patientProfile = await PatientService.createPatientForUser(userId, patientData);
    
    res.status(201).json({
      success: true,
      message: 'Patient record created successfully',
      data: patientProfile
    });
  });

  /**
   * Update patient by user ID (admin only)
   * PUT /api/patients/:userId
   */
  static updatePatientById = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const updateData = req.body;
    
    const updatedProfile = await PatientService.updatePatientProfile(userId, updateData);
    
    res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully',
      data: updatedProfile
    });
  });

  /**
   * Delete patient record (admin only)
   * DELETE /api/patients/:userId
   */
  static deletePatient = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    
    await PatientService.deletePatientByUserId(userId);
    
    res.status(200).json({
      success: true,
      message: 'Patient record deleted successfully'
    });
  });

  /**
   * Search patients (staff with process_payments permission)
   * GET /api/patients/search
   */
  static searchPatients = asyncHandler(async (req, res) => {
    const searchTerm = req.query.q || '';
    const limit = parseInt(req.query.limit) || 50;
    
    const patients = await PatientService.searchPatients(searchTerm, limit);
    
    res.status(200).json({
      success: true,
      message: 'Patients retrieved successfully',
      data: patients
    });
  });
}

module.exports = PatientController;