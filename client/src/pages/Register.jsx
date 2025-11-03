import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  validateEmail, 
  validatePassword, 
  validateFullName,
  validatePassportNumber,
  validatePassportExpiry,
  validateInsurancePolicyNumber,
  validateInsuranceExpiry,
  validateReferralCode
} from '../utils/validation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const Register = () => {
  // State management
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    phoneNumber: '',
    acceptTerms: false,
    // Patient-specific fields
    passportNumber: '',
    passportCountry: '',
    passportExpiryDate: '',
    passportIssueDate: '',
    passportPlaceOfIssue: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceCoverageType: '',
    insuranceExpiryDate: '',
    insuranceContactPhone: '',
    insuranceContactEmail: '',
    // Partner-specific fields
    partnerType: 'guide',
    companyName: '',
    businessLicense: '',
    address: ''
  });
  
  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Hooks
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract referral code from URL on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
    }
  }, [location.search]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Update password strength on password change
    if (name === 'password') {
      const strength = getPasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  // Get password strength
  const getPasswordStrength = (password) => {
    if (!password) return null;
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

    if (score < 3) return { level: 'weak', color: '#ff4444' };
    if (score < 5) return { level: 'medium', color: '#ffaa00' };
    return { level: 'strong', color: '#44ff44' };
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    const nameValidation = validateFullName(formData.fullName);
    if (!nameValidation.isValid) {
      newErrors.fullName = nameValidation.errors[0];
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Phone number validation (optional)
    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    // Patient-specific validation
    if (formData.role === 'patient') {
      // Passport number validation (required for patients)
      if (!formData.passportNumber) {
        newErrors.passportNumber = 'Passport number is required for patients';
      } else {
        const passportValidation = validatePassportNumber(formData.passportNumber);
        if (!passportValidation.isValid) {
          newErrors.passportNumber = passportValidation.errors[0];
        }
      }

      // Passport country validation (required for patients)
      if (!formData.passportCountry) {
        newErrors.passportCountry = 'Country of issue is required for patients';
      } else if (formData.passportCountry.length < 2 || formData.passportCountry.length > 100) {
        newErrors.passportCountry = 'Country must be 2-100 characters';
      }

      // Passport expiry date validation (required for patients)
      if (!formData.passportExpiryDate) {
        newErrors.passportExpiryDate = 'Passport expiry date is required for patients';
      } else {
        const expiryValidation = validatePassportExpiry(formData.passportExpiryDate);
        if (!expiryValidation.isValid) {
          newErrors.passportExpiryDate = expiryValidation.errors[0];
        }
      }

      // Passport issue date validation (optional but must be valid if provided)
      if (formData.passportIssueDate && new Date(formData.passportIssueDate) > new Date()) {
        newErrors.passportIssueDate = 'Passport issue date cannot be in the future';
      }

      // Insurance policy number validation (optional but must be valid if provided)
      if (formData.insurancePolicyNumber) {
        const policyValidation = validateInsurancePolicyNumber(formData.insurancePolicyNumber);
        if (!policyValidation.isValid) {
          newErrors.insurancePolicyNumber = policyValidation.errors[0];
        }
      }

      // Insurance expiry date validation (optional but must be valid if provided)
      if (formData.insuranceExpiryDate) {
        const insuranceExpiryValidation = validateInsuranceExpiry(formData.insuranceExpiryDate);
        if (!insuranceExpiryValidation.isValid) {
          newErrors.insuranceExpiryDate = insuranceExpiryValidation.errors[0];
        }
      }

      // Insurance contact phone validation (optional but must be valid if provided)
      if (formData.insuranceContactPhone && !/^\+?[\d\s-()]{10,20}$/.test(formData.insuranceContactPhone)) {
        newErrors.insuranceContactPhone = 'Please enter a valid insurance contact phone number';
      }

      // Insurance contact email validation (optional but must be valid if provided)
      if (formData.insuranceContactEmail && !validateEmail(formData.insuranceContactEmail)) {
        newErrors.insuranceContactEmail = 'Please enter a valid insurance contact email';
      }
    }

    // Partner-specific validation
    if (formData.role === 'partner') {
      // Partner type validation (required)
      if (!formData.partnerType) {
        newErrors.partnerType = 'Partner type is required';
      } else if (!['guide', 'driver', 'hotel', 'villa', 'guest_house', 'other'].includes(formData.partnerType)) {
        newErrors.partnerType = 'Please select a valid partner type';
      }

      // Company name validation (optional but must be valid if provided)
      if (formData.companyName && (formData.companyName.length < 2 || formData.companyName.length > 200)) {
        newErrors.companyName = 'Company name must be between 2 and 200 characters';
      }

      // Business license validation (optional but must be valid if provided)
      if (formData.businessLicense && formData.businessLicense.length > 100) {
        newErrors.businessLicense = 'Business license must not exceed 100 characters';
      }

      // Address validation (optional but must be valid if provided)
      if (formData.address && formData.address.length > 500) {
        newErrors.address = 'Address must not exceed 500 characters';
      }
    }

    // Terms acceptance validation
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        phoneNumber: formData.phoneNumber.trim() || null
      };

      // Add patient-specific data if role is patient
      if (formData.role === 'patient') {
        // Passport information (required for patients)
        registrationData.passportInfo = {
          number: formData.passportNumber.trim(),
          country: formData.passportCountry.trim(),
          expiryDate: formData.passportExpiryDate,
          issueDate: formData.passportIssueDate || null,
          placeOfIssue: formData.passportPlaceOfIssue.trim() || null
        };

        // Insurance information (optional)
        if (formData.insuranceProvider || formData.insurancePolicyNumber) {
          registrationData.insuranceInfo = {
            provider: formData.insuranceProvider.trim() || null,
            policyNumber: formData.insurancePolicyNumber.trim() || null,
            coverageType: formData.insuranceCoverageType || null,
            expiryDate: formData.insuranceExpiryDate || null,
            contactInfo: {
              phone: formData.insuranceContactPhone.trim() || null,
              email: formData.insuranceContactEmail.trim() || null,
              emergencyHotline: null // Can be added later
            }
          };
        }
      }

      // Add partner-specific data if role is partner
      if (formData.role === 'partner') {
        registrationData.partnerType = formData.partnerType;
        registrationData.companyName = formData.companyName.trim() || null;
        registrationData.businessLicense = formData.businessLicense.trim() || null;
        registrationData.address = formData.address.trim() || null;
      }

      const result = await register(registrationData, referralCode);

      if (result.success) {
        // Successful registration, navigate to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        // Registration failed, show error
        setErrors({
          general: result.error || 'Registration failed. Please try again.'
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({
        general: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else if (field === 'confirmPassword') {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Checking authentication..." />;
  }

  return (
    <div className="auth-container">
      <div className="auth-card register-card">
        <div className="auth-header">
          <h1>Join WeCare</h1>
          <p>Create your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* General Error Message */}
          {errors.general && (
            <ErrorMessage 
              message={errors.general} 
              type="error"
              onClose={() => setErrors(prev => ({ ...prev, general: '' }))}
            />
          )}

          {/* Full Name Field */}
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={errors.fullName ? 'error' : ''}
              placeholder="Enter your full name"
              required
              autoComplete="name"
            />
            {errors.fullName && (
              <span className="error-text">{errors.fullName}</span>
            )}
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
            {errors.email && (
              <span className="error-text">{errors.email}</span>
            )}
          </div>

          {/* Role Selection */}
          <div className="form-group">
            <label htmlFor="role">I am a *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={errors.role ? 'error' : ''}
              required
            >
              <option value="patient">Patient</option>
              <option value="partner">Partner (Guide/Driver)</option>
            </select>
            {errors.role && (
              <span className="error-text">{errors.role}</span>
            )}
          </div>

          {/* Phone Number Field */}
          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={errors.phoneNumber ? 'error' : ''}
              placeholder="Enter your phone number (optional)"
              autoComplete="tel"
            />
            {errors.phoneNumber && (
              <span className="error-text">{errors.phoneNumber}</span>
            )}
          </div>

          {/* Referral Code Display (if present) */}
          {referralCode && (
            <div className="referral-notice">
              <div className="referral-icon">🎉</div>
              <div className="referral-text">
                <strong>You were referred by a partner!</strong>
                <br />
                <span>Referral Code: {referralCode}</span>
              </div>
            </div>
          )}

          {/* Partner-specific fields */}
          {formData.role === 'partner' && (
            <div className="partner-section">
              <h3 className="section-title">Partner Information</h3>
              
              <div className="form-group">
                <label htmlFor="partnerType">Partner Type *</label>
                <select
                  id="partnerType"
                  name="partnerType"
                  value={formData.partnerType}
                  onChange={handleChange}
                  className={errors.partnerType ? 'error' : ''}
                  required
                >
                  <option value="guide">Guide</option>
                  <option value="driver">Driver</option>
                  <option value="hotel">Hotel</option>
                  <option value="villa">Villa</option>
                  <option value="guest_house">Guest House</option>
                  <option value="other">Other</option>
                </select>
                {errors.partnerType && (
                  <span className="error-text">{errors.partnerType}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="companyName">Company Name</label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className={errors.companyName ? 'error' : ''}
                  placeholder="Enter your company name (optional)"
                />
                {errors.companyName && (
                  <span className="error-text">{errors.companyName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="businessLicense">Business License</label>
                <input
                  type="text"
                  id="businessLicense"
                  name="businessLicense"
                  value={formData.businessLicense}
                  onChange={handleChange}
                  className={errors.businessLicense ? 'error' : ''}
                  placeholder="Enter your business license number (optional)"
                />
                {errors.businessLicense && (
                  <span className="error-text">{errors.businessLicense}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="address">Business Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={errors.address ? 'error' : ''}
                  placeholder="Enter your business address (optional)"
                  rows="3"
                />
                {errors.address && (
                  <span className="error-text">{errors.address}</span>
                )}
              </div>

              <div className="partner-info">
                <p className="info-text">
                  <strong>Note:</strong> Partner applications are subject to review and approval. 
                  You'll be notified via email once your application is processed.
                </p>
              </div>
            </div>
          )}

          {/* Patient-specific fields */}
          {formData.role === 'patient' && (
            <>
              {/* Passport Information Section */}
              <div className="patient-section">
                <h3 className="section-title">Passport Information</h3>
                
                <div className="form-group">
                  <label htmlFor="passportNumber">Passport Number *</label>
                  <input
                    type="text"
                    id="passportNumber"
                    name="passportNumber"
                    value={formData.passportNumber}
                    onChange={handleChange}
                    className={errors.passportNumber ? 'error' : ''}
                    placeholder="Enter passport number"
                    required
                  />
                  {errors.passportNumber && (
                    <span className="error-text">{errors.passportNumber}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="passportCountry">Country of Issue *</label>
                  <input
                    type="text"
                    id="passportCountry"
                    name="passportCountry"
                    value={formData.passportCountry}
                    onChange={handleChange}
                    className={errors.passportCountry ? 'error' : ''}
                    placeholder="Enter country of issue"
                    required
                  />
                  {errors.passportCountry && (
                    <span className="error-text">{errors.passportCountry}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="passportExpiryDate">Expiry Date *</label>
                  <input
                    type="date"
                    id="passportExpiryDate"
                    name="passportExpiryDate"
                    value={formData.passportExpiryDate}
                    onChange={handleChange}
                    className={errors.passportExpiryDate ? 'error' : ''}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                  {errors.passportExpiryDate && (
                    <span className="error-text">{errors.passportExpiryDate}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="passportIssueDate">Issue Date</label>
                  <input
                    type="date"
                    id="passportIssueDate"
                    name="passportIssueDate"
                    value={formData.passportIssueDate}
                    onChange={handleChange}
                    className={errors.passportIssueDate ? 'error' : ''}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.passportIssueDate && (
                    <span className="error-text">{errors.passportIssueDate}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="passportPlaceOfIssue">Place of Issue</label>
                  <input
                    type="text"
                    id="passportPlaceOfIssue"
                    name="passportPlaceOfIssue"
                    value={formData.passportPlaceOfIssue}
                    onChange={handleChange}
                    className={errors.passportPlaceOfIssue ? 'error' : ''}
                    placeholder="Enter place of issue (optional)"
                  />
                  {errors.passportPlaceOfIssue && (
                    <span className="error-text">{errors.passportPlaceOfIssue}</span>
                  )}
                </div>
              </div>

              {/* Insurance Information Section */}
              <div className="patient-section">
                <h3 className="section-title">Insurance Information (Optional)</h3>
                
                <div className="form-group">
                  <label htmlFor="insuranceProvider">Insurance Provider</label>
                  <input
                    type="text"
                    id="insuranceProvider"
                    name="insuranceProvider"
                    value={formData.insuranceProvider}
                    onChange={handleChange}
                    className={errors.insuranceProvider ? 'error' : ''}
                    placeholder="Enter insurance provider name"
                  />
                  {errors.insuranceProvider && (
                    <span className="error-text">{errors.insuranceProvider}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="insurancePolicyNumber">Policy Number</label>
                  <input
                    type="text"
                    id="insurancePolicyNumber"
                    name="insurancePolicyNumber"
                    value={formData.insurancePolicyNumber}
                    onChange={handleChange}
                    className={errors.insurancePolicyNumber ? 'error' : ''}
                    placeholder="Enter policy number"
                  />
                  {errors.insurancePolicyNumber && (
                    <span className="error-text">{errors.insurancePolicyNumber}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="insuranceCoverageType">Coverage Type</label>
                  <select
                    id="insuranceCoverageType"
                    name="insuranceCoverageType"
                    value={formData.insuranceCoverageType}
                    onChange={handleChange}
                    className={errors.insuranceCoverageType ? 'error' : ''}
                  >
                    <option value="">Select coverage type</option>
                    <option value="comprehensive">Comprehensive</option>
                    <option value="basic">Basic</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  {errors.insuranceCoverageType && (
                    <span className="error-text">{errors.insuranceCoverageType}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="insuranceExpiryDate">Insurance Expiry Date</label>
                  <input
                    type="date"
                    id="insuranceExpiryDate"
                    name="insuranceExpiryDate"
                    value={formData.insuranceExpiryDate}
                    onChange={handleChange}
                    className={errors.insuranceExpiryDate ? 'error' : ''}
                  />
                  {errors.insuranceExpiryDate && (
                    <span className="error-text">{errors.insuranceExpiryDate}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="insuranceContactPhone">Contact Phone</label>
                  <input
                    type="tel"
                    id="insuranceContactPhone"
                    name="insuranceContactPhone"
                    value={formData.insuranceContactPhone}
                    onChange={handleChange}
                    className={errors.insuranceContactPhone ? 'error' : ''}
                    placeholder="Enter insurance contact phone"
                  />
                  {errors.insuranceContactPhone && (
                    <span className="error-text">{errors.insuranceContactPhone}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="insuranceContactEmail">Contact Email</label>
                  <input
                    type="email"
                    id="insuranceContactEmail"
                    name="insuranceContactEmail"
                    value={formData.insuranceContactEmail}
                    onChange={handleChange}
                    className={errors.insuranceContactEmail ? 'error' : ''}
                    placeholder="Enter insurance contact email"
                  />
                  {errors.insuranceContactEmail && (
                    <span className="error-text">{errors.insuranceContactEmail}</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Create a strong password"
                required
                autoComplete="new-password"
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('password')}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            {/* Password Strength Indicator */}
            {passwordStrength && (
              <div className="password-strength">
                <div 
                  className="strength-bar"
                  style={{ backgroundColor: passwordStrength.color }}
                ></div>
                <span className="strength-text">
                  Password strength: {passwordStrength.level}
                </span>
              </div>
            )}
            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className={errors.acceptTerms ? 'error' : ''}
              />
              <span className="checkmark"></span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="link">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="link">
                Privacy Policy
              </Link>
            </label>
            {errors.acceptTerms && (
              <span className="error-text">{errors.acceptTerms}</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="small" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign In
            </Link>
          </p>
        </div>

        {/* Additional Links */}
        <div className="auth-links">
          <Link to="/help" className="help-link">
            Need Help?
          </Link>
          <span className="separator">|</span>
          <Link to="/privacy" className="privacy-link">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;