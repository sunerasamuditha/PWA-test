const AdminService = require('../services/adminService');
const { AppError } = require('../middleware/errorHandler');

class AdminController {
  /**
   * Get dashboard statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      const stats = await AdminService.getDashboardStats();

      res.status(200).json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
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
   * Get revenue analytics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRevenueAnalytics(req, res) {
    try {
      const period = req.query.period || 'month';
      
      // Validate period
      const validPeriods = ['week', 'month', 'quarter', 'year'];
      if (!validPeriods.includes(period)) {
        throw new AppError('Invalid period. Must be one of: week, month, quarter, year', 400);
      }

      const analytics = await AdminService.getRevenueAnalytics(period);

      res.status(200).json({
        success: true,
        message: 'Revenue analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error in getRevenueAnalytics:', error);
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
   * Get user activity analytics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserActivityAnalytics(req, res) {
    try {
      const period = req.query.period || 'month';
      
      // Validate period
      const validPeriods = ['week', 'month', 'quarter', 'year'];
      if (!validPeriods.includes(period)) {
        throw new AppError('Invalid period. Must be one of: week, month, quarter, year', 400);
      }

      const analytics = await AdminService.getUserActivityAnalytics(period);

      res.status(200).json({
        success: true,
        message: 'User activity analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      console.error('Error in getUserActivityAnalytics:', error);
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
   * Get recent activity
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRecentActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      
      // Validate limit
      if (limit < 1 || limit > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }

      const activities = await AdminService.getRecentActivity(limit);

      res.status(200).json({
        success: true,
        message: 'Recent activity retrieved successfully',
        data: activities
      });
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
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
   * Get system health metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSystemHealth(req, res) {
    try {
      const health = await AdminService.getSystemHealth();

      res.status(200).json({
        success: true,
        message: 'System health metrics retrieved successfully',
        data: health
      });
    } catch (error) {
      console.error('Error in getSystemHealth:', error);
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
   * Get comprehensive admin overview
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAdminOverview(req, res) {
    try {
      // Get all data in parallel for better performance
      const [dashboardStats, revenueAnalytics, userActivityAnalytics, systemHealth] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getRevenueAnalytics('month'),
        AdminService.getUserActivityAnalytics('month'),
        AdminService.getSystemHealth()
      ]);

      const overview = {
        dashboard: dashboardStats,
        revenue: revenueAnalytics,
        userActivity: userActivityAnalytics,
        systemHealth: systemHealth,
        lastUpdated: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        message: 'Admin overview retrieved successfully',
        data: overview
      });
    } catch (error) {
      console.error('Error in getAdminOverview:', error);
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
   * Export data for reporting
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async exportData(req, res) {
    try {
      const { type, format = 'json', period = 'month' } = req.query;

      if (!type) {
        throw new AppError('Export type is required', 400);
      }

      let data;
      let filename;

      switch (type) {
        case 'revenue':
          data = await AdminService.getRevenueAnalytics(period);
          filename = `revenue_analytics_${period}_${new Date().toISOString().split('T')[0]}`;
          break;
        
        case 'users':
          data = await AdminService.getUserActivityAnalytics(period);
          filename = `user_activity_${period}_${new Date().toISOString().split('T')[0]}`;
          break;
        
        case 'dashboard':
          data = await AdminService.getDashboardStats();
          filename = `dashboard_stats_${new Date().toISOString().split('T')[0]}`;
          break;
        
        default:
          throw new AppError('Invalid export type. Must be one of: revenue, users, dashboard', 400);
      }

      // Set appropriate headers based on format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        
        // Convert to CSV (simplified - in production, use a proper CSV library)
        const csv = this._convertToCSV(data);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json({
          success: true,
          message: 'Data exported successfully',
          data: data,
          exportInfo: {
            type,
            format,
            period,
            exportedAt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Error in exportData:', error);
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
   * Convert data to CSV format
   * @param {Object} data - Data to convert
   * @returns {string} CSV string
   */
  static _convertToCSV(data) {
    try {
      // This is a simplified CSV conversion
      // In production, use a proper CSV library like 'csv-writer' or 'fast-csv'
      
      if (data.data && Array.isArray(data.data)) {
        // Handle analytics data with array
        const headers = Object.keys(data.data[0] || {});
        const csvHeaders = headers.join(',');
        const csvRows = data.data.map(row => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        );
        return [csvHeaders, ...csvRows].join('\n');
      } else {
        // Handle object data (like dashboard stats)
        const flattenObject = (obj, prefix = '') => {
          let result = {};
          for (let key in obj) {
            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
              Object.assign(result, flattenObject(obj[key], prefix + key + '_'));
            } else {
              result[prefix + key] = obj[key];
            }
          }
          return result;
        };
        
        const flattened = flattenObject(data);
        const headers = Object.keys(flattened);
        const values = Object.values(flattened);
        
        return [
          headers.join(','),
          values.map(val => `"${val || ''}"`).join(',')
        ].join('\n');
      }
    } catch (error) {
      console.error('Error converting to CSV:', error);
      return 'Error converting data to CSV format';
    }
  }
}

module.exports = AdminController;