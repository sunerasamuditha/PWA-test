const express = require('express');
const StaffController = require('../controllers/staffController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { validateStaffCreate, validateStaffUpdate, validateStaffPermissions, validateStaffProfileUpdate } = require('../validators/staffValidators');
const { auditAccess, auditCRUD } = require('../middleware/auditLog');

const router = express.Router();

// All staff routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/staff
 * @desc Get all staff with pagination and filters
 * @access Admin only
 */
router.get('/', 
  requireRole(['admin', 'super_admin']),
  auditAccess('Staff_Members'),
  StaffController.getAllStaff
);

/**
 * @route GET /api/staff/permissions
 * @desc Get available permissions list
 * @access Admin and Staff with manage_users permission
 */
router.get('/permissions',
  requirePermission(['manage_users']),
  StaffController.getAvailablePermissions
);

/**
 * @route GET /api/staff/profile
 * @desc Get current staff member's profile
 * @access Staff (own profile)
 */
router.get('/profile',
  requireRole(['staff', 'admin']),
  StaffController.getCurrentStaffProfile
);

/**
 * @route PUT /api/staff/profile
 * @desc Update current staff member's profile
 * @access Staff (own profile)
 */
router.put('/profile',
  requireRole(['staff', 'admin']),
  validateStaffProfileUpdate,
  auditCRUD('update', 'Staff_Members'),
  StaffController.updateCurrentStaffProfile
);

/**
 * @route GET /api/staff/:id
 * @desc Get staff by ID
 * @access Admin only
 */
router.get('/:id',
  requireRole(['admin', 'super_admin']),
  auditAccess('Staff_Members'),
  StaffController.getStaffById
);

/**
 * @route POST /api/staff
 * @desc Create new staff member
 * @access Admin only
 */
router.post('/',
  requireRole(['admin', 'super_admin']),
  validateStaffCreate,
  auditCRUD('create', 'Staff_Members'),
  StaffController.createStaff
);

/**
 * @route PUT /api/staff/:id
 * @desc Update staff member
 * @access Admin only
 */
router.put('/:id',
  requireRole(['admin', 'super_admin']),
  validateStaffUpdate,
  auditCRUD('update', 'Staff_Members'),
  StaffController.updateStaff
);

/**
 * @route PUT /api/staff/:id/permissions
 * @desc Update staff member permissions
 * @access Admin only
 */
router.put('/:id/permissions',
  requireRole(['admin', 'super_admin']),
  validateStaffPermissions,
  auditCRUD('update', 'Staff_Members'),
  StaffController.updateStaffPermissions
);

module.exports = router;