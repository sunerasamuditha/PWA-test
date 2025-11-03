const User = require('../models/User');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError } = require('../middleware/errorHandler');

class AuthService {
  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @returns {object} User object and tokens
   */
  static async login(email, password) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      // Automatically start shift for staff users
      let shift = null;
      if (user.role === 'staff') {
        try {
          const ShiftService = require('./shiftService');
          shift = await ShiftService.startShift(user.id, new Date());
        } catch (error) {
          // Log warning but don't fail login if shift creation fails
          console.warn(`Failed to start shift for staff ${user.id}:`, error.message);
        }
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role
      });

      const refreshToken = generateRefreshToken({
        id: user.id
      });

      // Return user without password hash and tokens
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
        shift
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Login failed: ${error.message}`, 500);
    }
  }

  /**
   * Register new user
   * @param {object} userData - User registration data
   * @param {string} referralCode - Optional referral code from partner
   * @returns {object} Created user object and tokens
   */
  static async register(userData, referralCode = null) {
    const { executeTransaction } = require('../config/database');
    
    return await executeTransaction(async (connection) => {
      try {
        const { fullName, email, password, role, passportInfo, insuranceInfo, currentAddress, partnerType } = userData;

        // Check if email already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          throw new AppError('Email already exists', 400);
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
          throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
        }

        // Validate patient-specific data if role is patient
        if (role === 'patient') {
          const PatientService = require('./patientService');
          
          if (passportInfo) {
            PatientService._validatePassportInfo(passportInfo);
          }
          
          if (insuranceInfo) {
            PatientService._validateInsuranceInfo(insuranceInfo);
          }
        }

        // Validate partner-specific data if role is partner
        if (role === 'partner') {
          if (!partnerType || !['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'].includes(partnerType)) {
            throw new AppError('Valid partner type is required for partner registration', 400);
          }
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user (pass connection for transaction)
        const newUser = await User.create({
          fullName,
          email,
          passwordHash,
          role,
          phoneNumber: userData.phoneNumber || null,
          dateOfBirth: userData.dateOfBirth || null,
          address: userData.address || null,
          emergencyContact: userData.emergencyContact || null
        }, connection);

        // If role is patient and patient data is provided, create patient record
        let patientRecord = null;
        if (role === 'patient' && (passportInfo || insuranceInfo || currentAddress)) {
          const Patient = require('../models/Patient');
          
          patientRecord = await Patient.create({
            user_id: newUser.id,
            passportInfo,
            insuranceInfo,
            currentAddress
          }, connection);
        }

        // If role is partner, create partner record
        let partnerRecord = null;
        if (role === 'partner') {
          const Partner = require('../models/Partner');
          
          partnerRecord = await Partner.create({
            user_id: newUser.id,
            type: partnerType,
            status: 'pending', // Default status for new partners
            commission_points: 0
          }, connection);
        }

        // Handle referral if referral code is provided and user is a patient
        let referralRecord = null;
        if (referralCode && role === 'patient') {
          const referralService = require('./referralService');
          
          try {
            referralRecord = await referralService.createReferral(referralCode, newUser.id, connection);
          } catch (referralError) {
            // Log referral error but don't fail registration
            console.warn('Referral creation failed during registration:', referralError.message);
          }
        }

        // Generate tokens
        const accessToken = generateAccessToken({
          id: newUser.id,
          uuid: newUser.uuid,
          email: newUser.email,
          role: newUser.role
        });

        const refreshToken = generateRefreshToken({
          id: newUser.id
        });

        // Return user without password hash and tokens
        const { passwordHash: _, ...userWithoutPassword } = newUser;

        const result = {
          user: userWithoutPassword,
          accessToken,
          refreshToken
        };

        // Include patient data if created
        if (patientRecord) {
          result.patient = patientRecord;
        }

        // Include partner data if created
        if (partnerRecord) {
          result.partner = partnerRecord;
        }

        // Include referral info if created
        if (referralRecord) {
          result.referral = {
            partnerId: referralRecord.partner_user_id,
            commissionAwarded: referralRecord.commission_amount
          };
        }

        return result;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`Registration failed: ${error.message}`, 500);
      }
    });
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {object} New access token
   */
  static async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Get user from database
      const user = await User.findById(decoded.id);
      if (!user) {
        throw new AppError('User not found', 401);
      }

      // Generate new access token
      const newAccessToken = generateAccessToken({
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role
      });

      return {
        accessToken: newAccessToken
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // JWT errors (TokenExpiredError, JsonWebTokenError) are handled by errorHandler
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid or expired refresh token', 401);
      }
      throw new AppError(`Token refresh failed: ${error.message}`, 500);
    }
  }

  /**
   * Logout user (placeholder for future token blacklisting)
   * @param {number} userId - User ID
   * @returns {object} Success message
   */
  static async logout(userId) {
    try {
      // Automatically end shift for staff users
      const user = await User.findById(userId);
      if (user && user.role === 'staff') {
        try {
          const ShiftService = require('./shiftService');
          await ShiftService.endShift(userId, new Date(), null);
        } catch (error) {
          // Log warning but don't fail logout if shift end fails
          console.warn(`Failed to end shift for staff ${userId}:`, error.message);
        }
      }

      // For now, just return success
      // In the future, this could implement token blacklisting
      // by storing revoked tokens in a blacklist table or Redis
      return {
        message: 'Logout successful'
      };
    } catch (error) {
      throw new AppError(`Logout failed: ${error.message}`, 500);
    }
  }

  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @returns {object} User profile without password
   */
  static async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Return user without password hash
      const { passwordHash, ...userProfile } = user;
      return userProfile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to get user profile: ${error.message}`, 500);
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {object} Updated user profile
   */
  static async updateUserProfile(userId, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated via this method
      const { passwordHash, role, ...safeUpdateData } = updateData;

      const updatedUser = await User.updateById(userId, safeUpdateData);
      
      // Return user without password hash
      const { passwordHash: _, ...userProfile } = updatedUser;
      return userProfile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to update user profile: ${error.message}`, 500);
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {object} Success message
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get user with password hash
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(`New password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password in database
      await User.updateById(userId, { passwordHash: newPasswordHash });

      return {
        message: 'Password changed successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Password change failed: ${error.message}`, 500);
    }
  }
}

module.exports = AuthService;