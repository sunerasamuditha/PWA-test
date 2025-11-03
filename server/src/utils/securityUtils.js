// Security utility module with helper functions
const crypto = require('crypto');

/**
 * Generate cryptographically secure random token
 * @param {number} length - Length in bytes (default 32)
 * @returns {string} Hex-encoded token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create SHA-256 hash of data for integrity verification
 * @param {string} data - Data to hash
 * @returns {string} Hex-encoded hash
 */
function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
function constantTimeCompare(a, b) {
  if (!a || !b) return false;
  
  try {
    // Convert strings to buffers for timingSafeEqual
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    // Lengths must match for timingSafeEqual
    if (bufA.length !== bufB.length) return false;
    
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (error) {
    return false;
  }
}

/**
 * Sanitize data for logging - remove sensitive fields
 * @param {object} data - Data object to sanitize
 * @returns {object} Sanitized copy
 */
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveFields = [
    'password',
    'password_hash',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'jwt',
    'secret',
    'apiKey',
    'api_key'
  ];
  
  // Recursively remove sensitive fields
  const removeSensitive = (obj) => {
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (obj[key] && typeof obj[key] === 'object') {
        removeSensitive(obj[key]);
      }
    }
  };
  
  removeSensitive(sanitized);
  return sanitized;
}

/**
 * Mask sensitive data for display
 * @param {string} data - Data to mask
 * @param {string} type - Type of masking ('email', 'phone', 'passport', 'card')
 * @returns {string} Masked data
 */
function maskSensitiveData(data, type = 'default') {
  if (!data) return '';
  
  const str = String(data);
  
  switch (type) {
    case 'email':
      const [local, domain] = str.split('@');
      if (!domain) return str;
      return `${local.substring(0, 2)}***@${domain}`;
      
    case 'phone':
      return str.replace(/(\d{3})(\d{3})(\d{4})/, '***-***-$3');
      
    case 'passport':
      return str.length > 4 ? `****${str.slice(-4)}` : str;
      
    case 'card':
      return str.replace(/(\d{4})\s?(\d{4})\s?(\d{4})\s?(\d{4})/, '**** **** **** $4');
      
    default:
      return str.length > 4 ? `****${str.slice(-4)}` : '****';
  }
}

/**
 * Detect suspicious activity in request
 * @param {object} req - Express request object
 * @returns {object} Risk assessment with score and patterns
 */
function detectSuspiciousActivity(req) {
  const patterns = [];
  let riskScore = 0;
  
  // Check for SQL injection patterns
  const sqlPatterns = ['SELECT', 'UNION', 'DROP', 'INSERT', 'UPDATE', 'DELETE', '--', ';', '/*', '*/'];
  const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
  
  if (sqlPatterns.some(pattern => queryString.toUpperCase().includes(pattern))) {
    patterns.push('SQL_INJECTION_ATTEMPT');
    riskScore += 50;
  }
  
  // Check for XSS patterns
  const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload='];
  if (xssPatterns.some(pattern => queryString.toLowerCase().includes(pattern))) {
    patterns.push('XSS_ATTEMPT');
    riskScore += 50;
  }
  
  // Check for unusual user agent
  const userAgent = req.headers['user-agent'];
  if (!userAgent || userAgent.length < 10) {
    patterns.push('SUSPICIOUS_USER_AGENT');
    riskScore += 20;
  }
  
  // Check for path traversal
  if (queryString.includes('../') || queryString.includes('..\\')) {
    patterns.push('PATH_TRAVERSAL_ATTEMPT');
    riskScore += 40;
  }
  
  return {
    riskScore,
    patterns,
    isSuspicious: riskScore > 50
  };
}

/**
 * Validate IP address format
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IPv4 or IPv6
 */
function validateIPAddress(ip) {
  if (!ip) return false;
  
  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Extract real client IP from request
 * Handles proxy setups with X-Forwarded-For header
 * @param {object} req - Express request object
 * @returns {string} Client IP address
 */
function extractClientIP(req) {
  // Check X-Forwarded-For header (from proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take first IP in the chain
    const ips = forwarded.split(',');
    return ips[0].trim();
  }
  
  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback to req.ip
  return req.ip;
}

/**
 * Parse user agent to extract browser, OS, device
 * @param {string} userAgent - User agent string
 * @returns {object} Parsed information
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown'
    };
  }
  
  // Browser detection
  let browser = 'Unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) browser = 'Internet Explorer';
  
  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  // Device detection
  let device = 'Desktop';
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet';
  
  return { browser, os, device };
}

module.exports = {
  generateSecureToken,
  hashData,
  constantTimeCompare,
  sanitizeForLog,
  maskSensitiveData,
  detectSuspiciousActivity,
  validateIPAddress,
  extractClientIP,
  parseUserAgent
};
