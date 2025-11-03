const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, cleanupUploadedFileOnValidationError } = require('../middleware/errorHandler');
const {
  uploadDocumentValidation,
  getDocumentsValidation,
  documentIdValidation,
  deleteDocumentValidation,
  getStatsValidation
} = require('../validators/documentValidators');
const { uploadSingle } = require('../config/multer');
const { cleanupOnAbort } = require('../utils/cleanupTempFiles');

// Import audit middleware (will be added to auditLog.js)
const {
  auditDocumentUpload,
  auditDocumentDownload,
  auditDocumentDelete
} = require('../middleware/auditLog');

/**
 * @route   POST /api/documents/upload
 * @desc    Upload a document
 * @access  Private (Patient, Staff, Admin)
 * @note    auditDocumentUpload runs after controller via res.on('finish') and reads res.locals.document
 */
router.post(
  '/upload',
  authenticate,
  uploadSingle, // Multer middleware for file upload
  cleanupOnAbort, // Cleanup temp file if request aborts
  uploadDocumentValidation,
  cleanupUploadedFileOnValidationError, // Clean up file if validation fails
  documentController.uploadDocument,
  auditDocumentUpload
);

/**
 * @route   GET /api/documents/config
 * @desc    Get document upload configuration (allowed types, max size)
 * @access  Public (for client validation)
 */
router.get(
  '/config',
  documentController.getDocumentConfig
);

/**
 * @route   GET /api/documents/stats
 * @desc    Get document statistics for patient
 * @access  Private (Patient, Staff, Admin)
 * @note    Must be before /:id route to avoid route collision
 */
router.get(
  '/stats',
  authenticate,
  getStatsValidation,
  handleValidationErrors,
  documentController.getDocumentStats
);

/**
 * @route   GET /api/documents/admin
 * @desc    Get all documents with filtering (admin function)
 * @access  Private (Admin, Super Admin only)
 * @note    Must be before /:id route to avoid route collision
 */
router.get(
  '/admin',
  authenticate,
  getDocumentsValidation,
  handleValidationErrors,
  documentController.getAllDocuments
);

/**
 * @route   GET /api/documents
 * @desc    Get documents with filtering
 * @access  Private (Patient, Staff, Admin)
 */
router.get(
  '/',
  authenticate,
  getDocumentsValidation,
  handleValidationErrors,
  documentController.getDocuments
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Private (Owner, Staff with permission, Admin)
 */
router.get(
  '/:id',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.getDocumentById
);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Download document
 * @access  Private (Owner, Staff with permission, Admin)
 * @note    auditDocumentDownload runs after controller via res.on('finish')
 */
router.get(
  '/:id/download',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.downloadDocument,
  auditDocumentDownload
);

/**
 * @route   GET /api/documents/:id/view
 * @desc    View document inline (preview)
 * @access  Private (Owner, Staff with permission, Admin)
 * @note    auditDocumentDownload runs after controller via res.on('finish')
 */
router.get(
  '/:id/view',
  authenticate,
  documentIdValidation,
  handleValidationErrors,
  documentController.viewDocument,
  auditDocumentDownload
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document
 * @access  Private (Owner, Admin)
 * @note    auditDocumentDelete runs after controller via res.on('finish') and reads res.locals.deletedDocument
 */
router.delete(
  '/:id',
  authenticate,
  deleteDocumentValidation,
  handleValidationErrors,
  documentController.deleteDocument,
  auditDocumentDelete
);

module.exports = router;
