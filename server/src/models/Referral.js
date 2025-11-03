const { executeQuery } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

class Referral {
  /**
   * Create a new referral
   * @param {Object} referralData - Referral data
   * @param {Object} connection - Optional database connection for transactions
   * @returns {Object} Created referral object
   */
  static async create(referralData, connection = null) {
    try {
      const { partner_user_id, patient_user_id, commission_amount = 10.00 } = referralData;
      
      const query = `
        INSERT INTO Referrals (partner_user_id, patient_user_id, commission_amount, referred_at)
        VALUES (?, ?, ?, NOW())
      `;
      
      const result = await executeQuery(query, [partner_user_id, patient_user_id, commission_amount], connection);
      
      // Return the created referral
      const selectQuery = `
        SELECT 
          r.id,
          r.partner_user_id,
          r.patient_user_id,
          r.commission_amount,
          r.referred_at,
          pu.full_name as partner_name,
          pu.email as partner_email,
          pau.full_name as patient_name,
          pau.email as patient_email
        FROM Referrals r
        LEFT JOIN Users pu ON r.partner_user_id = pu.id
        LEFT JOIN Users pau ON r.patient_user_id = pau.id
        WHERE r.id = ?
      `;
      
      const referrals = await executeQuery(selectQuery, [result.insertId], connection);
      
      return this._transformReferral(referrals[0]);
    } catch (error) {
      // Handle duplicate entry error (unique constraint on partner_user_id + patient_user_id)
      if (error.code === 'ER_DUP_ENTRY') {
        throw new AppError('Referral already exists', 409);
      }
      
      console.error('Error creating referral:', error);
      throw error;
    }
  }

  /**
   * Find referrals by partner ID
   * @param {number} partnerUserId - Partner user ID
   * @param {Object} filters - Filter options
   * @returns {Object} Referrals list with pagination info
   */
  static async findByPartnerId(partnerUserId, filters = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        startDate = null, 
        endDate = null,
        sortBy = 'referred_at', 
        sortOrder = 'desc' 
      } = filters;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      const whereConditions = ['r.partner_user_id = ?'];
      const queryParams = [partnerUserId];
      
      if (startDate) {
        whereConditions.push('r.referred_at >= ?');
        queryParams.push(startDate);
      }
      
      if (endDate) {
        whereConditions.push('r.referred_at <= ?');
        queryParams.push(endDate);
      }
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      // Validate sort column
      const allowedSortColumns = ['referred_at', 'commission_amount', 'patient_name'];
      const sortMapping = {
        'referred_at': 'r.referred_at',
        'commission_amount': 'r.commission_amount',
        'patient_name': 'u.full_name'
      };
      const validSortBy = sortMapping[allowedSortColumns.includes(sortBy) ? sortBy : 'referred_at'];
      const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // Get referrals
      const referralsQuery = `
        SELECT 
          r.id,
          r.partner_user_id,
          r.patient_user_id,
          r.commission_amount,
          r.referred_at,
          u.full_name as patient_name,
          u.email as patient_email
        FROM Referrals r
        LEFT JOIN Users u ON r.patient_user_id = u.id
        ${whereClause}
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const referrals = await executeQuery(referralsQuery, [...queryParams, limit, offset]);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM Referrals r
        ${whereClause}
      `;
      
      const countResult = await executeQuery(countQuery, queryParams);
      const totalCount = countResult[0].total;
      
      return {
        referrals: referrals.map(referral => this._transformReferral(referral)),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit
        }
      };
    } catch (error) {
      console.error('Error finding referrals by partner ID:', error);
      throw error;
    }
  }

  /**
   * Find referral by patient ID
   * @param {number} patientUserId - Patient user ID
   * @returns {Object|null} Referral object or null if not found
   */
  static async findByPatientId(patientUserId) {
    try {
      const query = `
        SELECT 
          r.id,
          r.partner_user_id,
          r.patient_user_id,
          r.commission_amount,
          r.referred_at,
          u.full_name as partner_name,
          u.email as partner_email
        FROM Referrals r
        LEFT JOIN Users u ON r.partner_user_id = u.id
        WHERE r.patient_user_id = ?
      `;
      
      const results = await executeQuery(query, [patientUserId]);
      
      if (results.length === 0) {
        return null;
      }
      
      return this._transformReferral(results[0]);
    } catch (error) {
      console.error('Error finding referral by patient ID:', error);
      throw error;
    }
  }

  /**
   * Count referrals by partner
   * @param {number} partnerUserId - Partner user ID
   * @returns {number} Total count of referrals
   */
  static async countReferralsByPartner(partnerUserId) {
    try {
      const query = `
        SELECT COUNT(*) as total
        FROM Referrals
        WHERE partner_user_id = ?
      `;
      
      const results = await executeQuery(query, [partnerUserId]);
      return results[0].total;
    } catch (error) {
      console.error('Error counting referrals by partner:', error);
      throw error;
    }
  }

  /**
   * Get total commission by partner
   * @param {number} partnerUserId - Partner user ID
   * @returns {number} Total commission amount
   */
  static async getTotalCommissionByPartner(partnerUserId) {
    try {
      const query = `
        SELECT COALESCE(SUM(commission_amount), 0) as total
        FROM Referrals
        WHERE partner_user_id = ?
      `;
      
      const results = await executeQuery(query, [partnerUserId]);
      return parseFloat(results[0].total || 0);
    } catch (error) {
      console.error('Error getting total commission by partner:', error);
      throw error;
    }
  }

  /**
   * Transform database referral object to camelCase
   * @param {Object} dbReferral - Database referral object
   * @returns {Object} Transformed referral object
   */
  static _transformReferral(dbReferral) {
    if (!dbReferral) return null;
    
    return {
      id: dbReferral.id,
      partnerUserId: dbReferral.partner_user_id,
      patientUserId: dbReferral.patient_user_id,
      commissionAmount: parseFloat(dbReferral.commission_amount || 0),
      referredAt: dbReferral.referred_at,
      // Include user data if present
      partnerName: dbReferral.partner_name,
      partnerEmail: dbReferral.partner_email,
      patientName: dbReferral.patient_name,
      patientEmail: dbReferral.patient_email
    };
  }
}

module.exports = Referral;