const PartnerService = require('../services/partnerService');
const { AppError } = require('../middleware/errorHandler');



/**
 * Get partner profile
 */
const getPartnerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partner = await PartnerService.getPartnerProfile(userId);
    
    res.json({
      success: true,
      data: partner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update partner profile
 */
const updatePartnerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Capture before state
    const beforePartner = await PartnerService.getPartnerByUserId(userId);
    res.locals.beforeData = beforePartner;
    
    const updateData = req.body;
    
    const updatedPartner = await PartnerService.updatePartnerProfile(userId, updateData);
    
    // Capture after state and set updated partner in res.locals for audit middleware
    res.locals.afterData = updatedPartner;
    res.locals.updatedPartner = updatedPartner;
    
    res.json({
      success: true,
      message: 'Partner profile updated successfully',
      data: updatedPartner
    });
    
    // Call next for audit middleware
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Generate QR code for partner
 */
const generateQRCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const qrCodeData = await PartnerService.generatePartnerQRCode(userId);
    
    res.json({
      success: true,
      data: qrCodeData
    });
    
    // Call next for audit middleware
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Get partner referrals
 */
const getPartnerReferrals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    
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
    
    const referrals = await PartnerService.getPartnerReferrals(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters
    });
    
    res.json({
      success: true,
      data: referrals
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get partner statistics
 */
const getPartnerStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const stats = await PartnerService.getPartnerStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all partners (admin only)
 */
const getAllPartners = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    
    const filters = {};
    if (status) {
      filters.status = status;
    }
    if (type) {
      filters.type = type;
    }
    
    const partners = await PartnerService.getAllPartners({
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters
    });
    
    res.json({
      success: true,
      data: partners
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get partner by user ID (admin only)
 */
const getPartnerById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const partner = await PartnerService.getPartnerProfile(userId);
    
    res.json({
      success: true,
      data: partner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get partner referrals by partner ID (admin only)
 */
const getPartnerReferralsById = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const { page = 1, limit = 10, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };
    
    if (status) {
      filters.status = status;
    }
    
    // Get partner info first to get user_id
    const Partner = require('../models/Partner');
    const partner = await Partner.findById(partnerId);
    
    if (!partner) {
      throw new AppError('Partner not found', 404);
    }
    
    const referrals = await PartnerService.getPartnerReferrals(partner.user_id, filters);
    
    res.json({
      success: true,
      data: referrals
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update partner status (admin only)
 */
const updatePartnerStatus = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'pending'].includes(status)) {
      throw new AppError('Invalid status. Must be active, inactive, or pending.', 400);
    }
    
    // Capture before state
    const beforePartner = await PartnerService.getPartnerById(partnerId);
    res.locals.beforeData = beforePartner;
    
    const updatedPartner = await PartnerService.updatePartnerStatus(partnerId, status);
    
    // Capture after state
    res.locals.afterData = updatedPartner;
    
    res.json({
      success: true,
      message: 'Partner status updated successfully',
      data: updatedPartner
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get partner commission history
 */
const getCommissionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    
    const filters = {};
    if (startDate) {
      filters.startDate = startDate;
    }
    if (endDate) {
      filters.endDate = endDate;
    }
    
    const commissionHistory = await PartnerService.getCommissionHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      ...filters
    });
    
    res.json({
      success: true,
      data: commissionHistory
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPartnerProfile,
  updatePartnerProfile,
  generateQRCode,
  getPartnerReferrals,
  getPartnerStats,
  getAllPartners,
  getPartnerById,
  getPartnerReferralsById,
  updatePartnerStatus,
  getCommissionHistory
};