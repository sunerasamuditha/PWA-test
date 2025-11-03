const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { hashPassword } = require('../utils/password');
const { logAction } = require('../middleware/auditLog');

class UserService {
  /**
   * Get all users with pagination and filtering
   * @param {object} filters - Filter options
   * @param {number} filters.page - Page number (default: 1)
   * @param {number} filters.limit - Items per page (default: 10)
   * @param {string} filters.search - Search term for name/email
   * @param {string} filters.role - Filter by role
   * @param {boolean} filters.isActive - Filter by active status
   * @returns {object} Paginated users and total count
   */
  static async getAllUsers(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        isActive = null
      } = filters;

      const result = await User.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        search: search.trim(),
        role: role.trim(),
        isActive
      });

      // Remove password_hash from returned users
      const sanitizedUsers = result.users.map(user => {
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      return {
        users: sanitizedUsers,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit))
      };
    } catch (error) {
      throw new AppError(`Error fetching users: ${error.message}`, 500);
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {object} User object without password
   */
  static async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Remove password_hash from returned user
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Error fetching user: ${error.message}`, 500);
    }
  }

  /**
   * Create new user (admin operation - allows any role)
   * @param {object} userData - User data
   * @returns {object} Created user without password
   */
  static async createUser(userData) {
    try {
      const {
        fullName,
        email,
        password,
        role,
        phoneNumber = null,
        dateOfBirth = null,
        address = null,
        emergencyContact = null
      } = userData;

      // Validate role (admins can create users with any role)
      const validRoles = ['patient', 'partner', 'staff', 'admin', 'super_admin'];
      if (!validRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`, 400);
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase();

      // Check if email already exists (including inactive users)
      const existingUser = await User.findByEmailIncludeInactive(normalizedEmail);
      if (existingUser) {
        throw new AppError('Email already exists', 409);
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const newUser = await User.create({
        fullName,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        phoneNumber,
        dateOfBirth,
        address,
        emergencyContact
      });

      // Remove password_hash from returned user
      const { passwordHash, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY' || 
          error.message.includes('Email already exists') || 
          error.message.includes('Email address already exists')) {
        throw new AppError('Email already exists', 409);
      }
      throw new AppError(`Error creating user: ${error.message}`, 500);
    }
  }

  /**
   * Update user (admin operation)
   * @param {number} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {object} Updated user without password
   */
  static async updateUser(userId, updateData) {
    try {
      // Get user before update for audit log
      const userBefore = await User.findById(userId);
      if (!userBefore) {
        throw new AppError('User not found', 404);
      }

      // Validate role if being updated
      if (updateData.role) {
        const validRoles = ['patient', 'partner', 'staff', 'admin', 'super_admin'];
        if (!validRoles.includes(updateData.role)) {
          throw new AppError(`Invalid role: ${updateData.role}. Must be one of: ${validRoles.join(', ')}`, 400);
        }
      }

      // Check email uniqueness if being updated
      if (updateData.email && updateData.email.toLowerCase() !== userBefore.email.toLowerCase()) {
        const existingUser = await User.findByEmailIncludeInactive(updateData.email.toLowerCase());
        if (existingUser && existingUser.id !== parseInt(userId)) {
          throw new AppError('Email already exists', 409);
        }
        updateData.email = updateData.email.toLowerCase();
      }

      // Update user
      const updatedUser = await User.updateById(userId, updateData);

      // Remove password_hash from returned user
      const { passwordHash, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY' || 
          error.message.includes('Email already exists') || 
          error.message.includes('Email address already exists')) {
        throw new AppError('Email already exists', 409);
      }
      throw new AppError(`Error updating user: ${error.message}`, 500);
    }
  }

  /**
   * Deactivate user (soft delete)
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  static async deactivateUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (!user.isActive) {
        throw new AppError('User is already deactivated', 400);
      }

      await User.updateById(userId, { isActive: false });
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Error deactivating user: ${error.message}`, 500);
    }
  }

  /**
   * Reactivate user
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  static async reactivateUser(userId) {
    try {
      // Note: findById only returns active users, so we need a different method for deactivated users
      const user = await User.findByIdIncludeInactive(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.isActive) {
        throw new AppError('User is already active', 400);
      }

      await User.updateById(userId, { isActive: true });
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Error reactivating user: ${error.message}`, 500);
    }
  }

  /**
   * Search users by name or email
   * @param {string} searchTerm - Search term
   * @returns {array} Array of users matching search
   */
  static async searchUsers(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new AppError('Search term must be at least 2 characters', 400);
      }

      const users = await User.searchByNameOrEmail(searchTerm.trim());

      // Remove password_hash from returned users
      const sanitizedUsers = users.map(user => {
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      return sanitizedUsers;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Error searching users: ${error.message}`, 500);
    }
  }
}

module.exports = UserService;