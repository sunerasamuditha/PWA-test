const Partner = require('../models/Partner');
const Referral = require('../models/Referral');
const User = require('../models/User');
const { executeTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generatePartnerQRCode } = require('../utils/qrcode');
const { formatCommissionPoints } = require('../utils/commission');
const { generateTokens } = require('../utils/jwt');

class PartnerService {
  /**
   * Register a new partner
   * @param {Object} userData - User data
   * @param {Object} partnerData - Partner-specific data
   * @returns {Object} Registration result with user, partner, and tokens
   */
  static async registerPartner(userData, partnerData) {
    return await executeTransaction(async (connection) => {
      try {
        // Validate partner type
        const allowedTypes = ['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'];
        if (!allowedTypes.includes(partnerData.type)) {
          throw new AppError(`Invalid partner type. Must be one of: ${allowedTypes.join(', ')}`, 400);
        }

        // Create user first
        const newUser = await User.create({
          ...userData,
          role: 'partner'
        }, connection);

        // Create partner record
        const newPartner = await Partner.create({
          user_id: newUser.id,
          type: partnerData.type,
          status: 'pending',
          commission_points: 0.00
        }, connection);

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          uuid: newUser.uuid
        });

        // Remove password hash from response
        const { passwordHash, ...safeUser } = newUser;

        return {
          user: safeUser,
          partner: newPartner,
          tokens: {
            accessToken,
            refreshToken
          }
        };
      } catch (error) {
        console.error('Error in partner registration:', error);
        throw error;
      }
    });
  }

  /**
   * Get partner profile
   * @param {number} userId - User ID
   * @returns {Object} Complete partner profile
   */
  static async getPartnerProfile(userId) {
    try {
      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Get partner data
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      // Remove password hash
      const { passwordHash, ...safeUser } = user;

      // Return nested user/partner structure with camelCase fields
      return {
        user: safeUser,
        partner: {
          type: partner.type,
          status: partner.status,
          commissionPoints: partner.commissionPoints,
          createdAt: partner.createdAt,
          updatedAt: partner.updatedAt
        }
      };
    } catch (error) {
      console.error('Error getting partner profile:', error);
      throw error;
    }
  }

  /**
   * Update partner profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Updated data
   * @returns {Object} Updated partner profile
   */
  static async updatePartnerProfile(userId, updateData) {
    try {
      // Separate user fields from partner fields
      const userFields = {};
      const partnerFields = {};

      // User fields that can be updated
      const allowedUserFields = ['fullName', 'phoneNumber', 'dateOfBirth', 'address', 'emergencyContact'];
      allowedUserFields.forEach(field => {
        if (updateData[field] !== undefined) {
          userFields[field] = updateData[field];
        }
      });

      // Partner fields that can be updated
      if (updateData.type !== undefined) {
        const allowedTypes = ['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'];
        if (!allowedTypes.includes(updateData.type)) {
          throw new AppError(`Invalid partner type. Must be one of: ${allowedTypes.join(', ')}`, 400);
        }
        partnerFields.type = updateData.type;
      }

      // Update user data if there are user fields to update
      if (Object.keys(userFields).length > 0) {
        await User.update(userId, userFields);
      }

      // Update partner data if there are partner fields to update
      if (Object.keys(partnerFields).length > 0) {
        await Partner.updateByUserId(userId, partnerFields);
      }

      // Return updated profile
      return await this.getPartnerProfile(userId);
    } catch (error) {
      console.error('Error updating partner profile:', error);
      throw error;
    }
  }

  /**
   * Get partner referrals
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Referrals list with pagination
   */
  static async getPartnerReferrals(userId, filters = {}) {
    try {
      // Verify partner exists
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      return await Referral.findByPartnerId(userId, filters);
    } catch (error) {
      console.error('Error getting partner referrals:', error);
      throw error;
    }
  }

  /**
   * Get partner commission history
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Commission history with pagination
   */
  static async getCommissionHistory(userId, filters = {}) {
    try {
      // Verify partner exists
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      // Get referrals (which represent commission history)
      const result = await Referral.findByPartnerId(userId, filters);
      
      // Transform to commission history format
      const commissions = result.referrals.map(referral => ({
        id: referral.id,
        patientName: referral.patientName,
        patientEmail: referral.patientEmail,
        commissionAmount: referral.commissionAmount,
        referredAt: referral.referredAt
      }));

      return {
        commissions,
        pagination: result.pagination
      };
    } catch (error) {
      console.error('Error getting commission history:', error);
      throw error;
    }
  }

  /**
   * Get partner statistics
   * @param {number} userId - User ID
   * @returns {Object} Partner statistics
   */
  static async getPartnerStats(userId) {
    try {
      // Verify partner exists
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      // Get statistics
      const totalReferrals = await Referral.countReferralsByPartner(userId);
      const totalCommission = await Referral.getTotalCommissionByPartner(userId);

      return {
        totalReferrals,
        totalCommission,
        formattedCommission: formatCommissionPoints(totalCommission),
        status: partner.status,
        commissionPoints: partner.commissionPoints,
        isActive: partner.status === 'active'
      };
    } catch (error) {
      console.error('Error getting partner stats:', error);
      throw error;
    }
  }

  /**
   * Generate partner QR code
   * @param {number} userId - User ID
   * @returns {string} QR code data URL
   */
  static async generatePartnerQRCode(userId) {
    try {
      // Get partner data
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner profile not found', 404);
      }

      // Check if partner is active
      if (partner.status !== 'active') {
        throw new AppError('Only active partners can generate QR codes', 403);
      }

      // Get user UUID
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Generate QR code
      const qrCodeDataUrl = await generatePartnerQRCode(user.uuid);

      return {
        qrCode: qrCodeDataUrl,
        referralUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register?ref=${user.uuid}`,
        partnerUuid: user.uuid
      };
    } catch (error) {
      console.error('Error generating partner QR code:', error);
      throw error;
    }
  }

  /**
   * Get all partners (admin function)
   * @param {Object} filters - Filter options
   * @returns {Object} Partners list with pagination
   */
  static async getAllPartners(filters = {}) {
    try {
      return await Partner.getAllPartners(filters);
    } catch (error) {
      console.error('Error getting all partners:', error);
      throw error;
    }
  }

  /**
   * Update partner status (admin function)
   * @param {number} userId - User ID
   * @param {string} newStatus - New status
   * @returns {Object} Updated partner
   */
  static async updatePartnerStatus(userId, newStatus) {
    try {
      // Validate status
      const allowedStatuses = ['pending', 'active', 'inactive'];
      if (!allowedStatuses.includes(newStatus)) {
        throw new AppError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`, 400);
      }

      // Verify partner exists
      const partner = await Partner.findByUserId(userId);
      if (!partner) {
        throw new AppError('Partner not found', 404);
      }

      // Update status
      return await Partner.updateByUserId(userId, { status: newStatus });
    } catch (error) {
      console.error('Error updating partner status:', error);
      throw error;
    }
  }
}

module.exports = PartnerService;