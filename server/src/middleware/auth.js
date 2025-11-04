const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');
const { AppError } = require('./errorHandler');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authentication middleware - verifies JWT access token
 * Attaches user object to req.user if token is valid
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    throw new AppError('Access token is required', 401);
  }

  // Verify the token
  const decoded = verifyAccessToken(token);

  // Get user from database to ensure they still exist and are active
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('User not found or account has been deactivated', 401);
  }

  // Sanitize user object by removing sensitive fields
  const sanitizedUser = {
    id: user.id,
    uuid: user.uuid,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    emergencyContact: user.emergencyContact,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // Attach sanitized user to request object
  req.user = sanitizedUser;
  next();
});

/**
 * Authorization middleware factory - checks if user has required role(s)
 * @param {...string} allowedRoles - Array of roles allowed to access the resource
 * @returns {function} Middleware function
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        `Access forbidden. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        403
      );
    }

    next();
  };
};

/**
 * Optional authentication middleware - attempts to authenticate but doesn't fail if no token
 * Useful for public endpoints that behave differently for authenticated users
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      // Try to verify token and get user
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently ignore authentication errors for optional auth
    // req.user will remain undefined
  }

  next();
});

/**
 * Role hierarchy checker - checks if user has sufficient role level
 * Role hierarchy: super_admin > admin > staff > partner > patient
 * @param {string} requiredRole - Minimum required role
 * @returns {function} Middleware function
 */
const requireMinimumRole = (requiredRole) => {
  const roleHierarchy = {
    patient: 1,
    partner: 2,
    staff: 3,
    admin: 4,
    super_admin: 5
  };

  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 999;

    if (userRoleLevel < requiredRoleLevel) {
      throw new AppError(
        `Insufficient permissions. Required minimum role: ${requiredRole}. Your role: ${req.user.role}`,
        403
      );
    }

    next();
  };
};

/**
 * Owner or admin middleware - allows access if user is the resource owner or has admin/super_admin role
 * @param {string} userIdParam - Name of the URL parameter containing the user ID (default: 'userId')
 * @returns {function} Middleware function
 */
const ownerOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const resourceUserId = parseInt(req.params[userIdParam]);
    const isOwner = req.user.id === resourceUserId;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new AppError('Access forbidden. You can only access your own resources or you need admin privileges', 403);
    }

    next();
  };
};

/**
 * Account status middleware - checks if user account is active
 */
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (!req.user.isActive) {
    throw new AppError('Account is deactivated. Please contact support', 403);
  }

  next();
};

/**
 * Token authentication middleware - alias for authenticate
 */
const authenticateToken = authenticate;

/**
 * Role requirement middleware - checks if user has one of the required roles
 * @param {Array<string>} allowedRoles - Array of roles allowed to access the resource
 * @returns {function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        `Access forbidden. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        403
      );
    }

    next();
  };
};

/**
 * Permission requirement middleware - checks if staff user has required permissions
 * @param {string|Array<string>} requiredPermissions - Permission or array of permissions required
 * @returns {function} Middleware function
 */
const requirePermission = (requiredPermissions) => {
  // Convert single permission to array for consistent handling
  const permissionsArray = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Super admins bypass all permission checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Admins have all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // For staff, check specific permissions
    if (req.user.role === 'staff') {
      // Get staff data to check permissions
      const Staff = require('../models/Staff');
      const staffData = await Staff.findByUserId(req.user.id);
      
      if (!staffData) {
        throw new AppError('Staff profile not found', 404);
      }

      // Check if staff has any of the required permissions
      const hasPermission = permissionsArray.some(permission => 
        staffData.permissions && staffData.permissions.includes(permission)
      );

      if (!hasPermission) {
        throw new AppError(
          `You do not have permission to perform this action. Required permission: ${permissionsArray.join(', ')}`,
          403
        );
      }

      // Attach permissions to req.user for use in controllers
      req.user.permissions = staffData.permissions || [];

      return next();
    }

    // Other roles don't have granular permissions
    throw new AppError('Insufficient permissions', 403);
  });
};

/**
 * Combined authorization - allows access if user has specific roles OR specific permissions
 * Useful for routes that should be accessible to admins OR staff with specific permissions
 * @param {Array<string>} allowedRoles - Roles allowed (e.g., ['admin', 'super_admin'])
 * @param {string|Array<string>} allowedPermissions - Permissions allowed (e.g., 'manage_users')
 * @returns {function} Middleware function
 */
const authorizeRoleOrPermission = (allowedRoles, allowedPermissions) => {
  const permissionsArray = Array.isArray(allowedPermissions) 
    ? allowedPermissions 
    : [allowedPermissions];

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Super admins bypass all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has one of the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // If not, check if staff with required permissions
    if (req.user.role === 'staff') {
      const Staff = require('../models/Staff');
      const staffData = await Staff.findByUserId(req.user.id);
      
      if (!staffData) {
        throw new AppError('Staff profile not found', 404);
      }

      // Check if staff has any of the required permissions
      const hasPermission = permissionsArray.some(permission => 
        staffData.permissions && staffData.permissions.includes(permission)
      );

      if (hasPermission) {
        // Attach permissions to req.user for use in controllers
        req.user.permissions = staffData.permissions || [];
        return next();
      }
    }

    // Neither role nor permission matched
    throw new AppError(
      `Access forbidden. Required roles: ${allowedRoles.join(', ')} OR permission: ${permissionsArray.join(', ')}`,
      403
    );
  });
};

module.exports = {
  authenticate,
  authenticateToken,
  authorize,
  requireRole,
  requirePermission,
  authorizeRoleOrPermission,
  optionalAuth,
  requireMinimumRole,
  ownerOrAdmin,
  requireActiveAccount
};