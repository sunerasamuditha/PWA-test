/**
 * Commission calculation utility module
 */

// Commission rates configuration
const COMMISSION_RATES = {
  default: 10.00,
  // Placeholder for future dynamic rates
  // premium_patient: 15.00,
  // basic_patient: 5.00,
  // hotel_booking: 20.00,
  // tour_guide: 12.00
};

/**
 * Calculate commission for a new referral
 * @param {Object} patientData - Patient data (for future dynamic calculation)
 * @returns {number} Commission amount in points
 */
function calculateCommissionForReferral(patientData = {}) {
  // Phase 5: Fixed commission of 10.00 points per referral
  // Future enhancement: Dynamic rates based on patient type, service usage, or tiered structures
  
  // Example future logic:
  // if (patientData.type === 'premium') {
  //   return COMMISSION_RATES.premium_patient;
  // }
  // if (patientData.serviceLevel === 'basic') {
  //   return COMMISSION_RATES.basic_patient;
  // }
  
  return COMMISSION_RATES.default;
}

/**
 * Format commission points as currency-like string
 * @param {number} points - Commission points
 * @returns {string} Formatted commission string
 */
function formatCommissionPoints(points) {
  const numericPoints = parseFloat(points || 0);
  return `${numericPoints.toFixed(2)} pts`;
}

/**
 * Get commission rate by type
 * @param {string} rateType - Rate type identifier
 * @returns {number} Commission rate
 */
function getCommissionRate(rateType = 'default') {
  return COMMISSION_RATES[rateType] || COMMISSION_RATES.default;
}

/**
 * Calculate total commission for multiple referrals
 * @param {Array} referrals - Array of referral objects
 * @returns {number} Total commission amount
 */
function calculateTotalCommission(referrals = []) {
  return referrals.reduce((total, referral) => {
    return total + (parseFloat(referral.commissionAmount) || 0);
  }, 0);
}

module.exports = {
  COMMISSION_RATES,
  calculateCommissionForReferral,
  formatCommissionPoints,
  getCommissionRate,
  calculateTotalCommission
};