const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const mime = require('mime-types');

/**
 * Delete a file from the filesystem
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    // Ignore error if file doesn't exist
    if (error.code === 'ENOENT') {
      console.warn(`File not found: ${filePath}`);
      return true;
    }
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get file statistics
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File stats (size, createdAt, mimeType)
 */
async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const mimeType = getFileMimeType(filePath);
    
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      mimeType
    };
  } catch (error) {
    console.error(`Error getting file stats for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path
 * @returns {boolean} Success status
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Get MIME type from file extension
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getFileMimeType(filePath) {
  const mimeType = mime.lookup(filePath);
  return mimeType || 'application/octet-stream';
}

/**
 * Check if file exists
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file exists
 */
function validateFileExists(filePath) {
  return fsSync.existsSync(filePath);
}

/**
 * Sanitize filename for use in Content-Disposition header
 * Prevents header injection by removing CR/LF and escaping quotes
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilenameForHeader(filename) {
  if (!filename) return 'download';
  
  // Remove CR, LF, and other control characters
  let sanitized = filename.replace(/[\r\n\x00-\x1f\x7f]/g, '');
  
  // Replace quotes with safe characters
  sanitized = sanitized.replace(/"/g, "'");
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = sanitized.substring(0, 255 - ext.length);
    sanitized = nameWithoutExt + ext;
  }
  
  return sanitized;
}

/**
 * Encode filename for RFC 5987 (UTF-8 encoding for HTTP headers)
 * @param {string} filename - Original filename
 * @returns {string} Encoded filename
 */
function encodeRFC5987(filename) {
  return encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
}

/**
 * Stream file to response
 * @param {string} filePath - Path to the file
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for Content-Disposition header
 * @param {boolean} inline - If true, set Content-Disposition to inline (for preview)
 * @returns {Promise<void>}
 */
async function streamFile(filePath, res, filename, inline = false) {
  try {
    // Check if file exists
    if (!validateFileExists(filePath)) {
      throw new Error('File not found');
    }
    
    // Get file stats
    const stats = await getFileStats(filePath);
    
    // Set response headers
    res.setHeader('Content-Type', stats.mimeType);
    res.setHeader('Content-Length', stats.size);
    
    // SECURITY: Sanitize filename for Content-Disposition header
    const sanitizedFilename = sanitizeFilenameForHeader(filename);
    const encodedFilename = encodeRFC5987(sanitizedFilename);
    
    // Set Content-Disposition header with both ASCII and UTF-8 encoded filenames
    const disposition = inline ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    
    // Create read stream and pipe to response
    const readStream = fsSync.createReadStream(filePath);
    
    // Handle stream errors - attach before pipe()
    readStream.on('error', (error) => {
      console.error(`Error streaming file ${filePath}:`, error);
      if (!res.headersSent) {
        // Headers not sent yet, we can send error response
        res.setHeader('X-Error-Message', 'Error streaming file');
        res.status(500).json({
          success: false,
          message: 'Error streaming file'
        });
      } else {
        // Headers already sent, destroy the connection
        res.destroy(error);
      }
    });
    
    // Pipe the file to response
    readStream.pipe(res);
    
  } catch (error) {
    console.error(`Error in streamFile for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get emoji icon for document type
 * @param {string} type - Document type (canonical values only)
 * @returns {string} Emoji icon
 */
function getDocumentTypeIcon(type) {
  const icons = {
    passport: '🛂',
    insurance_card: '💳',
    test_result: '🧪',
    lab_report: '🔬',
    prescription: '�',
    other: '📎'
  };
  
  return icons[type] || icons.other;
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  deleteFile,
  getFileStats,
  ensureDirectoryExists,
  getFileMimeType,
  validateFileExists,
  streamFile,
  sanitizeFilenameForHeader,
  encodeRFC5987,
  getDocumentTypeIcon,
  formatFileSize
};
