const Staff = require('../models/Staff');
const User = require('../models/User');
const { executeTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcrypt');

class StaffService {
  // Define allowed permissions
  static ALLOWED_PERMISSIONS = [
    'manage_appointments',
    'process_payments',
    'view_reports',
    'manage_documents',
    'manage_users',
    'system_settings'
  ];

  /**
   * Get all staff with pagination and filters
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated staff list
   */
  static async getAllStaff(filters = {}) {
    try {
      const result = await Staff.getAllStaff(filters);
      
      // Remove password hashes from user data
      const sanitizedStaff = result.staff.map(staff => {
        const { passwordHash, ...sanitizedStaff } = staff;
        return sanitizedStaff;
      });
      
      return {
        staff: sanitizedStaff,
        pagination: result.pagination
      };
    } catch (error) {
      console.error('Error getting all staff:', error);
      throw error;
    }
  }

  /**
   * Get staff by user ID
   * @param {number} userId - User ID
   * @returns {Object} Complete staff profile
   */
  static async getStaffById(userId) {
    try {
      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Get staff data
      const staff = await Staff.findByUserId(userId);
      if (!staff) {
        throw new AppError('Staff profile not found', 404);
      }

      // Remove password hash
      const { passwordHash, ...sanitizedUser } = user;

      // Merge user and staff data
      return {
        ...sanitizedUser,
        staffRole: staff.staffRole,
        permissions: staff.permissions,
        staffCreatedAt: staff.createdAt,
        staffUpdatedAt: staff.updatedAt
      };
    } catch (error) {
      console.error('Error getting staff by ID:', error);
      throw error;
    }
  }

  /**
   * Create new staff member
   * @param {Object} userData - User data
   * @param {Object} staffData - Staff-specific data
   * @returns {Object} Created staff profile
   */
  static async createStaff(userData, staffData) {
    return await executeTransaction(async (connection) => {
      try {
        // Validate staff_role
        const validRoles = ['front_desk', 'back_office', 'admin'];
        if (!validRoles.includes(staffData.staff_role)) {
          throw new AppError('Invalid staff role. Must be front_desk, back_office, or admin', 400);
        }

        // Validate permissions
        if (staffData.permissions && Array.isArray(staffData.permissions)) {
          const invalidPermissions = staffData.permissions.filter(
            permission => !this.ALLOWED_PERMISSIONS.includes(permission)
          );
          if (invalidPermissions.length > 0) {
            throw new AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
          }
        }

        // Hash password
        if (!userData.password) {
          throw new AppError('Password is required', 400);
        }
        const passwordHash = await bcrypt.hash(userData.password, 10);

        // Create user record
        const userCreateData = {
          ...userData,
          passwordHash: passwordHash,
          role: 'staff'
        };
        delete userCreateData.password;
        
        const user = await User.create(userCreateData, connection);

        // Create staff record
        const staffCreateData = {
          user_id: user.id,
          staff_role: staffData.staff_role,
          permissions: staffData.permissions || []
        };

        const staff = await Staff.create(staffCreateData, connection);

        // Return complete staff profile
        return {
          ...user,
          staffRole: staff.staffRole,
          permissions: staff.permissions,
          staffCreatedAt: staff.createdAt,
          staffUpdatedAt: staff.updatedAt
        };
      } catch (error) {
        console.error('Error creating staff:', error);
        throw error;
      }
    });
  }

  /**
   * Update staff member
   * @param {number} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated staff profile
   */
  static async updateStaff(userId, updateData) {
    try {
      // Separate user fields from staff fields
      const userFields = {
        fullName: updateData.fullName,
        phoneNumber: updateData.phoneNumber,
        dateOfBirth: updateData.dateOfBirth,
        address: updateData.address,
        emergencyContact: updateData.emergencyContact
      };

      const staffFields = {
        staff_role: updateData.staff_role,
        permissions: updateData.permissions
      };

      // Remove undefined fields
      Object.keys(userFields).forEach(key => {
        if (userFields[key] === undefined) {
          delete userFields[key];
        }
      });

      Object.keys(staffFields).forEach(key => {
        if (staffFields[key] === undefined) {
          delete staffFields[key];
        }
      });

      // Validate staff_role if provided
      if (staffFields.staff_role) {
        const validRoles = ['front_desk', 'back_office', 'admin'];
        if (!validRoles.includes(staffFields.staff_role)) {
          throw new AppError('Invalid staff role. Must be front_desk, back_office, or admin', 400);
        }
      }

      // Validate permissions if provided
      if (staffFields.permissions && Array.isArray(staffFields.permissions)) {
        const invalidPermissions = staffFields.permissions.filter(
          permission => !this.ALLOWED_PERMISSIONS.includes(permission)
        );
        if (invalidPermissions.length > 0) {
          throw new AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
        }
      }

      // Update user data if there are user fields to update
      if (Object.keys(userFields).length > 0) {
        await User.updateById(userId, userFields);
      }

      // Update staff data if there are staff fields to update
      if (Object.keys(staffFields).length > 0) {
        await Staff.updateByUserId(userId, staffFields);
      }

      // Return updated staff profile
      return await this.getStaffById(userId);
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  /**
   * Update staff permissions
   * @param {number} userId - User ID
   * @param {Array} permissions - Permissions array
   * @returns {Object} Updated permissions
   */
  static async updateStaffPermissions(userId, permissions) {
    try {
      // Validate permissions
      if (!Array.isArray(permissions)) {
        throw new AppError('Permissions must be an array', 400);
      }

      const invalidPermissions = permissions.filter(
        permission => !this.ALLOWED_PERMISSIONS.includes(permission)
      );
      if (invalidPermissions.length > 0) {
        throw new AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
      }

      // Update staff permissions
      const updatedStaff = await Staff.updateByUserId(userId, { permissions });

      return {
        permissions: updatedStaff.permissions
      };
    } catch (error) {
      console.error('Error updating staff permissions:', error);
      throw error;
    }
  }
}

module.exports = StaffService;