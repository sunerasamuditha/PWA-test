const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate, authorize } = require('../middleware/auth');
const { checkValidationResult } = require('../middleware/validation');
const { auditPartnerUpdate, auditQRGeneration } = require('../middleware/auditLog');

// Import controllers
const partnerController = require('../controllers/partnerController');

// Import validators
const {
  validatePartnerRegistration,
  validatePartnerProfileUpdate,
  validatePartnerStatusUpdate,
  validateGetPartners,
  validateGetPartnerReferrals,
  validateGetCommissionHistory
} = require('../validators/partnerValidators');



/**
 * @route   GET /api/partners/me
 * @desc    Get partner profile
 * @access  Private (Partner only)
 */
router.get('/me',
  authenticate,
  authorize('partner'),
  partnerController.getPartnerProfile
);

/**
 * @route   PUT /api/partners/me
 * @desc    Update partner profile
 * @access  Private (Partner only)
 */
router.put('/me',
  authenticate,
  authorize('partner'),
  validatePartnerProfileUpdate,
  checkValidationResult,
  partnerController.updatePartnerProfile,
  auditPartnerUpdate
);

/**
 * @route   GET /api/partners/me/qrcode
 * @desc    Generate QR code for partner
 * @access  Private (Partner only)
 */
router.get('/me/qrcode',
  authenticate,
  authorize('partner'),
  partnerController.generateQRCode,
  auditQRGeneration
);

/**
 * @route   GET /api/partners/me/referrals
 * @desc    Get partner referrals
 * @access  Private (Partner only)
 */
router.get('/me/referrals',
  authenticate,
  authorize('partner'),
  validateGetPartnerReferrals,
  checkValidationResult,
  partnerController.getPartnerReferrals
);

/**
 * @route   GET /api/partners/stats
 * @desc    Get partner statistics
 * @access  Private (Partner only)
 */
router.get('/stats',
  authenticate,
  authorize('partner'),
  partnerController.getPartnerStats
);

/**
 * @route   GET /api/partners/commission-history
 * @desc    Get partner commission history
 * @access  Private (Partner only)
 */
router.get('/commission-history',
  authenticate,
  authorize('partner'),
  validateGetCommissionHistory,
  checkValidationResult,
  partnerController.getCommissionHistory
);

// Admin-only routes

/**
 * @route   GET /api/partners
 * @desc    Get all partners (admin only)
 * @access  Private (Admin only)
 */
router.get('/',
  authenticate,
  authorize('admin', 'super_admin'),
  validateGetPartners,
  checkValidationResult,
  partnerController.getAllPartners
);

/**
 * @route   GET /api/partners/:userId
 * @desc    Get partner by user ID (admin only)
 * @access  Private (Admin only)
 */
router.get('/:userId',
  authenticate,
  authorize('admin', 'super_admin'),
  partnerController.getPartnerById
);

/**
 * @route   GET /api/partners/:partnerId/referrals
 * @desc    Get partner referrals by partner ID (admin only)
 * @access  Private (Admin only)
 */
router.get('/:partnerId/referrals',
  authenticate,
  authorize('admin', 'super_admin'),
  partnerController.getPartnerReferralsById
);

/**
 * @route   PUT /api/partners/:partnerId/status
 * @desc    Update partner status (admin only)
 * @access  Private (Admin only)
 */
router.put('/:partnerId/status',
  authenticate,
  authorize('admin', 'super_admin'),
  validatePartnerStatusUpdate,
  checkValidationResult,
  partnerController.updatePartnerStatus
);

module.exports = router;