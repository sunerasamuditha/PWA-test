const StaffService = require('../services/staffService');
const { AppError } = require('../middleware/errorHandler');

class StaffController {
  /**
   * Get all staff with pagination and filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllStaff(req, res) {
    try {
      // Map camelCase sort fields to snake_case
      const sortFieldMap = {
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'fullName': 'full_name',
        'email': 'email',
        'staffRole': 'staff_role'
      };

      const requestedSortBy = req.query.sortBy || 'createdAt';
      const mappedSortBy = sortFieldMap[requestedSortBy] || 'created_at';

      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        search: req.query.search,
        staff_role: req.query.staff_role || req.query.role, // Support both parameter names
        sortBy: mappedSortBy,
        sortOrder: req.query.sortOrder || 'desc'
      };

      const result = await StaffService.getAllStaff(filters);

      res.status(200).json({
        success: true,
        message: 'Staff retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in getAllStaff:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get staff by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getStaffById(req, res) {
    try {
      const userId = parseInt(req.params.id);
      
      if (!userId || isNaN(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      const staff = await StaffService.getStaffById(userId);

      res.status(200).json({
        success: true,
        message: 'Staff retrieved successfully',
        data: staff
      });
    } catch (error) {
      console.error('Error in getStaffById:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Create new staff member
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createStaff(req, res) {
    try {
      const { userData, staffData } = req.body;

      if (!userData || !staffData) {
        throw new AppError('User data and staff data are required', 400);
      }

      // Validate required user fields
      const requiredUserFields = ['fullName', 'phoneNumber', 'email', 'password'];
      const missingUserFields = requiredUserFields.filter(field => !userData[field]);
      if (missingUserFields.length > 0) {
        throw new AppError(`Missing required user fields: ${missingUserFields.join(', ')}`, 400);
      }

      // Validate required staff fields
      if (!staffData.staff_role) {
        throw new AppError('Staff role is required', 400);
      }

      const staff = await StaffService.createStaff(userData, staffData);

      // Remove password from response
      const { password, passwordHash, ...responseData } = staff;

      res.status(201).json({
        success: true,
        message: 'Staff member created successfully',
        data: responseData
      });
    } catch (error) {
      console.error('Error in createStaff:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update staff member
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateStaff(req, res) {
    try {
      const userId = parseInt(req.params.id);
      const updateData = req.body;

      if (!userId || isNaN(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new AppError('Update data is required', 400);
      }

      const updatedStaff = await StaffService.updateStaff(userId, updateData);

      res.status(200).json({
        success: true,
        message: 'Staff member updated successfully',
        data: updatedStaff
      });
    } catch (error) {
      console.error('Error in updateStaff:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update staff permissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateStaffPermissions(req, res) {
    try {
      const userId = parseInt(req.params.id);
      const { permissions } = req.body;

      if (!userId || isNaN(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      if (!permissions) {
        throw new AppError('Permissions array is required', 400);
      }

      const result = await StaffService.updateStaffPermissions(userId, permissions);

      res.status(200).json({
        success: true,
        message: 'Staff permissions updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateStaffPermissions:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get current staff profile (for authenticated staff member)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCurrentStaffProfile(req, res) {
    try {
      const userId = req.user.id; // From auth middleware

      const staff = await StaffService.getStaffById(userId);

      res.status(200).json({
        success: true,
        message: 'Current staff profile retrieved successfully',
        data: staff
      });
    } catch (error) {
      console.error('Error in getCurrentStaffProfile:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update current staff profile (for authenticated staff member)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateCurrentStaffProfile(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const updateData = req.body;

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new AppError('Update data is required', 400);
      }

      // Remove sensitive fields that staff shouldn't be able to update themselves
      const { staff_role, permissions, ...allowedUpdateData } = updateData;

      const updatedStaff = await StaffService.updateStaff(userId, allowedUpdateData);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedStaff
      });
    } catch (error) {
      console.error('Error in updateCurrentStaffProfile:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get available permissions list
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAvailablePermissions(req, res) {
    try {
      const permissions = StaffService.ALLOWED_PERMISSIONS.map(permission => ({
        value: permission,
        label: permission.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      }));

      res.status(200).json({
        success: true,
        message: 'Available permissions retrieved successfully',
        data: permissions
      });
    } catch (error) {
      console.error('Error in getAvailablePermissions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = StaffController;