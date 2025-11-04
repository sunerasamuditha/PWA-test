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
    const updateData = req.body;
    
    const updatedPartner = await PartnerService.updatePartnerProfile(userId, updateData);
    
    // Set updated partner in res.locals for audit middleware
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
 * Update partner status (admin only)
 */
const updatePartnerStatus = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'pending'].includes(status)) {
      throw new AppError('Invalid status. Must be active, inactive, or pending.', 400);
    }
    
    const updatedPartner = await PartnerService.updatePartnerStatus(partnerId, status);
    
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
  updatePartnerStatus,
  getCommissionHistory
};