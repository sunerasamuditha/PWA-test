const asyncHandler = require('../utils/asyncHandler');
const AuthService = require('../services/authService');

/**
 * Login user
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await AuthService.login(email, password);

  // Set user in res.locals for audit middleware
  res.locals.user = result.user;

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      user: {
        id: result.user.id,
        uuid: result.user.uuid,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role
      }
    }
  });
});

/**
 * Register new user
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role, referredBy } = req.body;

  // Validate role (only patient and partner allowed for public registration)
  const allowedRoles = ['patient', 'partner'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Only patient and partner roles are allowed for registration.'
    });
  }

  const userData = {
    fullName,
    email,
    password,
    role,
    phoneNumber: req.body.phoneNumber,
    dateOfBirth: req.body.dateOfBirth,
    address: req.body.address,
    emergencyContact: req.body.emergencyContact
  };

  // Include partner-specific fields if role is partner
  if (role === 'partner') {
    userData.partnerType = req.body.partnerType;
    userData.companyName = req.body.companyName;
    userData.businessLicense = req.body.businessLicense;
    // Note: address is already included above, used for both patient and partner
  }

  // Include patient-specific fields if role is patient
  if (role === 'patient') {
    userData.passportInfo = req.body.passportInfo;
    userData.insuranceInfo = req.body.insuranceInfo;
    userData.currentAddress = req.body.currentAddress;
  }

  const result = await AuthService.register(userData, referredBy);

  // Set user in res.locals for audit middleware
  res.locals.user = result.user;

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      accessToken: result.accessToken,
      user: {
        id: result.user.id,
        uuid: result.user.uuid,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role
      }
    }
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await AuthService.logout(userId);

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refresh = asyncHandler(async (req, res) => {
  // Try to get refresh token from cookie first, then from body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token not provided'
    });
  }

  const result = await AuthService.refreshAccessToken(refreshToken);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      accessToken: result.accessToken
    }
  });
});

/**
 * Get current user info
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await AuthService.getUserProfile(userId);

  // Build response user object
  const responseUser = {
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth,
    address: user.address,
    emergencyContact: user.emergencyContact,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // Include staff permissions if user is a staff member
  if (user.role === 'staff') {
    try {
      const Staff = require('../models/Staff');
      const staffData = await Staff.findByUserId(userId);
      if (staffData) {
        responseUser.permissions = staffData.permissions || [];
      }
    } catch (error) {
      console.error('Error fetching staff permissions:', error);
      responseUser.permissions = [];
    }
  }

  res.status(200).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: {
      user: responseUser
    }
  });
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Capture before state
  const beforeUser = await AuthService.getUserById(userId);
  res.locals.beforeData = beforeUser;
  
  const updateData = req.body;

  const updatedUser = await AuthService.updateUserProfile(userId, updateData);

  // Capture after state
  res.locals.afterData = updatedUser;

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser.id,
        uuid: updatedUser.uuid,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        phoneNumber: updatedUser.phoneNumber,
        dateOfBirth: updatedUser.dateOfBirth,
        address: updatedUser.address,
        emergencyContact: updatedUser.emergencyContact,
        updatedAt: updatedUser.updatedAt
      }
    }
  });
});

/**
 * Change password
 * PUT /api/auth/password
 */
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  await AuthService.changePassword(userId, currentPassword, newPassword);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

module.exports = {
  login,
  register,
  logout,
  refresh,
  getMe,
  updateProfile,
  changePassword
};