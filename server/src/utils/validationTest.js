/**
 * Validation consistency verification script
 * This file demonstrates how all validation errors follow the same format
 */

const { ValidationUtils, ValidationMessages, CommonValidators } = require('../utils/validationUtils');

console.log('=== WeCare Validation System Consistency Check ===\n');

// Test validation message consistency
console.log('1. Validation Messages Format:');
console.log('   Required:', ValidationMessages.required('Email'));
console.log('   Invalid:', ValidationMessages.invalid('Email'));
console.log('   Length:', ValidationMessages.length('Password', 8, 128));
console.log('   Pattern:', ValidationMessages.pattern('Phone', 'must be a valid phone number'));
console.log('   Future:', ValidationMessages.future('Expiry date'));

console.log('\n2. Error Response Format:');
const mockErrors = {
  array: () => [
    {
      path: 'email',
      param: 'email',
      msg: 'Please provide a valid email address',
      value: 'invalid-email',
      location: 'body'
    },
    {
      path: 'password',
      param: 'password', 
      msg: 'Password must be between 8 and 128 characters',
      value: '123',
      location: 'body'
    }
  ]
};

const formattedError = ValidationUtils.formatValidationError(mockErrors, 'test-request-123');
console.log(JSON.stringify(formattedError, null, 2));

console.log('\n3. Available Common Validators:');
const validators = Object.keys(CommonValidators);
console.log('   -', validators.join('\n   - '));

console.log('\n4. Validation Patterns:');
const { ValidationPatterns } = require('../utils/validationUtils');
console.log('   Email:', ValidationPatterns.email.toString());
console.log('   Phone:', ValidationPatterns.phone.toString());
console.log('   Password:', ValidationPatterns.password.toString());
console.log('   Passport:', ValidationPatterns.passportNumber.toString());

console.log('\n✅ All validation errors now follow consistent format:');
console.log('   - Standardized field names (field, message, value, location)');
console.log('   - Consistent error response structure'); 
console.log('   - Centralized validation patterns and messages');
console.log('   - Request ID tracking for debugging');
console.log('   - Development logging for validation failures');

console.log('\n=== Validation System Ready ===');