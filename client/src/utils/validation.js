// Validation utilities for form inputs
// Used across authentication and profile forms

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation with detailed requirements
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Full name validation
export const validateFullName = (fullName) => {
  const errors = [];
  
  if (!fullName) {
    return { isValid: false, errors: ['Full name is required'] };
  }
  
  const trimmedName = fullName.trim();
  
  if (trimmedName.length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }
  
  if (trimmedName.length > 100) {
    errors.push('Full name must be less than 100 characters');
  }
  
  // Check for valid name characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmedName)) {
    errors.push('Full name can only contain letters, spaces, hyphens, and apostrophes');
  }
  
  // Check for at least two parts (first and last name)
  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  if (nameParts.length < 2) {
    errors.push('Please enter your first and last name');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Phone number validation
export const validatePhoneNumber = (phoneNumber) => {
  const errors = [];
  
  if (!phoneNumber) {
    return { isValid: true, errors: [] }; // Phone is optional
  }
  
  const trimmedPhone = phoneNumber.trim();
  
  // Basic phone number format validation
  if (!/^\+?[\d\s\-\(\)\.]+$/.test(trimmedPhone)) {
    errors.push('Please enter a valid phone number');
  }
  
  // Extract only digits for length check
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  
  if (digitsOnly.length < 10) {
    errors.push('Phone number must have at least 10 digits');
  }
  
  if (digitsOnly.length > 15) {
    errors.push('Phone number must have less than 16 digits');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Role validation
export const validateRole = (role) => {
  const validRoles = ['patient', 'partner', 'staff', 'admin', 'super_admin'];
  
  if (!role) {
    return { isValid: false, errors: ['Role is required'] };
  }
  
  if (!validRoles.includes(role)) {
    return { isValid: false, errors: ['Invalid role selected'] };
  }
  
  return { isValid: true, errors: [] };
};

// General form validation helper
export const validateForm = (formData, validationRules) => {
  const errors = {};
  
  Object.keys(validationRules).forEach(field => {
    const rules = validationRules[field];
    const value = formData[field];
    
    // Required field validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      errors[field] = `${rules.label || field} is required`;
      return;
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value.toString().trim() === '') {
      return;
    }
    
    // Custom validation function
    if (rules.validator) {
      const result = rules.validator(value);
      if (!result.isValid) {
        errors[field] = result.errors[0];
        return;
      }
    }
    
    // Min length validation
    if (rules.minLength && value.toString().length < rules.minLength) {
      errors[field] = `${rules.label || field} must be at least ${rules.minLength} characters`;
      return;
    }
    
    // Max length validation
    if (rules.maxLength && value.toString().length > rules.maxLength) {
      errors[field] = `${rules.label || field} must be less than ${rules.maxLength} characters`;
      return;
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value.toString())) {
      errors[field] = rules.message || `${rules.label || field} format is invalid`;
      return;
    }
  });
  
  return errors;
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .slice(0, 1000); // Limit length
};

// Format display names
export const formatDisplayName = (name) => {
  if (!name) return '';
  
  return name
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

// Format phone number for display
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  
  return phone; // Return original if format doesn't match
};

// Password strength calculator
export const calculatePasswordStrength = (password) => {
  if (!password) return 0;
  
  let score = 0;
  
  // Length bonus
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety bonus
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  // Bonus for mixed case
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  
  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  if (/123|abc|qwe/i.test(password)) score -= 1; // Sequential characters
  
  return Math.max(0, Math.min(5, score));
};

// Check if password is compromised (basic check)
export const isCommonPassword = (password) => {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'iloveyou',
    'password1', '123123', 'qwertyuiop', 'dragon', 'master', 'hello',
    'login', 'pass', 'shadow', 'superman', 'batman', 'football',
    'baseball', 'access', 'trustno1', 'welcome1'
  ];
  
  return commonPasswords.includes(password.toLowerCase());
};

// Patient-specific validation functions
export const validatePassportNumber = (passportNumber) => {
  if (!passportNumber) {
    return { isValid: false, errors: ['Passport number is required'] };
  }
  
  if (!/^[A-Za-z0-9]{6,20}$/.test(passportNumber)) {
    return { isValid: false, errors: ['Passport number must be 6-20 alphanumeric characters'] };
  }
  
  return { isValid: true, errors: [] };
};

