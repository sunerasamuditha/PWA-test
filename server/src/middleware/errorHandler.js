const asyncHandler = require('../utils/asyncHandler');

/**
 * Custom Error Class for Operational Errors
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Error Handling Middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging (exclude sensitive information)
  const logError = {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  console.error('🚨 Error Handler:', logError);

  // MySQL specific errors
  if (err.code === 'ER_DUP_ENTRY') {
    const message = 'Duplicate entry. This record already exists.';
    error = new AppError(message, 400);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    const message = 'Invalid reference. The referenced record does not exist.';
    error = new AppError(message, 400);
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    const message = 'Cannot delete record. It is referenced by other records.';
    error = new AppError(message, 400);
  }

  if (err.code === 'ER_BAD_FIELD_ERROR') {
    const message = 'Invalid field in query.';
    error = new AppError(message, 400);
  }

  if (err.code === 'ER_PARSE_ERROR') {
    const message = 'Database query syntax error.';
    error = new AppError(message, 500);
  }

  if (err.code === 'ECONNREFUSED') {
    const message = 'Database connection refused.';
    error = new AppError(message, 500);
  }

  // JWT specific errors (Phase 2)
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again.';
    error = new AppError(message, 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = `Validation Error: ${errors.join('. ')}`;
    error = new AppError(message, 400);
  }

  // Express-validator errors
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    const message = errors.map(e => `${e.param}: ${e.msg}`).join(', ');
    error = new AppError(`Validation Error: ${message}`, 400);
  }

  // File upload errors (Phase 5)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large. Please upload a smaller file.';
    error = new AppError(message, 400);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files. Please upload fewer files.';
    error = new AppError(message, 400);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field. Please check your upload form.';
    error = new AppError(message, 400);
  }

  // Cast errors (invalid IDs)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400);
  }

  // Default to 500 server error if no status code is set
  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';

  // Error response object
  const response = {
    status,
    error: {
      message: error.message || 'Something went wrong!',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.code = err.code;
    response.error.name = err.name;
  }

  // Add request ID if available (for tracking)
  if (req.id) {
    response.error.requestId = req.id;
  }

  // Send error response
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found Handler
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404);
  next(error);
};

/**
 * Validation Error Handler
 * Handles express-validator errors
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const { ValidationUtils } = require('../utils/validationUtils');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = req.headers['x-request-id'] || req.id || 'unknown';
    const formattedError = ValidationUtils.formatValidationError(errors, requestId);
    
    // Log validation errors for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Validation Error]', {
        path: req.path,
        method: req.method,
        errors: formattedError.error.details,
        body: req.body,
        query: req.query,
        params: req.params
      });
    }
    
    return res.status(400).json(formattedError);
  }
  
  next();
};

/**
 * Cleanup uploaded file on validation error
 * Use this for routes with file uploads to prevent orphan files
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const cleanupUploadedFileOnValidationError = async (req, res, next) => {
  const { validationResult } = require('express-validator');
  const { ValidationUtils } = require('../utils/validationUtils');
  const { deleteFile } = require('../utils/fileUtils');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Clean up uploaded file if validation fails
    if (req.file?.path) {
      try {
        await deleteFile(req.file.path);
        console.log(`Cleaned up uploaded file due to validation error: ${req.file.path}`);
      } catch (error) {
        console.error('Failed to delete uploaded file on validation error:', error);
      }
    }
    
    const requestId = req.headers['x-request-id'] || req.id || 'unknown';
    const formattedError = ValidationUtils.formatValidationError(errors, requestId);
    
    // Log validation errors for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Validation Error with File Cleanup]', {
        path: req.path,
        method: req.method,
        errors: formattedError.error.details,
        uploadedFile: req.file?.path || 'none',
        body: req.body,
        query: req.query,
        params: req.params
      });
    }
    
    return res.status(400).json(formattedError);
  }
  
  next();
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFound,
  handleValidationErrors,
  cleanupUploadedFileOnValidationError
};