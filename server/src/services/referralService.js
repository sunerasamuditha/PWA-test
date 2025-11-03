const Partner = require('../models/Partner');
const Referral = require('../models/Referral');
const User = require('../models/User');
const { calculateCommissionForReferral } = require('../utils/commission');
const { AppError } = require('../middleware/errorHandler');

class ReferralService {
  /**
   * Create a referral
   * @param {string} partnerUuid - Partner UUID
   * @param {number} patientUserId - Patient user ID
   * @param {Object} connection - Database connection for transactions
   * @returns {Object} Created referral
   */
  static async createReferral(partnerUuid, patientUserId, connection = null) {
    try {
      // Validate partner for referral
      const partnerUser = await this.validatePartnerForReferral(partnerUuid);
      
      // Calculate commission
      const commissionAmount = calculateCommissionForReferral();
      
      // Create referral record
      const referral = await Referral.create({
        partner_user_id: partnerUser.id,
        patient_user_id: patientUserId,
        commission_amount: commissionAmount
      }, connection);
      
      // Update partner's commission points (within same transaction)
      await Partner.updateCommissionPoints(partnerUser.id, commissionAmount, connection);
      
      return referral;
    } catch (error) {
      console.error('Error creating referral:', error);
      throw error;
    }
  }

  /**
   * Validate partner for referral
   * @param {string} partnerUuid - Partner UUID
   * @returns {Object} Partner user object
   */
  static async validatePartnerForReferral(partnerUuid) {
    try {
      // Find user by UUID
      const partnerUser = await User.findByUuid(partnerUuid);
      if (!partnerUser) {
        throw new AppError('Invalid referral code - partner not found', 400);
      }

      // Check if user has partner role
      if (partnerUser.role !== 'partner') {
        throw new AppError('Invalid referral code - user is not a partner', 400);
      }

      // Get partner details
      const partner = await Partner.findByUserId(partnerUser.id);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      // Check if partner is active
      if (partner.status !== 'active') {
        throw new AppError('Referral code is inactive', 400);
      }

      return partnerUser;
    } catch (error) {
      console.error('Error validating partner for referral:', error);
      throw error;
    }
  }

  /**
   * Get referral by patient
   * @param {number} patientUserId - Patient user ID
   * @returns {Object|null} Referral info or null
   */
  static async getReferralByPatient(patientUserId) {
    try {
      return await Referral.findByPatientId(patientUserId);
    } catch (error) {
      console.error('Error getting referral by patient:', error);
      throw error;
    }
  }

  /**
   * Check if referral already exists
   * @param {number} partnerUserId - Partner user ID
   * @param {number} patientUserId - Patient user ID
   * @returns {boolean} True if referral exists
   */
  static async referralExists(partnerUserId, patientUserId) {
    try {
      const existingReferral = await Referral.findByPatientId(patientUserId);
      return existingReferral && existingReferral.partnerUserId === partnerUserId;
    } catch (error) {
      console.error('Error checking referral existence:', error);
      return false;
    }
  }

  /**
   * Get partner referrals with pagination and filters
   * @param {number} partnerUserId - Partner user ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated referrals list
   */
  static async getPartnerReferrals(partnerUserId, options = {}) {
    try {
      const { page = 1, limit = 10, status, startDate, endDate } = options;
      
      const filters = {};
      if (status) {
        filters.status = status;
      }
      if (startDate) {
        filters.startDate = startDate;
      }
      if (endDate) {
        filters.endDate = endDate;
      }

      const referrals = await Referral.findByPartnerId(partnerUserId, page, limit, filters);
      const total = await Referral.countReferralsByPartner(partnerUserId, filters);

      return {
        referrals,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting partner referrals:', error);
      throw error;
    }
  }

  /**
   * Get partner referral statistics
   * @param {number} partnerUserId - Partner user ID
   * @returns {Object} Referral statistics
   */
  static async getPartnerReferralStats(partnerUserId) {
    try {
      const totalReferrals = await Referral.countReferralsByPartner(partnerUserId);
      const totalCommission = await Referral.getTotalCommissionByPartner(partnerUserId);

      return {
        totalReferrals,
        totalCommission,
        averageCommission: totalReferrals > 0 ? totalCommission / totalReferrals : 0
      };
    } catch (error) {
      console.error('Error getting partner referral stats:', error);
      throw error;
    }
  }

  /**
   * Get commission history with pagination and date filters
   * @param {number} partnerUserId - Partner user ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated commission history
   */
  static async getCommissionHistory(partnerUserId, options = {}) {
    try {
      const { page = 1, limit = 10, startDate, endDate } = options;
      
      const filters = { status: 'completed' }; // Only completed referrals for commission history
      if (startDate) {
        filters.startDate = startDate;
      }
      if (endDate) {
        filters.endDate = endDate;
      }

      const referrals = await Referral.findByPartnerId(partnerUserId, page, limit, filters);
      const total = await Referral.countReferralsByPartner(partnerUserId, filters);

      // Transform referrals to commission history format
      const commissionHistory = referrals.map(referral => ({
        id: referral.id,
        patientName: referral.patientName,
        patientEmail: referral.patientEmail,
        commissionAmount: referral.commissionAmount,
        referredAt: referral.referredAt,
        status: referral.status
      }));

      return {
        commissions: commissionHistory,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting commission history:', error);
      throw error;
    }
  }
}

module.exports = ReferralService;