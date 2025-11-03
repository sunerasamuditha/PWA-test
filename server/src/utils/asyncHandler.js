/**
 * Async Handler Wrapper
 * Eliminates the need for try-catch blocks in async controllers
 * by catching errors and passing them to Express error handling middleware
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * Usage:
 * const asyncHandler = require('../utils/asyncHandler');
 * 
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Execute the function and catch any errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;