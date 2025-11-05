const { Service, SERVICE_CATEGORIES } = require('../models/Service');
const { executeQuery } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class ServiceService {
  /**
   * Get all services with filters
   */
  async getAllServices(filters = {}) {
    try {
      return await Service.findAll(filters);
    } catch (error) {
      throw new AppError('Failed to fetch services', 500, error);
    }
  }

  /**
   * Get active services
   */
  async getActiveServices(category = null) {
    try {
      return await Service.getActiveServices(category);
    } catch (error) {
      throw new AppError('Failed to fetch active services', 500, error);
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      
      if (!service) {
        throw new AppError('Service not found', 404);
      }

      return service;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch service', 500, error);
    }
  }

  /**
   * Create new service
   */
  async createService(serviceData, createdBy) {
    try {
      // Validate service category
      if (!SERVICE_CATEGORIES.includes(serviceData.service_category)) {
        throw new AppError(
          `Invalid service category. Must be one of: ${SERVICE_CATEGORIES.join(', ')}`,
          400
        );
      }

      // Validate price
      const price = parseFloat(serviceData.price);
      if (isNaN(price) || price <= 0) {
        throw new AppError('Price must be a positive number', 400);
      }

      // Validate price decimal places (max 2)
      if (!/^\d+(\.\d{1,2})?$/.test(serviceData.price.toString())) {
        throw new AppError('Price can have maximum 2 decimal places', 400);
      }

      const service = await Service.create({
        ...serviceData,
        price: price
      });

      return service;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create service', 500, error);
    }
  }

  /**
   * Update service
   */
  async updateService(serviceId, updateData, updatedBy) {
    try {
      // Check if service exists
      const existingService = await Service.findById(serviceId);
      if (!existingService) {
        throw new AppError('Service not found', 404);
      }

      // Validate service category if provided
      if (updateData.service_category && !SERVICE_CATEGORIES.includes(updateData.service_category)) {
        throw new AppError(
          `Invalid service category. Must be one of: ${SERVICE_CATEGORIES.join(', ')}`,
          400
        );
      }

      // Validate price if provided
      if (updateData.price !== undefined) {
        const price = parseFloat(updateData.price);
        if (isNaN(price) || price <= 0) {
          throw new AppError('Price must be a positive number', 400);
        }
        
        if (!/^\d+(\.\d{1,2})?$/.test(updateData.price.toString())) {
          throw new AppError('Price can have maximum 2 decimal places', 400);
        }
        
        updateData.price = price;
      }

      const updatedService = await Service.updateById(serviceId, updateData);
      return updatedService;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update service', 500, error);
    }
  }

  /**
   * Deactivate service (soft delete)
   */
  async deactivateService(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new AppError('Service not found', 404);
      }

      return await Service.updateById(serviceId, { is_active: false });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to deactivate service', 500, error);
    }
  }

  /**
   * Reactivate service
   */
  async reactivateService(serviceId) {
    try {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new AppError('Service not found', 404);
      }

      return await Service.updateById(serviceId, { is_active: true });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to reactivate service', 500, error);
    }
  }

  /**
   * Get service statistics
   */
  async getServiceStats() {
    try {
      const categoryCounts = await Service.countByCategory();
      
      // Get total and active counts with explicit count queries
      const totalResult = await executeQuery('SELECT COUNT(*) as total FROM Services');
      const activeResult = await executeQuery('SELECT COUNT(*) as total FROM Services WHERE is_active = 1');

      // Calculate average price by category in one query
      const avgPriceData = await Service.getAveragePriceByCategory();
      
      // Convert to object for easier access
      const avgPriceByCategory = {};
      avgPriceData.forEach(item => {
        avgPriceByCategory[item.category] = item.averagePrice;
      });

      // Ensure all categories are present
      SERVICE_CATEGORIES.forEach(cat => {
        if (avgPriceByCategory[cat] === undefined) {
          avgPriceByCategory[cat] = 0;
        }
      });

      // Transform categoryCounts to match frontend expectations: {category, count, avgPrice}
      const servicesByCategory = categoryCounts.map(row => ({
        category: row.service_category,
        count: row.count,
        avgPrice: avgPriceByCategory[row.service_category] || 0
      }));

      return {
        totalServices: totalResult[0].total || 0,
        activeServices: activeResult[0].total || 0,
        servicesByCategory: servicesByCategory,
        averagePriceByCategory: avgPriceByCategory
      };
    } catch (error) {
      throw new AppError('Failed to fetch service statistics', 500, error);
    }
  }
}

module.exports = new ServiceService();
