/**
 * Response Helper Utilities
 * 
 * Standardized response envelope helpers to ensure consistent API responses
 * across all endpoints in the WeCare application.
 * 
 * All successful responses use: { success: true, message?, data: {...} }
 * All error responses use: { success: false, error: { message, code } }
 */

/**
 * Send a successful response with data
 * @param {Object} res - Express response object
 * @param {Object} data - Response data payload
 * @param {String} message - Optional success message
 * @returns {Object} JSON response
 */
const ok = (res, data, message = null) => {
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  return res.status(200).json(response);
};

/**
 * Send a created response (201) with data
 * @param {Object} res - Express response object
 * @param {Object} data - Created resource data
 * @param {String} message - Optional success message
 * @returns {Object} JSON response
 */
const created = (res, data, message = null) => {
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  return res.status(201).json(response);
};

/**
 * Send an accepted response (202)
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {String} message - Optional message
 * @returns {Object} JSON response
 */
const accepted = (res, data = {}, message = null) => {
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  return res.status(202).json(response);
};

/**
 * Send a no content response (204)
 * @param {Object} res - Express response object
 * @returns {Object} Empty response
 */
const noContent = (res) => {
  return res.status(204).send();
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Error message
 * @param {String} code - Error code (optional)
 * @returns {Object} JSON response
 */
const error = (res, statusCode, message, code = null) => {
  const response = {
    success: false,
    error: {
      message,
      ...(code && { code })
    }
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send a bad request response (400)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {String} code - Error code (optional)
 * @returns {Object} JSON response
 */
const badRequest = (res, message, code = 'BAD_REQUEST') => {
  return error(res, 400, message, code);
};

/**
 * Send an unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @returns {Object} JSON response
 */
const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, 401, message, 'UNAUTHORIZED');
};

/**
 * Send a forbidden response (403)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @returns {Object} JSON response
 */
const forbidden = (res, message = 'Forbidden') => {
  return error(res, 403, message, 'FORBIDDEN');
};

/**
 * Send a not found response (404)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @returns {Object} JSON response
 */
const notFound = (res, message = 'Resource not found') => {
  return error(res, 404, message, 'NOT_FOUND');
};

/**
 * Send a conflict response (409)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @returns {Object} JSON response
 */
const conflict = (res, message) => {
  return error(res, 409, message, 'CONFLICT');
};

/**
 * Send an internal server error response (500)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @returns {Object} JSON response
 */
const serverError = (res, message = 'Internal server error') => {
  return error(res, 500, message, 'INTERNAL_SERVER_ERROR');
};

/**
 * Send a response with pagination data
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {String} message - Optional success message
 * @returns {Object} JSON response
 */
const paginated = (res, items, pagination, message = null) => {
  const response = {
    success: true,
    data: {
      items,
      pagination: {
        currentPage: pagination.currentPage || pagination.page || 1,
        totalPages: pagination.totalPages || 1,
        totalItems: pagination.totalItems || pagination.total || items.length,
        itemsPerPage: pagination.itemsPerPage || pagination.limit || items.length
      }
    }
  };
  
  if (message) {
    response.message = message;
  }
  
  return res.status(200).json(response);
};

module.exports = {
  ok,
  created,
  accepted,
  noContent,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  paginated
};
