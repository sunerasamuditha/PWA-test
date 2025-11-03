// Comprehensive request logging middleware for security monitoring
const { extractClientIP, sanitizeForLog } = require('../utils/securityUtils');

/**
 * Main request logger middleware
 * Logs all incoming requests with timing and response details
 */
function requestLogger(req, res, next) {
  const startTime = process.hrtime();
  const requestId = req.id;
  const ip = extractClientIP(req);
  const userAgent = req.headers['user-agent'];
  const userId = req.user?.id;
  
  // Log request
  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - IP: ${ip} - User: ${userId || 'anonymous'}`);
  
  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;
    
    // Calculate response time
    const diff = process.hrtime(startTime);
    const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    
    // Determine log level based on status code
    const statusCode = res.statusCode;
    let logLevel = 'info';
    if (statusCode >= 500) logLevel = 'error';
    else if (statusCode >= 400) logLevel = 'warn';
    
    // Log response
    const logMessage = `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - Status: ${statusCode} - ${responseTime}ms`;
    
    if (logLevel === 'error') {
      console.error(logMessage);
    } else if (logLevel === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Security-focused logger for security events
 * Logs failed logins, unauthorized access, rate limits, etc.
 */
function securityLogger(eventType, details, req) {
  const ip = req ? extractClientIP(req) : 'unknown';
  const userAgent = req ? req.headers['user-agent'] : 'unknown';
  const userId = req?.user?.id || 'anonymous';
  
  const securityLog = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY',
    event: eventType,
    ip,
    userAgent,
    userId,
    details: sanitizeForLog(details)
  };
  
  console.warn(`[SECURITY] ${eventType} - IP: ${ip} - User: ${userId}`, securityLog);
}

/**
 * Performance logger for slow requests
 * Logs requests that take longer than threshold
 */
function performanceLogger(req, responseTime, threshold = 1000) {
  if (responseTime > threshold) {
    const ip = extractClientIP(req);
    const userId = req.user?.id || 'anonymous';
    
    console.warn(`[PERFORMANCE] Slow request detected - ${req.method} ${req.path} - ${responseTime}ms - IP: ${ip} - User: ${userId}`);
  }
}

/**
 * Audit logger for audit-worthy actions
 * Complements auditLog.js middleware with real-time logging
 */
function auditLogger(action, entity, details, req) {
  const ip = extractClientIP(req);
  const userId = req.user?.id;
  
  const auditLog = {
    timestamp: new Date().toISOString(),
    type: 'AUDIT',
    action,
    entity,
    userId,
    ip,
    details: sanitizeForLog(details)
  };
  
  console.log(`[AUDIT] ${action} ${entity} - User: ${userId} - IP: ${ip}`, auditLog);
}

module.exports = {
  requestLogger,
  securityLogger,
  performanceLogger,
  auditLogger
};
