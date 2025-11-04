const { executeQuery } = require('../config/database');

/**
 * Valid document types (canonical values matching database ENUM in 007_create_documents_table.sql)
 * These values MUST match the database enum exactly
 */
const DOCUMENT_TYPES = [
  'passport',
  'insurance_card',
  'test_result',
  'diagnosis_card',
  'lab_report',
  'invoice',
  'instruction_card',
  'insurance_agreement',
  'other'
];

/**
 * Document Model
 * Handles database operations for the Documents table
 */
class Document {
  /**
   * Find document by ID
   * @param {number} id - Document ID
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Promise<Object|null>} Document object or null
   */
  static async findById(id, connection = null) {
    const query = `
      SELECT 
        d.*,
        u.full_name as uploader_name
      FROM \`documents\` d
      LEFT JOIN \`users\` u ON d.uploaded_by_staff_id = u.id
      WHERE d.id = ?
    `;
    
    const [results] = await executeQuery(query, [id], connection);
    return results.length > 0 ? this._transformDocument(results[0]) : null;
  }

  /**
   * Find all documents for a patient with filtering and pagination
   * @param {number} patientUserId - Patient user ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Object containing documents array and pagination info
   */
  static async findByPatientUserId(patientUserId, filters = {}) {
    const {
      type,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'uploaded_at',
      sortOrder = 'DESC'
    } = filters;

    let query = `
      SELECT 
        d.*,
        u.full_name as uploader_name
      FROM \`documents\` d
      LEFT JOIN \`users\` u ON d.uploaded_by_staff_id = u.id
      WHERE d.patient_user_id = ?
    `;
    const params = [patientUserId];

    // Apply type filter
    if (type) {
      query += ' AND d.type = ?';
      params.push(type);
    }

    // Apply search filter
    if (search) {
      query += ' AND d.original_filename LIKE ?';
      params.push(`%${search}%`);
    }

    // Apply date range filter
    if (startDate) {
      query += ' AND d.uploaded_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND d.uploaded_at <= ?';
      params.push(endDate);
    }

    // Get total count for pagination (before adding ORDER BY and LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`documents\` d
      WHERE d.patient_user_id = ?
      ${type ? 'AND d.type = ?' : ''}
      ${search ? 'AND d.original_filename LIKE ?' : ''}
      ${startDate ? 'AND d.uploaded_at >= ?' : ''}
      ${endDate ? 'AND d.uploaded_at <= ?' : ''}
    `;
    const countParams = [...params];
    const [countResult] = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['uploaded_at', 'type', 'original_filename', 'file_size'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'uploaded_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY d.${sortField} ${order}`;

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [results] = await executeQuery(query, params);
    
    return {
      documents: results.map(doc => this._transformDocument(doc)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new document
   * @param {Object} documentData - Document data
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Promise<Object>} Created document
   */
  static async create(documentData, connection = null) {
    const {
      patient_user_id,
      type,
      file_path,
      original_filename,
      file_size,
      mime_type,
      uploaded_by_staff_id
    } = documentData;

    // Validate required fields
    if (!patient_user_id || !type || !file_path || !original_filename || !mime_type) {
      throw new Error('Missing required fields for document creation');
    }

    // Validate document type
    const validTypes = DOCUMENT_TYPES;
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid document type: ${type}`);
    }

    const query = `
      INSERT INTO \`documents\` (
        patient_user_id,
        type,
        file_path,
        original_filename,
        file_size,
        mime_type,
        uploaded_by_staff_id,
        uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      patient_user_id,
      type,
      file_path,
      original_filename,
      file_size || null,
      mime_type,
      uploaded_by_staff_id || null
    ];

    const [result] = await executeQuery(query, params, connection);
    
    // Fetch and return the created document
    return await this.findById(result.insertId, connection);
  }

  /**
   * Update document metadata
   * @param {number} id - Document ID
   * @param {Object} documentData - Document data to update
   * @returns {Promise<Object>} Updated document
   */
  static async updateById(id, documentData) {
    const allowedFields = ['type', 'original_filename'];
    const updates = [];
    const params = [];

    Object.keys(documentData).forEach(key => {
      if (allowedFields.includes(key) && documentData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(documentData[key]);
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);

    const query = `
      UPDATE \`documents\`
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await executeQuery(query, params);
    
    // Return updated document
    return await this.findById(id);
  }

  /**
   * Delete document by ID
   * @param {number} id - Document ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteById(id) {
    const query = 'DELETE FROM `documents` WHERE id = ?';
    const [result] = await executeQuery(query, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Get all documents with filtering (for admin use)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Object containing documents array and pagination info
   */
  static async getAllDocuments(filters = {}) {
    const {
      patient_user_id,
      type,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'uploaded_at',
      sortOrder = 'DESC'
    } = filters;

    let query = `
      SELECT 
        d.*,
        u.full_name as uploader_name,
        p.full_name as patient_name
      FROM \`documents\` d
      LEFT JOIN \`users\` u ON d.uploaded_by_staff_id = u.id
      LEFT JOIN \`users\` p ON d.patient_user_id = p.id
      WHERE 1=1
    `;
    const params = [];

    // Apply patient filter
    if (patient_user_id) {
      query += ' AND d.patient_user_id = ?';
      params.push(patient_user_id);
    }

    // Apply type filter
    if (type) {
      query += ' AND d.type = ?';
      params.push(type);
    }

    // Apply search filter
    if (search) {
      query += ' AND (d.original_filename LIKE ? OR d.type LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Apply date range filter
    if (startDate) {
      query += ' AND d.uploaded_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND d.uploaded_at <= ?';
      params.push(endDate);
    }

    // Get total count for pagination (before adding ORDER BY and LIMIT)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`documents\` d
      WHERE 1=1
      ${patient_user_id ? 'AND d.patient_user_id = ?' : ''}
      ${type ? 'AND d.type = ?' : ''}
      ${search ? 'AND (d.original_filename LIKE ? OR d.type LIKE ?)' : ''}
      ${startDate ? 'AND d.uploaded_at >= ?' : ''}
      ${endDate ? 'AND d.uploaded_at <= ?' : ''}
    `;
    const countParams = [...params];
    const [countResult] = await executeQuery(countQuery, countParams);
    const total = countResult[0].total;

    // Add sorting
    const allowedSortFields = ['uploaded_at', 'type', 'original_filename', 'file_size', 'patient_name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'uploaded_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    if (sortBy === 'patient_name') {
      query += ` ORDER BY p.full_name ${order}`;
    } else {
      query += ` ORDER BY d.${sortField} ${order}`;
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [results] = await executeQuery(query, params);
    
    return {
      documents: results.map(doc => this._transformDocument(doc)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Count documents by patient and type
   * @param {number} patientUserId - Patient user ID
   * @param {string} type - Document type (optional)
   * @returns {Promise<number>} Document count
   */
  static async countByPatientAndType(patientUserId, type = null) {
    let query = 'SELECT COUNT(*) as count FROM `documents` WHERE patient_user_id = ?';
    const params = [patientUserId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    const [results] = await executeQuery(query, params);
    return results[0].count;
  }

  /**
   * Get aggregated counts by type for a patient (optimized single query)
   * @param {number} patientUserId - Patient user ID
   * @returns {Promise<Array>} Array of { type, count } objects
   */
  static async getCountsByType(patientUserId) {
    const query = `
      SELECT type, COUNT(*) as count 
      FROM \`documents\` 
      WHERE patient_user_id = ? 
      GROUP BY type
    `;
    const [results] = await executeQuery(query, [patientUserId]);
    return results;
  }

  /**
   * Transform database document object to camelCase
   * @param {Object} dbDocument - Database document object
   * @returns {Object} Transformed document object
   * @private
   */
  static _transformDocument(dbDocument) {
    if (!dbDocument) return null;

    return {
      id: dbDocument.id,
      patientUserId: dbDocument.patient_user_id,
      type: dbDocument.type,
      filePath: dbDocument.file_path,
      originalFilename: dbDocument.original_filename,
      fileSize: dbDocument.file_size,
      mimeType: dbDocument.mime_type,
      uploadedByStaffId: dbDocument.uploaded_by_staff_id,
      uploadedAt: dbDocument.uploaded_at,
      // Joined fields
      uploaderName: dbDocument.uploader_name || null,
      patientName: dbDocument.patient_name || null
    };
  }

  /**
   * Transform document for client response (exclude internal paths)
   * @param {Object} document - Document object
   * @returns {Object} Sanitized document object for client
   */
  static toClientResponse(document) {
    if (!document) return null;

    const { filePath, ...clientSafeDocument } = document;
    return clientSafeDocument;
  }
}

module.exports = Document;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