export const validatePassportExpiry = (expiryDate) => {
  if (!expiryDate) {
    return { isValid: false, errors: ['Passport expiry date is required'] };
  }
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  
  if (expiry <= today) {
    return { isValid: false, errors: ['Passport expiry date must be in the future'] };
  }
  
  // Check if expiring within 6 months
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  
  if (expiry <= sixMonthsFromNow) {
    return { 
      isValid: true, 
      errors: [], 
      warning: 'Passport expires within 6 months. Consider renewing soon.' 
    };
  }
  
  return { isValid: true, errors: [] };
};

export const validateInsurancePolicyNumber = (policyNumber) => {
  if (!policyNumber) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  if (!/^[A-Za-z0-9]{5,50}$/.test(policyNumber)) {
    return { isValid: false, errors: ['Insurance policy number must be 5-50 alphanumeric characters'] };
  }
  
  return { isValid: true, errors: [] };
};

export const validateInsuranceExpiry = (expiryDate) => {
  if (!expiryDate) {
    return { isValid: true, errors: [] }; // Optional field
  }
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  
  if (isNaN(expiry.getTime())) {
    return { isValid: false, errors: ['Invalid insurance expiry date format'] };
  }
  
  // Check if expiring within 6 months
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  
  if (expiry <= sixMonthsFromNow) {
    return { 
      isValid: true, 
      errors: [], 
      warning: 'Insurance expires within 6 months. Consider renewing soon.' 
    };
  }
  
  return { isValid: true, errors: [] };
};

// Formatting functions for masking sensitive data
export const formatPassportNumber = (passportNumber) => {
  if (!passportNumber) return '';
  
  if (passportNumber.length <= 4) {
    return passportNumber; // Don't mask if too short
  }
  
  const maskedPart = '*'.repeat(passportNumber.length - 4);
  const visiblePart = passportNumber.slice(-4);
  
  return maskedPart + visiblePart;
};

export const formatPolicyNumber = (policyNumber) => {
  if (!policyNumber) return '';
  
  if (policyNumber.length <= 4) {
    return policyNumber; // Don't mask if too short
  }
  
  const maskedPart = '*'.repeat(policyNumber.length - 4);
  const visiblePart = policyNumber.slice(-4);
  
  return maskedPart + visiblePart;
};

// Helper function to check if a date is expiring within specified months
export const isExpiringWithinMonths = (expiryDate, months = 6) => {
  if (!expiryDate) return false;
  
  const expiry = new Date(expiryDate);
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + months);
  
  return expiry <= warningDate;
};

