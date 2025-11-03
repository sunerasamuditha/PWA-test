const { AccountsPayable, PAYABLE_STATUSES } = require('../models/AccountsPayable');
const { ExternalEntity } = require('../models/ExternalEntity');
const { AppError } = require('../middleware/errorHandler');

class AccountsPayableService {
  /**
   * Create new accounts payable
   * @param {object} payableData - Payable data
   * @param {number} createdBy - User ID creating the payable
   * @returns {Promise<object>} Created payable
   */
  static async createPayable(payableData, createdBy) {
    try {
      const { entity_id, reference_code, description, total_amount, due_date, notes } = payableData;

      // Validate required fields
      if (!entity_id) {
        throw new AppError('Entity ID is required', 400);
      }

      if (!total_amount || total_amount <= 0) {
        throw new AppError('Total amount must be greater than 0', 400);
      }

      if (!due_date) {
        throw new AppError('Due date is required', 400);
      }

      // Validate entity exists
      const entity = await ExternalEntity.findById(entity_id);
      if (!entity) {
        throw new AppError('External entity not found', 404);
      }

      // Create payable
      const payable = await AccountsPayable.create({
        entity_id,
        reference_code,
        description,
        total_amount,
        due_date,
        notes
      });

      return payable;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create payable: ${error.message}`, 500);
    }
  }

  /**
   * Get payables by entity ID
   * @param {number} entityId - Entity ID
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated payables
   */
  static async getPayablesByEntity(entityId, filters) {
    try {
      // Validate entity exists
      const entity = await ExternalEntity.findById(entityId);
      if (!entity) {
        throw new AppError('External entity not found', 404);
      }

      return await AccountsPayable.findByEntityId(entityId, filters);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch payables by entity: ${error.message}`, 500);
    }
  }

  /**
   * Get payable by ID
   * @param {number} payableId - Payable ID
   * @param {number} requesterId - Requester user ID
   * @param {string} requesterRole - Requester role
   * @param {Array} requesterPermissions - Requester permissions
   * @returns {Promise<object>} Payable details
   */
  static async getPayableById(payableId, requesterId, requesterRole, requesterPermissions) {
    try {
      // Validate access control
      if (!['admin', 'super_admin'].includes(requesterRole) && 
          !requesterPermissions.includes('manage_users')) {
        throw new AppError('Insufficient permissions to view payables', 403);
      }

      const payable = await AccountsPayable.findById(payableId);

      if (!payable) {
        throw new AppError('Payable not found', 404);
      }

      return payable;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch payable: ${error.message}`, 500);
    }
  }

  /**
   * Update payable
   * @param {number} payableId - Payable ID
   * @param {object} updateData - Update data
   * @param {number} updatedBy - User ID updating the payable
   * @returns {Promise<object>} Updated payable
   */
  static async updatePayable(payableId, updateData, updatedBy) {
    try {
      // Check if payable exists
      const existingPayable = await AccountsPayable.findById(payableId);
      if (!existingPayable) {
        throw new AppError('Payable not found', 404);
      }

      // Validate status transition if status is being updated
      if (updateData.status) {
        this._validateStatusTransition(existingPayable.status, updateData.status);
      }

      const updatedPayable = await AccountsPayable.updateById(payableId, updateData);

      return updatedPayable;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update payable: ${error.message}`, 500);
    }
  }

  /**
   * Mark payable as paid
   * @param {number} payableId - Payable ID
   * @param {string} paidDate - Paid date
   * @param {string} paymentMethod - Payment method
   * @param {string} notes - Optional notes
   * @param {number} paidBy - User ID marking as paid
   * @returns {Promise<object>} Updated payable
   */
  static async markAsPaid(payableId, paidDate, paymentMethod, notes, paidBy) {
    try {
      // Check if payable exists
      const existingPayable = await AccountsPayable.findById(payableId);
      if (!existingPayable) {
        throw new AppError('Payable not found', 404);
      }

      // Check if already paid
      if (existingPayable.status === 'paid') {
        throw new AppError('Payable is already marked as paid', 400);
      }

      // Validate paid date is not in future
      const paidDateObj = new Date(paidDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (paidDateObj > today) {
        throw new AppError('Paid date cannot be in the future', 400);
      }

      const updatedPayable = await AccountsPayable.markAsPaid(
        payableId,
        paidDate,
        paymentMethod,
        notes
      );

      return updatedPayable;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to mark payable as paid: ${error.message}`, 500);
    }
  }

  /**
   * Get all payables with filters
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated payables
   */
  static async getAllPayables(filters) {
    try {
      // Update overdue status before fetching
      await AccountsPayable.updateOverdueStatus();

      return await AccountsPayable.findAll(filters);
    } catch (error) {
      throw new AppError(`Failed to fetch payables: ${error.message}`, 500);
    }
  }

  /**
   * Get overdue payables
   * @returns {Promise<Array>} Array of overdue payables
   */
  static async getOverduePayables() {
    try {
      // Update overdue status first
      await AccountsPayable.updateOverdueStatus();

      return await AccountsPayable.getOverduePayables();
    } catch (error) {
      throw new AppError(`Failed to fetch overdue payables: ${error.message}`, 500);
    }
  }

  /**
   * Get payables due soon
   * @param {number} daysAhead - Number of days to look ahead
   * @returns {Promise<Array>} Array of payables due soon
   */
  static async getDueSoonPayables(daysAhead = 7) {
    try {
      return await AccountsPayable.getDueSoonPayables(daysAhead);
    } catch (error) {
      throw new AppError(`Failed to fetch due soon payables: ${error.message}`, 500);
    }
  }

  /**
   * Get payable statistics
   * @returns {Promise<object>} Statistics
   */
  static async getPayableStats() {
    try {
      // Update overdue status first
      await AccountsPayable.updateOverdueStatus();

      return await AccountsPayable.getPayableStats();
    } catch (error) {
      throw new AppError(`Failed to fetch payable statistics: ${error.message}`, 500);
    }
  }

  /**
   * Get monthly payables by entity
   * @param {number} entityId - Entity ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Array>} Array of payables
   */
  static async getMonthlyPayablesByEntity(entityId, year, month) {
    try {
      // Validate entity exists
      const entity = await ExternalEntity.findById(entityId);
      if (!entity) {
        throw new AppError('External entity not found', 404);
      }

      // Create date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const result = await AccountsPayable.findByEntityId(entityId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 100
      });

      return result.payables;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch monthly payables: ${error.message}`, 500);
    }
  }

  /**
   * Validate status transition
   * @private
   */
  static _validateStatusTransition(currentStatus, newStatus) {
    if (!PAYABLE_STATUSES.includes(newStatus)) {
      throw new AppError(`Invalid status. Must be one of: ${PAYABLE_STATUSES.join(', ')}`, 400);
    }

    // Invalid transitions - paid cannot go back to any status
    if (currentStatus === 'paid' && newStatus === 'due') {
      throw new AppError('Cannot change status from paid to due', 400);
    }

    if (currentStatus === 'paid' && newStatus === 'overdue') {
      throw new AppError('Cannot change status from paid to overdue', 400);
    }

    // Overdue cannot be manually changed to due (overdue is auto-managed)
    if (currentStatus === 'overdue' && newStatus === 'due') {
      throw new AppError('Cannot change status from overdue to due. Overdue status is automatically managed.', 400);
    }

    // Due to overdue should not be manual (auto-updated via updateOverdueStatus)
    if (currentStatus === 'due' && newStatus === 'overdue') {
      throw new AppError('Cannot manually change status from due to overdue. This is automatically managed by the system.', 400);
    }
  }
}

module.exports = AccountsPayableService;
