const express = require('express');
const PatientController = require('../controllers/patientController');
const { authenticate, authorize, ownerOrAdmin, requirePermission } = require('../middleware/auth');
const {
  patientProfileValidation,
  updatePatientValidation,
  healthHistoryQueryValidation
} = require('../validators/patientValidators');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { auditPatientUpdate } = require('../middleware/auditLog');

const router = express.Router();

/**
 * Get current patient's profile
 * GET /api/patients/me
 * Auth: Patient only (own profile)
 */
router.get('/me', 
  authenticate,
  authorize('patient'),
  PatientController.getPatientProfile
);

/**
 * Update current patient's profile
 * PUT /api/patients/me
 * Auth: Patient only (own profile)
 */
router.put('/me',
  authenticate,
  updatePatientValidation,
  handleValidationErrors,
  auditPatientUpdate,
  PatientController.updatePatientProfile
);

/**
 * Get patient's health history timeline
 * GET /api/patients/me/health-history
 * Auth: Patient only (own data)
 */
router.get('/me/health-history',
  authenticate,
  authorize('patient'),
  healthHistoryQueryValidation,
  handleValidationErrors,
  PatientController.getHealthHistory
);

/**
 * Get all patients (admin only)
 * GET /api/patients
 * Auth: Admin and Super Admin only
 */
router.get('/',
  authenticate,
  authorize('admin', 'super_admin'),
  PatientController.getAllPatients
);

/**
 * Search patients for invoice creation (staff with process_payments permission)
 * GET /api/patients/search
 * Auth: Staff with process_payments permission
 */
router.get('/search',
  authenticate,
  requirePermission('process_payments'),
  PatientController.searchPatients
);

/**
 * Get specific patient by user ID
 * GET /api/patients/:userId
 * Auth: Owner or Admin (patient can view own profile, admin can view any)
 */
router.get('/:userId',
  authenticate,
  ownerOrAdmin('userId'),
  PatientController.getPatientById
);

/**
 * Create patient record for existing user (admin only)
 * POST /api/patients
 * Auth: Admin and Super Admin only
 */
router.post('/',
  authenticate,
  authorize('admin', 'super_admin'),
  patientProfileValidation,
  handleValidationErrors,
  PatientController.createPatient
);

/**
 * Update patient by user ID (admin only)
 * PUT /api/patients/:userId
 * Auth: Admin and Super Admin only
 */
router.put('/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  updatePatientValidation,
  handleValidationErrors,
  PatientController.updatePatientById
);

/**
 * Delete patient record by user ID (admin only)
 * DELETE /api/patients/:userId
 * Auth: Admin and Super Admin only
 */
router.delete('/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  PatientController.deletePatient
);

module.exports = router;