const { validationResult } = require('express-validator');

/**
 * Middleware to check validation results from express-validator
 * Should be used after validation middleware in route handlers
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} - JSON response with validation errors or calls next()
 */
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Extract error messages
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  // No validation errors, proceed to next middleware
  next();
};

module.exports = {
  checkValidationResult
};
