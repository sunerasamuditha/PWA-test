const bcrypt = require('bcrypt');

// Salt rounds for bcrypt hashing (12 rounds for good security vs performance balance)
const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainPassword - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (plainPassword) => {
  try {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (plainPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} plainPassword - Plain text password to compare
 * @param {string} hashedPassword - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!hashedPassword || typeof hashedPassword !== 'string') {
      throw new Error('Hashed password must be a non-empty string');
    }

    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error(`Error comparing password: ${error.message}`);
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and errors array
 */
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak patterns
  const commonPatterns = [
    /(.)\1{2,}/, // Three or more consecutive identical characters
    /123456|654321|qwerty|password|admin|user/i, // Common weak passwords
    /^[a-zA-Z]+$|^\d+$/ // Only letters or only numbers
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains weak patterns');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  SALT_ROUNDS
};