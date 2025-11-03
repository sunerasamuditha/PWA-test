// Request sanitization middleware to prevent injection attacks
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const validator = require('validator');

/**
 * IMPORTANT SANITIZATION NOTES:
 * 
 * This middleware applies multiple layers of sanitization to prevent injection attacks:
 * 1. NoSQL Injection: Removes $ and . characters (mongoSanitize)
 * 2. XSS Prevention: Escapes HTML entities (xss-clean)
 * 3. Custom Sanitization: Normalizes strings, emails, etc.
 * 
 * MUTATION BEHAVIOR:
 * - Sanitization MUTATES request objects (req.body, req.query) in place
 * - Original values are NOT preserved
 * - String fields are trimmed, truncated, and null bytes removed
 * - Nested objects are recursively sanitized
 * 
 * EXCLUSIONS:
 * - Fields that must remain unchanged should be handled BEFORE this middleware
 * - Signed payloads (JWT, webhooks) should be validated before sanitization
 * - Binary data and file uploads bypass this middleware (handled separately)
 * 
 * PERFORMANCE:
 * - Recursive sanitization can be slow for deeply nested objects
 * - Consider specific field sanitization for large payloads
 * 
 * SECURITY TRADE-OFFS:
 * - May break legitimate use cases with special characters
 * - Consider per-route sanitization for sensitive endpoints
 * - Use express-validator for explicit field validation when needed
 */

/**
 * Sanitize email address
 */
function sanitizeEmail(email) {
  if (!email) return null;
  
  const trimmed = email.trim();
  return validator.normalizeEmail(trimmed) || trimmed;
}

/**
 * Sanitize string value
 */
function sanitizeString(str, maxLength = 5000) {
  if (!str) return null;
  if (typeof str !== 'string') return String(str);
  
  // Trim whitespace
  let sanitized = str.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize JSON string
 */
function sanitizeJSON(jsonString) {
  if (!jsonString) return null;
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Recursively sanitize string values in object
    const sanitizeObj = (obj) => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObj);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
          result[key] = sanitizeObj(obj[key]);
        }
        return result;
      }
      return obj;
    };
    
    return JSON.stringify(sanitizeObj(parsed));
  } catch (error) {
    // Invalid JSON, return sanitized string
    return sanitizeString(jsonString);
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename, maxLength = 255) {
  if (!filename) return null;
  
  let sanitized = filename;
  
  // Remove path traversal characters
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');
  
  // Remove special characters except dots, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, maxLength - ext.length);
    sanitized = name + ext;
  }
  
  return sanitized;
}

/**
 * Sanitize search query to prevent SQL injection in LIKE queries
 */
function sanitizeSearchQuery(query) {
  if (!query) return null;
  
  let sanitized = sanitizeString(query, 500);
  
  // Escape SQL LIKE wildcards
  sanitized = sanitized.replace(/%/g, '\\%');
  sanitized = sanitized.replace(/_/g, '\\_');
  
  return sanitized;
}

/**
 * Global sanitization middleware
 * Applies multiple sanitization layers to all incoming requests
 * 
 * EXCLUSIONS: Fields that should NOT be sanitized (e.g., signed payloads, hashes)
 * Add field names to this list if they must remain unchanged
 */
const SANITIZATION_EXCLUSIONS = new Set([
  'signature',          // Webhook signatures
  'hash',               // Hashed values
  'token',              // JWT tokens (validated separately)
  'encodedData',        // Base64 or other encoded data
  'rawPayload',         // Raw payloads for verification
  'encryptedData',      // Already encrypted data
  'authTag',            // Encryption auth tags
  'iv'                  // Encryption initialization vectors
]);

/**
 * Check if a field should be excluded from sanitization
 */
function shouldExclude(key) {
  return SANITIZATION_EXCLUSIONS.has(key);
}

const sanitizeRequest = [
  // Remove $ and . characters to prevent NoSQL injection
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      console.warn(`Sanitized NoSQL injection attempt in ${key} from ${req.ip}`);
    }
  }),
  
  // Sanitize user input to prevent XSS attacks
  xss(),
  
  // Custom sanitization middleware
  (req, res, next) => {
    // Sanitize common fields
    if (req.body) {
      // Sanitize email fields (if not excluded)
      if (req.body.email && !shouldExclude('email')) {
        req.body.email = sanitizeEmail(req.body.email);
      }
      
      // Sanitize search queries (if not excluded)
      if (req.body.search && !shouldExclude('search')) {
        req.body.search = sanitizeSearchQuery(req.body.search);
      }
      
      // Sanitize string fields (recursively handle nested objects)
      // Skip excluded fields to prevent mutation of sensitive data
      const sanitizeObject = (obj, depth = 0) => {
        // Prevent excessive recursion
        if (depth > 10) return;
        
        for (const key in obj) {
          // Skip excluded fields
          if (shouldExclude(key)) {
            continue;
          }
          
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeString(obj[key]);
          } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            sanitizeObject(obj[key], depth + 1);
          } else if (Array.isArray(obj[key])) {
            // Sanitize array elements (but don't mutate non-string values)
            obj[key] = obj[key].map(item => {
              if (typeof item === 'string') {
                return sanitizeString(item);
              } else if (item && typeof item === 'object') {
                sanitizeObject(item, depth + 1);
                return item;
              }
              return item;
            });
          }
        }
      };
      
      sanitizeObject(req.body);
    }
    
    // Sanitize query parameters (skip excluded fields)
    if (req.query) {
      for (const key in req.query) {
        if (!shouldExclude(key) && typeof req.query[key] === 'string') {
          req.query[key] = sanitizeString(req.query[key]);
        }
      }
    }
    
    next();
  }
];

/**
 * Validate and sanitize input middleware factory
 * Creates middleware based on field configuration
 */
function validateAndSanitizeInput(fieldConfig) {
  return (req, res, next) => {
    const data = req.body;
    
    for (const field in fieldConfig) {
      const config = fieldConfig[field];
      const value = data[field];
      
      if (!value && config.required) {
        return res.status(400).json({
          status: 'error',
          error: {
            message: `${field} is required`,
            code: 'VALIDATION_ERROR'
          }
        });
      }
      
      if (value) {
        switch (config.type) {
          case 'email':
            data[field] = sanitizeEmail(value);
            break;
          case 'string':
            data[field] = sanitizeString(value, config.maxLength);
            break;
          case 'filename':
            data[field] = sanitizeFilename(value);
            break;
          case 'search':
            data[field] = sanitizeSearchQuery(value);
            break;
          case 'json':
            data[field] = sanitizeJSON(value);
            break;
          case 'phone':
            // Only allow digits, +, -, (, ), spaces
            data[field] = value.replace(/[^0-9+\-() ]/g, '');
            break;
        }
      }
    }
    
    next();
  };
}

module.exports = {
  sanitizeRequest,
  sanitizeEmail,
  sanitizeString,
  sanitizeJSON,
  sanitizeFilename,
  sanitizeSearchQuery,
  validateAndSanitizeInput,
  SANITIZATION_EXCLUSIONS,
  shouldExclude
};
