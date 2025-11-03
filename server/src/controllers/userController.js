const asyncHandler = require('../utils/asyncHandler');
const UserService = require('../services/userService');

/**
 * Get all users with pagination and filtering
 * GET /api/users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    role = '',
    isActive = null
  } = req.query;

  const filters = {
    page,
    limit,
    search,
    role,
    isActive: isActive === null ? null : isActive === 'true'
  };

  const result = await UserService.getAllUsers(filters);

  res.status(200).json({
    success: true,
    message: 'Users retrieved successfully',
    data: result
  });
});

/**
 * Get user by ID
 * GET /api/users/:userId
 */
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await UserService.getUserById(parseInt(userId));

  res.status(200).json({
    success: true,
    message: 'User retrieved successfully',
    data: {
      user
    }
  });
});

/**
 * Create new user (admin operation)
 * POST /api/users
 */
const createUser = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    phoneNumber,
    dateOfBirth,
    address,
    emergencyContact
  } = req.body;

  const userData = {
    fullName,
    email,
    password,
    role,
    phoneNumber: phoneNumber || null,
    dateOfBirth: dateOfBirth || null,
    address: address || null,
    emergencyContact: emergencyContact || null
  };

  const newUser = await UserService.createUser(userData);

  // Set user in res.locals for audit middleware
  res.locals.user = newUser;

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: newUser
    }
  });
});

/**
 * Update user (admin operation)
 * PUT /api/users/:userId
 */
const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.body;

  // Get user before update for audit log
  const userBefore = await UserService.getUserById(parseInt(userId));
  res.locals.userBefore = userBefore;

  const updatedUser = await UserService.updateUser(parseInt(userId), updateData);

  // Set user in res.locals for audit middleware
  res.locals.user = updatedUser;

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: {
      user: updatedUser
    }
  });
});

/**
 * Deactivate user (soft delete)
 * DELETE /api/users/:userId
 */
const deactivateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Get user before deactivation for audit log
  const user = await UserService.getUserById(parseInt(userId));
  res.locals.user = user;

  await UserService.deactivateUser(parseInt(userId));

  res.status(200).json({
    success: true,
    message: 'User deactivated successfully'
  });
});

/**
 * Reactivate user
 * POST /api/users/:userId/reactivate
 */
const reactivateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  await UserService.reactivateUser(parseInt(userId));

  // Get reactivated user for response
  const user = await UserService.getUserById(parseInt(userId));
  res.locals.user = user;

  res.status(200).json({
    success: true,
    message: 'User reactivated successfully',
    data: {
      user
    }
  });
});

/**
 * Search users by name or email
 * GET /api/users/search
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { q: searchTerm } = req.query;

  if (!searchTerm) {
    return res.status(400).json({
      success: false,
      message: 'Search term is required'
    });
  }

  const users = await UserService.searchUsers(searchTerm);

  res.status(200).json({
    success: true,
    message: 'Users searched successfully',
    data: {
      users
    }
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  searchUsers
};