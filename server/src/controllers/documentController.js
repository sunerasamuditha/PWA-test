const DocumentService = require('../services/documentService');
const Document = require('../models/Document');
const { DOCUMENT_TYPES } = require('../models/Document');
const asyncHandler = require('../utils/asyncHandler');
const { streamFile, deleteFile } = require('../utils/fileUtils');
const { AppError } = require('../middleware/errorHandler');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } = require('../config/multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Document Controller
 * Handles HTTP requests for document operations
 */

/**
 * Upload document
 * POST /api/documents/upload
 */
const uploadDocument = asyncHandler(async (req, res) => {
  // File is available in req.file (uploaded by multer middleware)
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  let { patient_user_id, type } = req.body;
  
  // If patient_user_id not provided, use authenticated user's ID (for patients)
  if (!patient_user_id && req.user.role === 'patient') {
    patient_user_id = req.user.id;
  }

  // Validate required fields
  if (!patient_user_id || !type) {
    // Delete uploaded file if validation fails
    await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
    throw new AppError('patient_user_id and type are required', 400);
  }

  // SECURITY: Magic number validation to prevent MIME spoofing
  let fileTypeFromFile = null;
  try {
    // Dynamic import for ESM-only file-type package
    const { fileTypeFromFile: detectFileType } = await import('file-type');
    fileTypeFromFile = await detectFileType(req.file.path);
    
    // Use shared ALLOWED_MIME_TYPES from multer config
    const allowedMimeTypes = ALLOWED_MIME_TYPES;
    
    // If file-type can't detect the type, it might be a DOC file (which doesn't have a magic number)
    // or the file is corrupted/invalid
    if (!fileTypeFromFile) {
      // Allow .doc files to pass (older Word format doesn't have reliable magic numbers)
      if (!req.file.originalname.toLowerCase().endsWith('.doc')) {
        await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
        throw new AppError('Unable to verify file type. File may be corrupted or invalid.', 400);
      }
    } else if (!allowedMimeTypes.includes(fileTypeFromFile.mime)) {
      // Detected MIME type is not in the allowed list
      await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
      throw new AppError(
        `Invalid file type detected. Expected one of: ${allowedMimeTypes.join(', ')}, but got: ${fileTypeFromFile.mime}`,
        400
      );
    }
  } catch (error) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    // Otherwise, delete the file and throw a generic error
    await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
    throw new AppError('File validation failed: ' + error.message, 400);
  }

  // ACCESS CONTROL: Validate role and permissions before upload
  let patientUserId;
  if (req.user.role === 'patient') {
    // Patients can only upload to their own account
    patientUserId = req.user.id;
    if (parseInt(patient_user_id) !== req.user.id) {
      await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
      throw new AppError('Access denied. Patients can only upload documents for themselves', 403);
    }
  } else if (req.user.role === 'staff') {
    // Staff must have manage_documents permission
    const requesterPermissions = req.user.permissions || [];
    if (!requesterPermissions.includes('manage_documents')) {
      await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
      throw new AppError('Access denied. Staff require manage_documents permission', 403);
    }
    patientUserId = parseInt(patient_user_id);
  } else if (['admin', 'super_admin'].includes(req.user.role)) {
    patientUserId = parseInt(patient_user_id);
  } else {
    // Only patient, staff, admin, and super_admin can upload
    await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
    throw new AppError('Access denied. Invalid role for document upload', 403);
  }

  // Validate document type
  if (!DOCUMENT_TYPES.includes(type)) {
    await deleteFile(req.file.path).catch(err => console.error('Failed to delete file:', err));
    throw new AppError(`Invalid document type: ${type}`, 400);
  }

  // Move file from temp to final location
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  const finalDir = path.join(uploadRoot, String(patientUserId), type);
  await fs.mkdir(finalDir, { recursive: true });
  
  const finalPath = path.join(finalDir, path.basename(req.file.path));
  
  try {
    await fs.rename(req.file.path, finalPath);
  } catch (moveError) {
    // If rename fails, try copy and delete
    try {
      await fs.copyFile(req.file.path, finalPath);
      await deleteFile(req.file.path).catch(() => {});
    } catch (copyError) {
      await deleteFile(req.file.path).catch(() => {});
      throw new AppError('Failed to move uploaded file to final location', 500);
    }
  }

  // Prepare file data with final path
  const fileData = {
    patient_user_id: patientUserId,
    type,
    file_path: finalPath,
    original_filename: req.file.originalname,
    file_size: req.file.size,
    // Use validated MIME type if available, otherwise use client-reported with .doc fallback
    mime_type: fileTypeFromFile ? fileTypeFromFile.mime : req.file.mimetype
  };

  // Get uploader (if staff uploaded)
  const uploadedBy = req.user.role !== 'patient' ? req.user.id : null;

  // Upload document with cleanup on failure
  let document;
  try {
    document = await DocumentService.uploadDocument(fileData, uploadedBy);
  } catch (error) {
    // Clean up uploaded file if DB insert fails (now at final path)
    await deleteFile(finalPath).catch(err => console.error('Failed to delete file on error:', err));
    throw error;
  }

  // Store in res.locals for audit logging
  res.locals.document = document;

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: Document.toClientResponse(document)
  });
});

