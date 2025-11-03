// Rate limiting middleware using express-rate-limit
const rateLimit = require('express-rate-limit');

/**
 * Custom key generator using combination of IP and user ID for accurate rate limiting
 */
const keyGenerator = (req) => {
  return req.user?.id ? `user-${req.user.id}` : req.ip;
};

/**
 * Skip function to bypass rate limiting for admins in development
 */
const skip = (req) => {
  return process.env.NODE_ENV === 'development' || req.user?.role === 'super_admin';
};

/**
 * Custom handler for rate limit exceeded
 */
const handler = (req, res) => {
  console.warn(`Rate limit exceeded for ${req.ip} - ${req.method} ${req.path}`);
  res.status(429).json({
    status: 'error',
    error: {
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  });
};

/**
 * Rate limiter for authentication endpoints (login, register)
 * Strict limit to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: false, // Disable draft-6 RateLimit-* headers
  legacyHeaders: true, // Enable X-RateLimit-* headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
  skipSuccessfulRequests: false, // Count all requests
  keyGenerator,
  skip,
  handler
});

/**
 * Rate limiter for password change endpoints
 * Very strict limit for sensitive operations
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: 'Too many password change attempts. Please try again later.',
  standardHeaders: false,
  legacyHeaders: true, // Use X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator,
  skip,
  handler
});

/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 * Moderate limit to prevent spam and abuse
 */
const writeOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests. Please slow down.',
  standardHeaders: false,
  legacyHeaders: true, // Use X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator,
  skip,
  handler
});

/**
 * Rate limiter for read operations (GET)
 * Lenient limit for regular API usage
 */
const readOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests. Please slow down.',
  standardHeaders: false,
  legacyHeaders: true, // Use X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator,
  skip,
  handler
});

/**
 * Rate limiter for general API access
 * Applied globally to all /api routes
 */
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: 'Too many requests. Please slow down.',
  standardHeaders: false,
  legacyHeaders: true, // Use X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator,
  skip,
  handler
});

/**
 * Rate limiter for highly sensitive operations
 * Very strict limit with longer window (user deletion, role changes)
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many sensitive operations. Please try again later.',
  standardHeaders: false,
  legacyHeaders: true, // Use X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator,
  skip,
  handler
});

module.exports = {
  authLimiter,
  passwordChangeLimiter,
  writeOperationsLimiter,
  readOperationsLimiter,
  publicApiLimiter,
  strictLimiter
};
