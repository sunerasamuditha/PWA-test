const pool = require('../config/database');

class PushSubscription {
  /**
   * Create a new push subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Created subscription
   */
  static async create(subscriptionData) {
    const { user_id, endpoint, p256dh_key, auth_key, user_agent } = subscriptionData;

    const [result] = await pool.execute(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, endpoint, p256dh_key, auth_key, user_agent || null]
    );

    return this.findById(result.insertId);
  }

  /**
   * Find subscription by ID
   * @param {number} id - Subscription ID
   * @returns {Promise<Object|null>} Subscription or null
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM push_subscriptions WHERE id = ?`,
      [id]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find all subscriptions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of subscriptions
   */
  static async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM push_subscriptions 
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows;
  }

  /**
   * Find subscription by endpoint
   * @param {string} endpoint - Subscription endpoint
   * @returns {Promise<Object|null>} Subscription or null
   */
  static async findByEndpoint(endpoint) {
    const [rows] = await pool.execute(
      `SELECT * FROM push_subscriptions WHERE endpoint = ?`,
      [endpoint]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update subscription
   * @param {number} id - Subscription ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated subscription
   */
  static async update(id, updates) {
    const allowedFields = ['p256dh_key', 'auth_key', 'user_agent', 'is_active'];
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE push_subscriptions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  /**
   * Deactivate subscription
   * @param {number} id - Subscription ID
   * @returns {Promise<boolean>} Success status
   */
  static async deactivate(id) {
    const [result] = await pool.execute(
      `UPDATE push_subscriptions SET is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Deactivate subscription by endpoint
   * @param {string} endpoint - Subscription endpoint
   * @returns {Promise<boolean>} Success status
   */
  static async deactivateByEndpoint(endpoint) {
    const [result] = await pool.execute(
      `UPDATE push_subscriptions SET is_active = 0, updated_at = NOW() WHERE endpoint = ?`,
      [endpoint]
    );

    return result.affectedRows > 0;
  }

  /**
   * Deactivate all subscriptions for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of deactivated subscriptions
   */
  static async deactivateByUserId(userId) {
    const [result] = await pool.execute(
      `UPDATE push_subscriptions SET is_active = 0, updated_at = NOW() 
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    return result.affectedRows;
  }

  /**
   * Delete subscription permanently
   * @param {number} id - Subscription ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(id) {
    const [result] = await pool.execute(
      `DELETE FROM push_subscriptions WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Get all active subscriptions
   * @returns {Promise<Array>} Array of active subscriptions
   */
  static async findAllActive() {
    const [rows] = await pool.execute(
      `SELECT ps.*, u.email, u.role 
       FROM push_subscriptions ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.is_active = 1 AND u.is_active = 1
       ORDER BY ps.created_at DESC`
    );

    return rows;
  }

  /**
   * Get subscription count for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Number of active subscriptions
   */
  static async countByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM push_subscriptions 
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    return rows[0].count;
  }

  /**
   * Clean up old inactive subscriptions
   * @param {number} daysOld - Number of days (default 90)
   * @returns {Promise<number>} Number of deleted subscriptions
   */
  static async cleanupOld(daysOld = 90) {
    const [result] = await pool.execute(
      `DELETE FROM push_subscriptions 
       WHERE is_active = 0 AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysOld]
    );

    return result.affectedRows;
  }
}

module.exports = PushSubscription;