/**
 * Get documents with filtering
 * GET /api/documents
 */
const getDocuments = asyncHandler(async (req, res) => {
  const {
    patient_user_id,
    type,
    search,
    startDate,
    endDate,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  // If patient_user_id not provided, use requester's ID for patients
  let targetPatientId = patient_user_id ? parseInt(patient_user_id) : null;
  
  if (req.user.role === 'patient') {
    targetPatientId = req.user.id;
  }

  if (!targetPatientId) {
    throw new AppError('patient_user_id is required', 400);
  }

  const filters = {
    type,
    search,
    startDate,
    endDate,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
    sortBy,
    sortOrder
  };

  // Get requester permissions
  const requesterPermissions = req.user.permissions || [];

  const result = await DocumentService.getDocumentsByPatient(
    targetPatientId,
    filters,
    req.user.id,
    req.user.role,
    requesterPermissions
  );

  // Sanitize documents in result
  const sanitizedResult = {
    ...result,
    documents: result.documents.map(doc => Document.toClientResponse(doc))
  };

  res.json({
    success: true,
    data: sanitizedResult
  });
});

/**
 * Get document by ID
 * GET /api/documents/:id
 */
const getDocumentById = asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);
  const requesterPermissions = req.user.permissions || [];

  const document = await DocumentService.getDocumentById(
    documentId,
    req.user.id,
    req.user.role,
    requesterPermissions
  );

  res.json({
    success: true,
    data: Document.toClientResponse(document)
  });
});

/**
 * Download document
 * GET /api/documents/:id/download
 */
const downloadDocument = asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);
  const requesterPermissions = req.user.permissions || [];

  const { filePath, document } = await DocumentService.downloadDocument(
    documentId,
    req.user.id,
    req.user.role,
    requesterPermissions
  );

  // Stream file to response with attachment disposition
  await streamFile(filePath, res, document.originalFilename, false);
});

/**
 * View document (inline preview)
 * GET /api/documents/:id/view
 */
const viewDocument = asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);
  const requesterPermissions = req.user.permissions || [];

  const { filePath, document } = await DocumentService.downloadDocument(
    documentId,
    req.user.id,
    req.user.role,
    requesterPermissions
  );

  // Stream file to response with inline disposition for preview
  await streamFile(filePath, res, document.originalFilename, true);
});

/**
 * Delete document
 * DELETE /api/documents/:id
 */
const deleteDocument = asyncHandler(async (req, res) => {
  const documentId = parseInt(req.params.id);

  // Capture before state (what's being deleted)
  const documentToDelete = await DocumentService.getDocumentById(documentId, req.user.id, req.user.role);
  res.locals.beforeData = documentToDelete;

  const deletedDocument = await DocumentService.deleteDocument(
    documentId,
    req.user.id,
    req.user.role
  );

  // Mark as deleted in after state and store in res.locals for audit logging
  res.locals.afterData = { deleted: true, deletedAt: new Date().toISOString() };
  res.locals.deletedDocument = deletedDocument;

  res.json({
    success: true,
    message: 'Document deleted successfully',
    data: Document.toClientResponse(deletedDocument)
  });
});

/**
 * Get document statistics
 * GET /api/documents/stats
 */
const getDocumentStats = asyncHandler(async (req, res) => {
  // For patients, get their own stats
  const patientUserId = req.user.role === 'patient' ? req.user.id : req.query.patient_user_id;

  if (!patientUserId) {
    throw new AppError('patient_user_id is required', 400);
  }

  const requesterPermissions = req.user.permissions || [];

  const stats = await DocumentService.getDocumentStats(
    parseInt(patientUserId),
    req.user.id,
    req.user.role,
    requesterPermissions
  );

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Get all documents (admin function)
 * GET /api/documents/admin
 */
const getAllDocuments = asyncHandler(async (req, res) => {
  // Allow admin, super_admin, and staff with manage_documents permission
  const permissions = req.user.permissions || [];
  const hasAccess = 
    req.user.role === 'admin' || 
    req.user.role === 'super_admin' || 
    (req.user.role === 'staff' && permissions.includes('manage_documents'));
  
  if (!hasAccess) {
    throw new AppError('Access denied. Admin privileges or manage_documents permission required.', 403);
  }

  const {
    patient_user_id,
    type,
    search,
    startDate,
    endDate,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  const filters = {
    patient_user_id: patient_user_id ? parseInt(patient_user_id) : null,
    type,
    search,
    startDate,
    endDate,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
    sortBy,
    sortOrder
  };

  const result = await DocumentService.getAllDocuments(filters);

  // Sanitize documents in result
  const sanitizedResult = {
    ...result,
    documents: result.documents.map(doc => Document.toClientResponse(doc))
  };

  res.json({
    success: true,
    data: sanitizedResult
  });
});

/**
 * Get document upload configuration
 * GET /api/documents/config
 */
const getDocumentConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS,
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
      allowedTypes: DOCUMENT_TYPES // Expose canonical document types from DB
    }
  });
});

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  downloadDocument,
  viewDocument,
  deleteDocument,
  getDocumentStats,
  getAllDocuments,
  getDocumentConfig
};
