const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const routes = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { sanitizeRequest } = require('./middleware/sanitization');
const { publicApiLimiter } = require('./middleware/rateLimiter');
const { requestLogger } = require('./middleware/requestLogger');

// Create Express application
const app = express();

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware stack (order matters)
// 1. CSP Nonce Generation - Generate nonce for each request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// 2. Helmet - Security headers with environment-based CSP
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    // Strict CSP for production (nonce-based, no unsafe-inline)
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`
      ],
      scriptSrc: [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`
      ],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'self'", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
  } : {
    // Relaxed CSP for development (allows unsafe-inline)
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'self'", "blob:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for PWA
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true, // X-Content-Type-Options: nosniff
  frameguard: {
    action: 'deny' // Prevent clickjacking
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Increased for document uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// 3. Sanitization - Clean input to prevent injection attacks
app.use(sanitizeRequest);

// 4. Request ID - Generate unique ID for request tracking
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// 5. Request logging - Log all requests with security details
app.use(requestLogger);

// 6. Rate limiting - Apply general rate limiting to all API routes
app.use('/api', publicApiLimiter);

// 7. API routes - Authentication and authorization applied at route level
app.use('/api', routes);

// Note: Static file serving for /uploads has been removed for security.
// Documents are now served through authenticated endpoints:
// - GET /api/documents/:id/download - for downloading files
// - GET /api/documents/:id/view - for inline preview
// This ensures proper access control and audit logging for all document access.

// Redirect old /uploads/* URLs to informative error page
app.get('/uploads/*', (req, res) => {
  res.status(410).json({
    status: 'error',
    error: {
      message: 'Direct file access has been disabled for security reasons. Please access documents through the application.',
      code: 'DIRECT_ACCESS_DISABLED',
      details: 'Documents are now served through authenticated endpoints. Please use the document management features in the application to view or download files.'
    }
  });
});

// 404 handler for undefined routes
app.use('*', notFound);

// Global error handling middleware
app.use(errorHandler);

// Export app for testing (without starting the server)
module.exports = app;
