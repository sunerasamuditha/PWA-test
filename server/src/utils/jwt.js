const jwt = require('jsonwebtoken');

/**
 * Generate access token with short expiration (15 minutes)
 * @param {object} payload - Token payload (user id, uuid, email, role)
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  try {
    const { id, uuid, email, role } = payload;
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const tokenPayload = {
      id,
      uuid,
      email,
      role,
      type: 'access'
    };

    return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '15m', // 15 minutes
      issuer: 'wecare-api',
      audience: 'wecare-client'
    });
  } catch (error) {
    throw new Error(`Error generating access token: ${error.message}`);
  }
};

/**
 * Generate refresh token with longer expiration (7 days)
 * @param {object} payload - Minimal payload (user id only)
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  try {
    const { id } = payload;
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const tokenPayload = {
      id,
      type: 'refresh'
    };

    return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '7d', // 7 days
      issuer: 'wecare-api',
      audience: 'wecare-client'
    });
  } catch (error) {
    throw new Error(`Error generating refresh token: ${error.message}`);
  }
};

/**
 * Verify access token
 * @param {string} token - JWT access token to verify
 * @returns {object} Decoded token payload
 * @throws {JsonWebTokenError|TokenExpiredError} JWT verification errors
 */
const verifyAccessToken = (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'wecare-api',
      audience: 'wecare-client'
    });

    // Verify token type
    if (decoded.type !== 'access') {
      throw new jwt.JsonWebTokenError('Invalid token type');
    }

    return decoded;
  } catch (error) {
    // Let jwt.verify throw its own errors (JsonWebTokenError, TokenExpiredError, etc.)
    // These are handled by errorHandler.js
    throw error;
  }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {object} Decoded token payload
 * @throws {JsonWebTokenError|TokenExpiredError} JWT verification errors
 */
const verifyRefreshToken = (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'wecare-api',
      audience: 'wecare-client'
    });

    // Verify token type
    if (decoded.type !== 'refresh') {
      throw new jwt.JsonWebTokenError('Invalid token type');
    }

    return decoded;
  } catch (error) {
    // Let jwt.verify throw its own errors
    throw error;
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader
};