const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { DOCUMENT_TYPES } = require('../models/Document');

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Sanitize filename to prevent security issues
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove path traversal characters
  let sanitized = filename.replace(/[\.\/\\]/g, '_');
  
  // Remove special characters except alphanumeric, dash, underscore
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
  
  // Limit length to 100 characters
  if (sanitized.length > 100) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = sanitized.substring(0, 100 - ext.length);
    sanitized = nameWithoutExt + ext;
  }
  
  return sanitized;
}

/**
 * Configure multer disk storage
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      // SECURITY: Ensure req.user is available (authentication required)
      if (!req.user || !req.user.id) {
        return cb(new Error('Authentication required for file upload'));
      }

      // Get root upload directory from environment variable
      const root = path.resolve(process.env.UPLOAD_DIR || 'uploads');
      
      // Use temporary directory to avoid dependency on req.body field order
      // Files will be moved to final location in controller after validation
      const dest = path.join(root, 'tmp');
      const resolvedDest = path.resolve(dest);
      
      // SECURITY: Prevent path traversal - ensure resolved path doesn't escape root
      const rel = path.relative(root, resolvedDest);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return cb(new Error('Invalid upload path detected'));
      }
      
      // Create directory recursively if it doesn't exist
      fs.mkdirSync(resolvedDest, { recursive: true });
      
      cb(null, resolvedDest);
    } catch (error) {
      cb(error);
    }
  },
  
  filename: function (req, file, cb) {
    try {
      // Generate secure filename: {timestamp}-{uuid}-{sanitizedOriginalName}
      const timestamp = Date.now();
      const uniqueId = uuidv4();
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      const sanitizedName = sanitizeFilename(nameWithoutExt);
      
      const filename = `${timestamp}-${uniqueId}-${sanitizedName}${ext}`;
      
      cb(null, filename);
    } catch (error) {
      cb(error);
    }
  }
});

/**
 * File filter to validate file types
 */
const fileFilter = function (req, file, cb) {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`), false);
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
  
  // File is valid
  cb(null, true);
};

/**
 * Create multer upload middleware
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Allow up to 5 files for multiple uploads
  }
});

// Export upload middleware variants
module.exports = {
  upload,
  uploadSingle: upload.single('document'),
  uploadMultiple: upload.array('documents', 5),
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  sanitizeFilename
};