// Combined patient validation function
export const validatePatientInfo = (patientData) => {
  const errors = {};
  
  // Validate passport info if provided
  if (patientData.passportInfo) {
    const passportValidation = validatePassportNumber(patientData.passportInfo.number);
    if (!passportValidation.isValid) {
      errors.passportNumber = passportValidation.errors[0];
    }
    
    const expiryValidation = validatePassportExpiry(patientData.passportInfo.expiryDate);
    if (!expiryValidation.isValid) {
      errors.passportExpiry = expiryValidation.errors[0];
    }
  }
  
  // Validate insurance info if provided
  if (patientData.insuranceInfo) {
    const policyValidation = validateInsurancePolicyNumber(patientData.insuranceInfo.policyNumber);
    if (!policyValidation.isValid) {
      errors.insurancePolicyNumber = policyValidation.errors[0];
    }
    
    const insuranceExpiryValidation = validateInsuranceExpiry(patientData.insuranceInfo.expiryDate);
    if (!insuranceExpiryValidation.isValid) {
      errors.insuranceExpiry = insuranceExpiryValidation.errors[0];
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// =============================================================================
// Document/File Validation Functions
// =============================================================================

/**
 * Validate file size
 * @param {File} file - File object
 * @param {number} maxSizeInMB - Maximum file size in MB (default: 10)
 * @returns {Object} Validation result
 */
export const validateFileSize = (file, maxSizeInMB = 10) => {
  if (!file) {
    return { isValid: false, errors: ['No file provided'] };
  }

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  
  if (file.size > maxSizeInBytes) {
    return { 
      isValid: false, 
      errors: [`File size exceeds ${maxSizeInMB}MB limit. Selected file is ${formatFileSize(file.size)}`]
    };
  }

  return { isValid: true, errors: [] };
};

/**
 * Validate file type
 * @param {File} file - File object
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {Object} Validation result
 */
export const validateFileType = (file, allowedTypes = null) => {
  if (!file) {
    return { isValid: false, errors: ['No file provided'] };
  }

  const defaultAllowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const typesToCheck = allowedTypes || defaultAllowedTypes;

  if (!typesToCheck.includes(file.type)) {
    return { 
      isValid: false, 
      errors: ['Invalid file type. Please upload PDF, JPG, PNG, DOC, or DOCX files only.']
    };
  }

  return { isValid: true, errors: [] };
};

/**
 * Format file size to human-readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} File extension (including dot)
 */
export const getFileExtension = (filename) => {
  if (!filename) return '';
  
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  
  return filename.substring(lastDot).toLowerCase();
};

/**
 * Sanitize filename to prevent security issues
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename) return 'unnamed';
  
  // Remove path separators and special characters
  let sanitized = filename.replace(/[\/\\:\*\?"<>\|]/g, '_');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
  
  // Limit length to 255 characters
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.substring(0, 255 - ext.length);
    sanitized = nameWithoutExt + ext;
  }
  
  return sanitized || 'unnamed';
};

/**
 * Check if file is an image
 * @param {File|string} file - File object or MIME type string
 * @returns {boolean} True if file is an image
 */
export const isImageFile = (file) => {
  if (!file) return false;
  
  const mimeType = typeof file === 'string' ? file : file.type;
  return mimeType && mimeType.startsWith('image/');
};

/**
 * Check if file is a PDF
 * @param {File|string} file - File object or MIME type string
 * @returns {boolean} True if file is a PDF
 */
export const isPDFFile = (file) => {
  if (!file) return false;
  
  const mimeType = typeof file === 'string' ? file : file.type;
  return mimeType === 'application/pdf';
};

/**
 * Get file icon/emoji based on file type
 * @param {File|string} file - File object or MIME type string
 * @returns {string} Icon/emoji
 */
export const getFileIcon = (file) => {
  if (!file) return '📄';
  
  const mimeType = typeof file === 'string' ? file : file.type;
  
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  
  return '📄';
};

/**
 * Validate document file (combines size and type validation)
 * @param {File} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateDocumentFile = (file, options = {}) => {
  const {
    maxSizeInMB = 10,
    allowedTypes = null
  } = options;

  const errors = [];

  // Validate file exists
  if (!file) {
    return { isValid: false, errors: ['No file selected'] };
  }

  // Validate file size
  const sizeValidation = validateFileSize(file, maxSizeInMB);
  if (!sizeValidation.isValid) {
    errors.push(...sizeValidation.errors);
  }

  // Validate file type
  const typeValidation = validateFileType(file, allowedTypes);
  if (!typeValidation.isValid) {
    errors.push(...typeValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================================================================
// Partner-specific validation functions
// =============================================================================

export const validatePartnerType = (type) => {
  const validTypes = ['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'];
  
  if (!type) {
    return { isValid: false, errors: ['Partner type is required'] };
  }
  
  if (!validTypes.includes(type)) {
    return { isValid: false, errors: ['Invalid partner type selected'] };
  }
  
  return { isValid: true, errors: [] };
};

export const validateReferralCode = (code) => {
  if (!code) {
    return { isValid: true, errors: [] }; // Referral code is optional
  }
  
  // UUID validation regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(code)) {
    return { isValid: false, errors: ['Invalid referral code format'] };
  }
  
  return { isValid: true, errors: [] };
};

export const formatCommissionPoints = (points) => {
  const numPoints = parseFloat(points || 0);
  return `${numPoints.toFixed(2)} pts`;
};

export const getPartnerTypeDisplayName = (type) => {
  const typeMap = {
    'guide': 'Guide',
    'driver': 'Driver', 
    'hotel': 'Hotel',
    'villa': 'Villa',
    'guest_house': 'Guest House',
    'other': 'Other'
  };
  
  return typeMap[type] || 'Unknown';
};

// Partner status validation
export const validatePartnerStatus = (status) => {
  const validStatuses = ['active', 'inactive', 'pending'];
  
  if (!status) {
    return { isValid: false, errors: ['Partner status is required'] };
  }
  
  if (!validStatuses.includes(status)) {
    return { isValid: false, errors: ['Invalid partner status'] };
  }
  
  return { isValid: true, errors: [] };
};

// Commission amount validation
export const validateCommissionAmount = (amount) => {
  if (!amount && amount !== 0) {
    return { isValid: false, errors: ['Commission amount is required'] };
  }
  
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) {
    return { isValid: false, errors: ['Commission amount must be a valid number'] };
  }
  
  if (numAmount < 0) {
    return { isValid: false, errors: ['Commission amount cannot be negative'] };
  }
  
  if (numAmount > 1000) {
    return { isValid: false, errors: ['Commission amount cannot exceed 1000 points'] };
  }
  
  return { isValid: true, errors: [] };
};

// Combined partner validation function
export const validatePartnerInfo = (partnerData) => {
  const errors = {};
  
  // Validate partner type
  const typeValidation = validatePartnerType(partnerData.type || partnerData.partnerType);
  if (!typeValidation.isValid) {
    errors.partnerType = typeValidation.errors[0];
  }
  
  // Validate status if provided
  if (partnerData.status) {
    const statusValidation = validatePartnerStatus(partnerData.status);
    if (!statusValidation.isValid) {
      errors.status = statusValidation.errors[0];
    }
  }
  
  // Validate commission points if provided
  if (partnerData.commissionPoints !== undefined) {
    const commissionValidation = validateCommissionAmount(partnerData.commissionPoints);
    if (!commissionValidation.isValid) {
      errors.commissionPoints = commissionValidation.errors[0];
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Format partner display data
export const formatPartnerDisplayData = (partner) => {
  if (!partner) return null;
  
  return {
    ...partner,
    typeDisplayName: getPartnerTypeDisplayName(partner.type || partner.partnerType),
    formattedCommissionPoints: formatCommissionPoints(partner.commissionPoints),
    formattedTotalCommission: formatCommissionPoints(partner.totalCommission),
    statusBadgeClass: `status-${partner.status}`,
    isActive: partner.status === 'active'
  };
};

// Appointment validation functions

/**
 * Validate appointment datetime
 * @param {Date|string} datetime - Datetime to validate
 * @returns {Object} Validation result
 */
export const validateAppointmentDateTime = (datetime) => {
  const errors = [];
  const date = new Date(datetime);

  if (isNaN(date.getTime())) {
    return { isValid: false, errors: ['Invalid date'] };
  }

  // Check if date is in future
  const now = new Date();
  if (date <= now) {
    errors.push('Appointment date must be in the future');
  }

  // Check business hours (8 AM - 8 PM)
  if (!isBusinessHours(date)) {
    errors.push('Appointment must be scheduled during business hours (8 AM - 8 PM)');
  }

  // Check 30-minute increment
  if (!isThirtyMinuteIncrement(date)) {
    errors.push('Appointment must be scheduled in 30-minute increments (e.g., 9:00, 9:30)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check if datetime is within business hours
 * @param {Date} datetime - Datetime to check
 * @returns {boolean} True if within business hours
 */
export const isBusinessHours = (datetime) => {
  const hour = datetime.getHours();
  return hour >= 8 && hour < 20; // 8 AM to 8 PM
};

/**
 * Check if datetime is on 30-minute increment
 * @param {Date} datetime - Datetime to check
 * @returns {boolean} True if on 30-minute increment
 */
export const isThirtyMinuteIncrement = (datetime) => {
  const minutes = datetime.getMinutes();
  return minutes === 0 || minutes === 30;
};

/**
 * Format appointment datetime for display
 * @param {string} datetime - ISO datetime string
 * @returns {string} Formatted datetime
 */
export const formatAppointmentDateTime = (datetime) => {
  const date = new Date(datetime);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get display name for appointment type
 * @param {string} type - Appointment type
 * @returns {string} Display name
 */
export const getAppointmentTypeDisplayName = (type) => {
  const typeNames = {
    opd: 'OPD - Outpatient Consultation',
    admission: 'Admission - Inpatient'
  };
  return typeNames[type] || type;
};

/**
 * Get display name for appointment status
 * @param {string} status - Appointment status
 * @returns {string} Display name
 */
export const getStatusDisplayName = (status) => {
  const statusNames = {
    scheduled: 'Scheduled',
    checked_in: 'Checked In',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return statusNames[status] || status;
};

/**
 * Check if user can cancel appointment
 * @param {Object} appointment - Appointment object
 * @param {string} userRole - User role
 * @param {number} userId - User ID
 * @returns {boolean} True if user can cancel
 */
export const canCancelAppointment = (appointment, userRole, userId) => {
  const isOwner = appointment.patientUserId === userId;
  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
  const canCancel = ['scheduled', 'checked_in'].includes(appointment.status);
  
  return (isOwner || isStaffOrAdmin) && canCancel;
};

/**
 * Check if user can check in appointment
 * @param {Object} appointment - Appointment object
 * @param {string} userRole - User role
 * @param {Array} userPermissions - User permissions
 * @returns {boolean} True if user can check in
 */
export const canCheckInAppointment = (appointment, userRole, userPermissions = []) => {
  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
  const hasPermission = userRole === 'staff' 
    ? userPermissions.includes('manage_appointments')
    : isStaffOrAdmin;
  
  return hasPermission && appointment.status === 'scheduled';
};

/**
 * Check if user can complete appointment
 * @param {Object} appointment - Appointment object
 * @param {string} userRole - User role
 * @param {Array} userPermissions - User permissions
 * @returns {boolean} True if user can complete
 */
export const canCompleteAppointment = (appointment, userRole, userPermissions = []) => {
  const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
  const hasPermission = userRole === 'staff'
    ? userPermissions.includes('manage_appointments')
    : isStaffOrAdmin;
  
  return hasPermission && appointment.status === 'checked_in';
};

// =============================================================================
// Billing/Invoice Validation Functions
// =============================================================================

/**
 * Validate price/amount
 * @param {number|string} price - Price to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validatePrice = (price, options = {}) => {
  const {
    allowZero = false,
    minValue = 0.01,
    maxValue = 999999.99,
    label = 'Price'
  } = options;

  const errors = [];

  if (price === null || price === undefined || price === '') {
    return { isValid: false, errors: [`${label} is required`] };
  }

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return { isValid: false, errors: [`${label} must be a valid number`] };
  }

  if (!allowZero && numPrice === 0) {
    errors.push(`${label} cannot be zero`);
  }

  if (numPrice < 0) {
    errors.push(`${label} cannot be negative`);
  }

  if (numPrice < minValue) {
    errors.push(`${label} must be at least ${formatCurrency(minValue)}`);
  }

  if (numPrice > maxValue) {
    errors.push(`${label} cannot exceed ${formatCurrency(maxValue)}`);
  }

  // Check decimal places (max 2)
  const decimalPlaces = (numPrice.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push(`${label} can only have up to 2 decimal places`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format number as currency (Indonesian Rupiah)
 * @param {number} amount - Amount to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  const {
    showSymbol = true,
    symbol = 'IDR',
    decimals = 2
  } = options;

  const numAmount = parseFloat(amount) || 0;
  const formatted = numAmount.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return showSymbol ? `${symbol} ${formatted}` : formatted;
};

/**
 * Parse currency string to number
 * @param {string} currencyString - Currency string to parse
 * @returns {number} Parsed number
 */
export const parseCurrency = (currencyString) => {
  if (typeof currencyString === 'number') return currencyString;
  if (!currencyString) return 0;

  // Remove currency symbol and separators
  const cleaned = currencyString
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '') // Remove thousands separators
    .replace(/,/g, '.'); // Replace comma decimal to dot

  return parseFloat(cleaned) || 0;
};

/**
 * Validate invoice number format (WC-YYYY-NNNN)
 * @param {string} invoiceNumber - Invoice number to validate
 * @returns {Object} Validation result
 */
export const validateInvoiceNumber = (invoiceNumber) => {
  if (!invoiceNumber) {
    return { isValid: false, errors: ['Invoice number is required'] };
  }

  const invoicePattern = /^WC-\d{4}-\d{4}$/;
  
  if (!invoicePattern.test(invoiceNumber)) {
    return { 
      isValid: false, 
      errors: ['Invalid invoice number format. Expected: WC-YYYY-NNNN'] 
    };
  }

  // Extract year
  const year = parseInt(invoiceNumber.split('-')[1]);
  const currentYear = new Date().getFullYear();
  
  // Allow current year and up to 10 years back
  if (year < currentYear - 10 || year > currentYear) {
    return { 
      isValid: false, 
      errors: ['Invoice year is out of valid range'] 
    };
  }

  return { isValid: true, errors: [] };
};

/**
 * Validate quantity
 * @param {number|string} quantity - Quantity to validate
 * @returns {Object} Validation result
 */
export const validateQuantity = (quantity) => {
  const errors = [];

  if (quantity === null || quantity === undefined || quantity === '') {
    return { isValid: false, errors: ['Quantity is required'] };
  }

  const numQuantity = typeof quantity === 'string' ? parseInt(quantity) : quantity;

  if (isNaN(numQuantity)) {
    return { isValid: false, errors: ['Quantity must be a valid number'] };
  }

  if (numQuantity <= 0) {
    errors.push('Quantity must be greater than zero');
  }

  if (numQuantity > 1000) {
    errors.push('Quantity cannot exceed 1000');
  }

  if (!Number.isInteger(numQuantity)) {
    errors.push('Quantity must be a whole number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get display name for payment method
 * @param {string} method - Payment method
 * @returns {string} Display name
 */
export const getPaymentMethodDisplayName = (method) => {
  const methodMap = {
    'cash': 'Cash',
    'card': 'Card/Debit',
    'bank_transfer': 'Bank Transfer',
    'insurance': 'Insurance (Direct)',
    'insurance_credit': 'Insurance (Credit)'
  };

  return methodMap[method] || method;
};

/**
 * Get display name for invoice status
 * @param {string} status - Invoice status
 * @returns {string} Display name
 */
export const getInvoiceStatusDisplayName = (status) => {
  const statusMap = {
    'pending': 'Pending',
    'partially_paid': 'Partially Paid',
    'paid': 'Paid',
    'overdue': 'Overdue'
  };

  return statusMap[status] || status;
};

/**
 * Get CSS class for invoice status badge
 * @param {string} status - Invoice status
 * @returns {string} CSS class name
 */
export const getInvoiceStatusBadgeClass = (status) => {
  const classMap = {
    'pending': 'status-pending',
    'partially_paid': 'status-partial',
    'paid': 'status-paid',
    'overdue': 'status-overdue'
  };

  return classMap[status] || 'status-default';
};

/**
 * Calculate line item total
 * @param {number} quantity - Quantity
 * @param {number} unitPrice - Unit price
 * @returns {number} Line total
 */
export const calculateLineTotal = (quantity, unitPrice) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  return Math.round(qty * price * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate invoice subtotal from items
 * @param {Array} items - Array of invoice items
 * @returns {number} Subtotal
 */
export const calculateInvoiceSubtotal = (items) => {
  if (!Array.isArray(items)) return 0;

  return items.reduce((sum, item) => {
    const total = item.totalPrice || calculateLineTotal(item.quantity, item.unitPrice);
    return sum + total;
  }, 0);
};

/**
 * Check if user can edit invoice
 * @param {Object} invoice - Invoice object
 * @param {string} userRole - User role
 * @param {Array} userPermissions - User permissions
 * @returns {boolean} True if user can edit
 */
export const canEditInvoice = (invoice, userRole, userPermissions = []) => {
  const isAdmin = ['admin', 'super_admin'].includes(userRole);
  const hasPermission = userRole === 'staff'
    ? userPermissions.includes('process_payments')
    : isAdmin;

  // Can only edit pending or partially paid invoices
  const canEdit = ['pending', 'partially_paid'].includes(invoice.status);

  return hasPermission && canEdit;
};

/**
 * Check if user can delete invoice
 * @param {Object} invoice - Invoice object
 * @param {string} userRole - User role
 * @returns {boolean} True if user can delete
 */
export const canDeleteInvoice = (invoice, userRole) => {
  // Only admins can delete invoices
  const isAdmin = ['admin', 'super_admin'].includes(userRole);

  // Can only delete pending invoices with no payments
  const canDelete = invoice.status === 'pending' && 
                    (!invoice.paidAmount || invoice.paidAmount === 0);

  return isAdmin && canDelete;
};

/**
 * Check if user can record payment
 * @param {Object} invoice - Invoice object
 * @param {string} userRole - User role
 * @param {Array} userPermissions - User permissions
 * @returns {boolean} True if user can record payment
 */
export const canRecordPayment = (invoice, userRole, userPermissions = []) => {
  const isAdmin = ['admin', 'super_admin'].includes(userRole);
  const hasPermission = userRole === 'staff'
    ? userPermissions.includes('process_payments')
    : isAdmin;

  // Can record payment if not fully paid
  const canPay = invoice.status !== 'paid';

  return hasPermission && canPay;
};

/**
 * Check if invoice is overdue
 * @param {Object} invoice - Invoice object
 * @returns {boolean} True if overdue
 */
export const isInvoiceOverdue = (invoice) => {
  if (!invoice || !invoice.dueDate) return false;
  
  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPastDue = dueDate < today;
  const isNotPaid = invoice.status !== 'paid';

  return isPastDue && isNotPaid;
};

/**
 * Calculate days overdue
 * @param {Object} invoice - Invoice object
 * @returns {number} Days overdue (0 if not overdue)
 */
export const calculateDaysOverdue = (invoice) => {
  if (!isInvoiceOverdue(invoice)) return 0;

  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(today - dueDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// =============================================================================
// Shift Validation Functions
// =============================================================================

/**
 * Validate shift times
 */
export function validateShiftTimes(loginAt, logoutAt) {
  const errors = [];
  
  const login = new Date(loginAt);
  const logout = logoutAt ? new Date(logoutAt) : null;
  
  if (isNaN(login.getTime())) {
    errors.push('Invalid login time');
  }
  
  if (logout && isNaN(logout.getTime())) {
    errors.push('Invalid logout time');
  }
  
  if (login && logout && logout <= login) {
    errors.push('Logout time must be after login time');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate shift duration in hours
 */
export function calculateShiftDuration(loginAt, logoutAt) {
  if (!logoutAt) return null;
  
  const login = new Date(loginAt);
  const logout = new Date(logoutAt);
  
  const diffMs = logout - login;
  const hours = diffMs / (1000 * 60 * 60);
  
  return Math.round(hours * 100) / 100; // Round to 2 decimals
}

/**
 * Format shift duration
 */
export function formatShiftDuration(hours) {
  if (hours === null || hours === undefined) return 'N/A';
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''}`;
  }
  
  return `${wholeHours} hour${wholeHours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Format shift time as HH:MM AM/PM
 */
export function formatShiftTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Format shift date and time
 */
export function formatShiftDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const time = formatShiftTime(timestamp);
  
  return `${dayName}, ${monthName} ${day}, ${year} at ${time}`;
}

/**
 * Get shift type display name with time range
 */
export function getShiftTypeDisplayName(shiftType) {
  const shiftTypeMap = {
    'full_night': 'Full Night (8pm-1pm)',
    'day': 'Day (1pm-9pm)',
    'intermediate': 'Intermediate (11am-8pm)'
  };
  return shiftTypeMap[shiftType] || shiftType;
}

/**
 * Get shift type badge color
 */
export function getShiftTypeBadgeColor(shiftType) {
  const colorMap = {
    'full_night': '#8b5cf6', // Purple
    'day': '#3b82f6',        // Blue
    'intermediate': '#10b981' // Green
  };
  return colorMap[shiftType] || '#6b7280'; // Gray fallback
}

/**
 * Check if shift is active (no logout time)
 */
export function isShiftActive(shift) {
  return shift && !shift.logoutAt;
}

/**
 * Get live duration for active shift
 */
export function getLiveDuration(loginAt) {
  if (!loginAt) return 0;
  
  const login = new Date(loginAt);
  const now = new Date();
  const diffMs = now - login;
  const hours = diffMs / (1000 * 60 * 60);
  
  return Math.round(hours * 100) / 100; // Round to 2 decimals
}

export default {
  validateEmail,
  validatePassword,
  validateFullName,
  validatePhoneNumber,
  validateRole,
  validateForm,
  sanitizeInput,
  formatDisplayName,
  formatPhoneNumber,
  calculatePasswordStrength,
  isCommonPassword,
  validatePassportNumber,
  validatePassportExpiry,
  validateInsurancePolicyNumber,
  validateInsuranceExpiry,
  formatPassportNumber,
  formatPolicyNumber,
  isExpiringWithinMonths,
  validatePatientInfo,
  // Partner-specific functions
  validatePartnerType,
  validateReferralCode,
  formatCommissionPoints,
  getPartnerTypeDisplayName,
  validatePartnerStatus,
  validateCommissionAmount,
  validatePartnerInfo,
  formatPartnerDisplayData,
  // Document/File validation functions
  validateFileSize,
  validateFileType,
  formatFileSize,
  getFileExtension,
  sanitizeFilename,
  isImageFile,
  isPDFFile,
  getFileIcon,
  validateDocumentFile,
  // Appointment validation functions
  validateAppointmentDateTime,
  isBusinessHours,
  isThirtyMinuteIncrement,
  formatAppointmentDateTime,
  getAppointmentTypeDisplayName,
  getStatusDisplayName,
  canCancelAppointment,
  canCheckInAppointment,
  canCompleteAppointment,
  // Billing-specific functions
  validatePrice,
  formatCurrency,
  parseCurrency,
  validateInvoiceNumber,
  validateQuantity,
  getPaymentMethodDisplayName,
  getInvoiceStatusDisplayName,
  getInvoiceStatusBadgeClass,
  calculateLineTotal,
  calculateInvoiceSubtotal,
  canEditInvoice,
  canDeleteInvoice,
  canRecordPayment,
  isInvoiceOverdue,
  calculateDaysOverdue,
  // Shift validation functions
  validateShiftTimes,
  calculateShiftDuration,
  formatShiftDuration,
  formatShiftTime,
  formatShiftDateTime,
  getShiftTypeDisplayName,
  getShiftTypeBadgeColor,
  isShiftActive,
  getLiveDuration,
  // Phase 11: External entities and accounts payable
  getEntityTypeDisplayName,
  getEntityTypeBadgeColor,
  validateContactInfo,
  formatAddress,
  getPayableStatusDisplayName,
  getPayableStatusBadgeColor,
  validateDueDate,
  calculateDaysOverdue: calculatePayableDaysOverdue,
  isDueWithinDays,
  formatDueDate,
  validatePaymentMethod
};

// =============================================================================
// Phase 11: External Entities Validation Functions
// =============================================================================

/**
 * Get display name for entity type
 */
export function getEntityTypeDisplayName(type) {
  const typeMap = {
    'hospital': 'Hospital',
    'lab': 'Laboratory',
    'supplier': 'Supplier',
    'insurance_company': 'Insurance Company',
    'other': 'Other'
  };
  return typeMap[type] || type;
}

/**
 * Get badge color for entity type
 */
export function getEntityTypeBadgeColor(type) {
  const colorMap = {
    'hospital': '#ef4444',      // Red
    'lab': '#3b82f6',           // Blue
    'supplier': '#10b981',      // Green
    'insurance_company': '#f59e0b', // Amber
    'other': '#6b7280'          // Gray
  };
  return colorMap[type] || '#6b7280';
}

/**
 * Validate contact info structure
 */
export function validateContactInfo(contactInfo) {
  const errors = {};
  
  if (!contactInfo) {
    return { isValid: true, errors: {} }; // Contact info is optional
  }
  
  // Validate email if provided
  if (contactInfo.email) {
    if (!validateEmail(contactInfo.email)) {
      errors.email = 'Invalid email format';
    }
  }
  
  // Validate phone if provided
  if (contactInfo.phone) {
    const phoneValidation = validatePhoneNumber(contactInfo.phone);
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.errors[0];
    }
  }
  
  // Validate contact person email if provided
  if (contactInfo.contact_person?.email) {
    if (!validateEmail(contactInfo.contact_person.email)) {
      errors.contactPersonEmail = 'Invalid contact person email format';
    }
  }
  
  // Validate billing contact email if provided
  if (contactInfo.billing_contact?.email) {
    if (!validateEmail(contactInfo.billing_contact.email)) {
      errors.billingContactEmail = 'Invalid billing contact email format';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Format address object to string
 */
export function formatAddress(address) {
  if (!address) return '';
  
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postal_code) parts.push(address.postal_code);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
}

// =============================================================================
// Phase 11: Accounts Payable Validation Functions
// =============================================================================

/**
 * Get display name for payable status
 */
export function getPayableStatusDisplayName(status) {
  const statusMap = {
    'due': 'Due',
    'paid': 'Paid',
    'overdue': 'Overdue'
  };
  return statusMap[status] || status;
}

/**
 * Get badge color for payable status
 */
export function getPayableStatusBadgeColor(status) {
  const colorMap = {
    'due': '#3b82f6',      // Blue
    'paid': '#10b981',     // Green
    'overdue': '#ef4444'   // Red
  };
  return colorMap[status] || '#6b7280';
}

/**
 * Validate due date
 */
export function validateDueDate(dueDate) {
  const errors = [];
  
  if (!dueDate) {
    return { isValid: false, errors: ['Due date is required'] };
  }
  
  const date = new Date(dueDate);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, errors: ['Invalid due date'] };
  }
  
  // Warn if due date is in the past (but allow it)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date < today) {
    return {
      isValid: true,
      errors: [],
      warning: 'Due date is in the past. This payable will be marked as overdue.'
    };
  }
  
  return { isValid: true, errors: [] };
}

/**
 * Calculate days overdue for payable
 */
export function calculatePayableDaysOverdue(payable) {
  if (!payable || payable.status !== 'overdue') return 0;
  
  const dueDate = new Date(payable.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today - dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Check if payable is due within specified days
 */
export function isDueWithinDays(payable, days = 7) {
  if (!payable || payable.status !== 'due') return false;
  
  const dueDate = new Date(payable.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + days);
  
  return dueDate <= targetDate;
}

/**
 * Format due date with status indicator
 */
export function formatDueDate(dueDate, status) {
  if (!dueDate) return 'N/A';
  
  const date = new Date(dueDate);
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  if (status === 'overdue') {
    const daysOverdue = calculatePayableDaysOverdue({ dueDate, status });
    return `${formatted} (${daysOverdue} days overdue)`;
  }
  
  if (status === 'due') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return formatted;
    } else if (diffDays === 0) {
      return `${formatted} (Due today)`;
    } else if (diffDays <= 7) {
      return `${formatted} (Due in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
    }
  }
  
  return formatted;
}

/**
 * Validate payment method
 */
export function validatePaymentMethod(paymentMethod) {
  if (!paymentMethod) {
    return { isValid: false, errors: ['Payment method is required'] };
  }
  
  if (paymentMethod.trim().length === 0) {
    return { isValid: false, errors: ['Payment method cannot be empty'] };
  }
  
  if (paymentMethod.length > 100) {
    return { isValid: false, errors: ['Payment method must be less than 100 characters'] };
  }
  
  return { isValid: true, errors: [] };
}
