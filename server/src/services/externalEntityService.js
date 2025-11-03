const { ExternalEntity, ENTITY_TYPES } = require('../models/ExternalEntity');
const { AccountsPayable } = require('../models/AccountsPayable');
const { AppError } = require('../middleware/errorHandler');

class ExternalEntityService {
  /**
   * Get all external entities with filters
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Paginated entities
   */
  static async getAllEntities(filters) {
    try {
      return await ExternalEntity.findAll(filters);
    } catch (error) {
      throw new AppError(`Failed to fetch external entities: ${error.message}`, 500);
    }
  }

  /**
   * Get entity by ID
   * @param {number} entityId - Entity ID
   * @returns {Promise<object>} Entity details
   */
  static async getEntityById(entityId) {
    try {
      const entity = await ExternalEntity.findById(entityId);

      if (!entity) {
        throw new AppError('External entity not found', 404);
      }

      return entity;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch entity: ${error.message}`, 500);
    }
  }

  /**
   * Create new external entity
   * @param {object} entityData - Entity data
   * @param {number} createdBy - User ID creating the entity
   * @returns {Promise<object>} Created entity
   */
  static async createEntity(entityData, createdBy) {
    try {
      const { name, type, contact_info = {} } = entityData;

      // Validate required fields
      if (!name || !name.trim()) {
        throw new AppError('Entity name is required', 400);
      }

      if (!type) {
        throw new AppError('Entity type is required', 400);
      }

      if (!ENTITY_TYPES.includes(type)) {
        throw new AppError(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`, 400);
      }

      // Validate contact_info structure
      this._validateContactInfoStructure(contact_info);

      const entity = await ExternalEntity.create({
        name: name.trim(),
        type,
        contact_info
      });

      return entity;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create entity: ${error.message}`, 500);
    }
  }

  /**
   * Update external entity
   * @param {number} entityId - Entity ID
   * @param {object} updateData - Update data
   * @param {number} updatedBy - User ID updating the entity
   * @returns {Promise<object>} Updated entity
   */
  static async updateEntity(entityId, updateData, updatedBy) {
    try {
      // Check if entity exists
      const existingEntity = await ExternalEntity.findById(entityId);
      if (!existingEntity) {
        throw new AppError('External entity not found', 404);
      }

      const { name, type, contact_info } = updateData;

      // Validate type if provided
      if (type && !ENTITY_TYPES.includes(type)) {
        throw new AppError(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`, 400);
      }

      // Validate contact_info structure if provided
      if (contact_info !== undefined) {
        this._validateContactInfoStructure(contact_info);
      }

      const cleanedData = {};
      if (name !== undefined) cleanedData.name = name.trim();
      if (type !== undefined) cleanedData.type = type;
      if (contact_info !== undefined) cleanedData.contact_info = contact_info;

      const updatedEntity = await ExternalEntity.updateById(entityId, cleanedData);

      return updatedEntity;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update entity: ${error.message}`, 500);
    }
  }

  /**
   * Delete external entity
   * @param {number} entityId - Entity ID
   * @param {number} deletedBy - User ID deleting the entity
   * @returns {Promise<boolean>} Success status
   */
  static async deleteEntity(entityId, deletedBy) {
    try {
      // Check if entity exists
      const entity = await ExternalEntity.findById(entityId);
      if (!entity) {
        throw new AppError('External entity not found', 404);
      }

      // Check for related accounts payable records
      const relatedPayables = await AccountsPayable.findByEntityId(entityId, { limit: 1 });
      
      if (relatedPayables.payables && relatedPayables.payables.length > 0) {
        throw new AppError(
          'Cannot delete entity with existing accounts payable records. Please delete or reassign payables first.',
          400
        );
      }

      const deleted = await ExternalEntity.deleteById(entityId);

      if (!deleted) {
        throw new AppError('Failed to delete entity', 500);
      }

      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete entity: ${error.message}`, 500);
    }
  }

  /**
   * Get entities by type
   * @param {string} type - Entity type
   * @returns {Promise<Array>} Array of entities
   */
  static async getEntitiesByType(type) {
    try {
      if (!ENTITY_TYPES.includes(type)) {
        throw new AppError(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`, 400);
      }

      return await ExternalEntity.getByType(type);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch entities by type: ${error.message}`, 500);
    }
  }

  /**
   * Search entities by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching entities
   */
  static async searchEntities(searchTerm) {
    try {
      if (!searchTerm || !searchTerm.trim()) {
        return [];
      }

      return await ExternalEntity.searchByName(searchTerm.trim());
    } catch (error) {
      throw new AppError(`Failed to search entities: ${error.message}`, 500);
    }
  }

  /**
   * Get entity statistics
   * @returns {Promise<object>} Statistics
   */
  static async getEntityStats() {
    try {
      const stats = {
        totalEntities: 0,
        byType: {}
      };

      // Initialize all types with 0
      for (const type of ENTITY_TYPES) {
        stats.byType[type] = 0;
      }

      // Get counts in a single query
      const counts = await ExternalEntity.getCountsByType();
      
      // Populate counts and calculate total
      for (const row of counts) {
        stats.byType[row.type] = row.count;
        stats.totalEntities += row.count;
      }

      return stats;
    } catch (error) {
      throw new AppError(`Failed to fetch entity statistics: ${error.message}`, 500);
    }
  }

  /**
   * Validate contact_info structure
   * @private
   */
  static _validateContactInfoStructure(contactInfo) {
    if (!contactInfo || typeof contactInfo !== 'object') {
      return; // Empty object is valid
    }

    const { phone, email, address, contact_person, billing_contact } = contactInfo;

    // Validate email format if provided
    if (email && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Invalid email format in contact_info', 400);
      }
    }

    // Validate nested objects
    if (address !== undefined && (address !== null && typeof address !== 'object')) {
      throw new AppError('contact_info.address must be an object', 400);
    }

    if (contact_person !== undefined && (contact_person !== null && typeof contact_person !== 'object')) {
      throw new AppError('contact_info.contact_person must be an object', 400);
    }

    if (billing_contact !== undefined && (billing_contact !== null && typeof billing_contact !== 'object')) {
      throw new AppError('contact_info.billing_contact must be an object', 400);
    }

    // Validate nested email fields
    if (contact_person && contact_person.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_person.email)) {
        throw new AppError('Invalid email format in contact_person', 400);
      }
    }

    if (billing_contact && billing_contact.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(billing_contact.email)) {
        throw new AppError('Invalid email format in billing_contact', 400);
      }
    }
  }
}

module.exports = ExternalEntityService;
