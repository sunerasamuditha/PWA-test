const Document = require('../models/Document');
const { DOCUMENT_TYPES } = require('../models/Document');
const User = require('../models/User');
const { validateFileExists, deleteFile } = require('../utils/fileUtils');
const { AppError } = require('../middleware/errorHandler');

/**
 * Document Service
 * Business logic for document management
 */
class DocumentService {
  /**
   * Upload new document
   * @param {Object} fileData - File metadata
   * @param {number} uploadedBy - Staff user ID (optional)
   * @returns {Promise<Object>} Created document
   */
  static async uploadDocument(fileData, uploadedBy = null) {
    const {
      patient_user_id,
      type,
      file_path,
      original_filename,
      file_size,
      mime_type
    } = fileData;

    // Validate patient exists
    const patient = await User.findById(patient_user_id);
    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    if (patient.role !== 'patient') {
      throw new AppError('User is not a patient', 400);
    }

    // Create document record
    const document = await Document.create({
      patient_user_id,
      type,
      file_path,
      original_filename,
      file_size,
      mime_type,
      uploaded_by_staff_id: uploadedBy
    });

    return document;
  }

  /**
   * Get documents by patient with access control
   * @param {number} patientUserId - Patient user ID
   * @param {Object} filters - Filter options
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions (for staff)
   * @returns {Promise<Object>} Documents and pagination
   */
  static async getDocumentsByPatient(patientUserId, filters, requesterId, requesterRole, requesterPermissions = []) {
    // Access control
    if (requesterRole === 'patient' && patientUserId !== requesterId) {
      throw new AppError('Access denied. Patients can only view their own documents', 403);
    }

    // Staff needs manage_documents permission
    if (requesterRole === 'staff' && !requesterPermissions.includes('manage_documents')) {
      throw new AppError('Access denied. Staff require manage_documents permission', 403);
    }

    // Admins and super_admins have full access

    const result = await Document.findByPatientUserId(patientUserId, filters);
    return result;
  }

  /**
   * Get document by ID with access control
   * @param {number} documentId - Document ID
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions (for staff)
   * @returns {Promise<Object>} Document object
   */
  static async getDocumentById(documentId, requesterId, requesterRole, requesterPermissions = []) {
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Access control
    await this._validateAccess(document, requesterId, requesterRole, requesterPermissions);

    return document;
  }

  /**
   * Download document with access control
   * @param {number} documentId - Document ID
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions (for staff)
   * @returns {Promise<Object>} Object with filePath and document metadata
   */
  static async downloadDocument(documentId, requesterId, requesterRole, requesterPermissions = []) {
    const document = await this.getDocumentById(documentId, requesterId, requesterRole, requesterPermissions);

    // Validate file exists
    if (!validateFileExists(document.filePath)) {
      throw new AppError('File not found on server', 404);
    }

    return {
      filePath: document.filePath,
      document
    };
  }

  /**
   * Delete document with access control
   * @param {number} documentId - Document ID
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @returns {Promise<Object>} Deleted document
   */
  static async deleteDocument(documentId, requesterId, requesterRole) {
    const document = await Document.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Only owner or admin can delete
    if (requesterRole === 'patient' && document.patientUserId !== requesterId) {
      throw new AppError('Access denied. You can only delete your own documents', 403);
    }

    if (!['patient', 'admin', 'super_admin'].includes(requesterRole)) {
      throw new AppError('Access denied. Staff cannot delete documents', 403);
    }

    // Delete physical file
    try {
      await deleteFile(document.filePath);
    } catch (error) {
      console.error('Error deleting physical file:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete database record
    await Document.deleteById(documentId);

    return document;
  }

  /**
   * Get document statistics for patient
   * @param {number} patientUserId - Patient user ID
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions (for staff)
   * @returns {Promise<Object>} Document statistics
   */
  static async getDocumentStats(patientUserId, requesterId, requesterRole, requesterPermissions = []) {
    // Access control for staff viewing other patients' stats
    if (requesterRole === 'staff' && patientUserId !== requesterId) {
      if (!requesterPermissions.includes('manage_documents')) {
        throw new AppError('Access denied. Staff require manage_documents permission to view other patients\' statistics', 403);
      }
    }

    // Patients can only view their own stats
    if (requesterRole === 'patient' && patientUserId !== requesterId) {
      throw new AppError('Access denied. Patients can only view their own statistics', 403);
    }

    const documentTypes = DOCUMENT_TYPES;
    
    // Use optimized single query to get counts by type
    const typeCounts = await Document.getCountsByType(patientUserId);
    
    // Build stats object with counts from aggregated query
    const stats = {
      total: 0,
      byType: {}
    };

    // Initialize all types with 0
    documentTypes.forEach(type => {
      stats.byType[type] = 0;
    });

    // Populate actual counts from query result
    typeCounts.forEach(({ type, count }) => {
      if (stats.byType.hasOwnProperty(type)) {
        stats.byType[type] = count;
        stats.total += count;
      }
    });

    return stats;
  }

  /**
   * Get all documents (admin function)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Documents and pagination
   */
  static async getAllDocuments(filters) {
    return await Document.getAllDocuments(filters);
  }

  /**
   * Validate document access
   * @param {Object} document - Document object
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions (for staff)
   * @private
   */
  static async _validateAccess(document, requesterId, requesterRole, requesterPermissions = []) {
    // Owner can access their own documents
    if (document.patientUserId === requesterId) {
      return true;
    }

    // Admins have full access
    if (['admin', 'super_admin'].includes(requesterRole)) {
      return true;
    }

    // Staff with manage_documents permission can access
    if (requesterRole === 'staff' && requesterPermissions.includes('manage_documents')) {
      return true;
    }

    throw new AppError('Access denied. You do not have permission to access this document', 403);
  }
}

module.exports = DocumentService;
