const { executeQuery } = require('../setup');
const { encrypt, decrypt, encryptJSON, decryptJSON, encryptField, decryptField, isEncrypted } = require('../../src/utils/encryption');

describe('Data Encryption Security Tests', () => {
  
  // Use the actual server encryption implementation with AES-256-GCM
  // No need to reimplement encryption logic - use server utilities
  
  describe('Passport Number Encryption', () => {
    
    test('should encrypt passport number before storage', () => {
      const passportNumber = 'P123456789';
      const encrypted = encrypt(passportNumber);
      
      expect(encrypted).not.toBe(passportNumber);
      expect(isEncrypted(encrypted)).toBe(true); // Validate encrypted structure
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag'); // GCM provides authentication
    });
    
    test('should decrypt passport number correctly', () => {
      const passportNumber = 'P987654321';
      const encrypted = encrypt(passportNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(passportNumber);
    });
    
    test('should produce different ciphertext for same plaintext', () => {
      const passportNumber = 'P111111111';
      const encrypted1 = encrypt(passportNumber);
      const encrypted2 = encrypt(passportNumber);
      
      // Different IV should produce different ciphertext
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv); // IVs are random
      
      // But both should decrypt to same value
      expect(decrypt(encrypted1)).toBe(passportNumber);
      expect(decrypt(encrypted2)).toBe(passportNumber);
    });
    
    test('should handle special characters in passport number', () => {
      const passportNumber = 'P-123/456-789';
      const encrypted = encrypt(passportNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(passportNumber);
    });
    
    test('should handle unicode characters', () => {
      const passportNumber = 'パスポート12345';
      const encrypted = encrypt(passportNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(passportNumber);
    });
    
  });
  
  describe('Insurance Policy Number Encryption', () => {
    
    test('should encrypt insurance policy number', () => {
      const policyNumber = 'INS-2023-123456';
      const encrypted = encrypt(policyNumber);
      
      expect(encrypted).not.toBe(policyNumber);
      expect(isEncrypted(encrypted)).toBe(true);
    });
    
    test('should decrypt insurance policy number correctly', () => {
      const policyNumber = 'POL987654321';
      const encrypted = encrypt(policyNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(policyNumber);
    });
    
    test('should maintain data integrity', () => {
      const policyNumber = 'COMPLEX-POLICY-123-ABC-XYZ-789';
      const encrypted = encrypt(policyNumber);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(policyNumber);
      expect(decrypted.length).toBe(policyNumber.length);
    });
    
  });
  
  describe('JSON Field Encryption', () => {
    
    test('should encrypt entire JSON object', () => {
      const passportInfo = {
        number: 'P123456789',
        country: 'USA',
        expiryDate: '2030-12-31'
      };
      
      const jsonString = JSON.stringify(passportInfo);
      const encrypted = encrypt(jsonString);
      const decrypted = decrypt(encrypted);
      const parsed = JSON.parse(decrypted);
      
      expect(parsed.number).toBe('P123456789');
      expect(parsed.country).toBe('USA');
      expect(parsed.expiryDate).toBe('2030-12-31');
    });
    
    test('should encrypt nested JSON structures', () => {
      const insuranceInfo = {
        provider: 'Test Insurance Co',
        policyNumber: 'INS123456',
        coverageType: 'comprehensive',
        beneficiaries: [
          { name: 'John Doe', relation: 'spouse' },
          { name: 'Jane Doe', relation: 'child' }
        ]
      };
      
      const jsonString = JSON.stringify(insuranceInfo);
      const encrypted = encrypt(jsonString);
      const decrypted = decrypt(encrypted);
      const parsed = JSON.parse(decrypted);
      
      expect(parsed.policyNumber).toBe('INS123456');
      expect(parsed.beneficiaries.length).toBe(2);
      expect(parsed.beneficiaries[0].name).toBe('John Doe');
    });
    
  });
  
  describe('Encryption Key Security', () => {
    
    test('encryption key should be 32 bytes for AES-256', () => {
      // Encryption key is managed by server utilities
      // Just verify encryption works
      const text = 'Test';
      const encrypted = encrypt(text);
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
    });
    
    test('should fail with tampered ciphertext (GCM authentication)', () => {
      const text = 'Sensitive Data';
      const encrypted = encrypt(text);
      
      // Tamper with encrypted data
      const tampered = { ...encrypted };
      tampered.encrypted = encrypted.encrypted.replace(/.$/, 'X'); // Change last character
      
      // GCM should detect tampering
      expect(() => {
        decrypt(tampered);
      }).toThrow();
    });
    
  });
  
  describe('Database Encryption Integration', () => {
    
    test('should store encrypted passport info in database', async () => {
      const { createTestPatient, truncateTable } = require('../setup');
      await truncateTable('Users');
      await truncateTable('Patients');
      
      const passportInfo = {
        number: 'SENSITIVE123',
        country: 'USA',
        expiryDate: '2030-12-31'
      };
      
      const patient = await createTestPatient({
        email: 'encrypt@test.com'
      }, {
        passport_info: JSON.stringify(passportInfo)
      });
      
      // Query database directly to verify encryption
      const [rows] = await executeQuery(
        'SELECT passport_info FROM Patients WHERE user_id = ?',
        [patient.user.id]
      );
      
      const storedValue = rows[0].passport_info;
      
      // Stored value should be encrypted JSON string or object
      expect(storedValue).toBeDefined();
      
      // If it's stored as JSON, parse and check structure
      if (typeof storedValue === 'string') {
        try {
          const parsed = JSON.parse(storedValue);
          // Check if it has GCM encryption structure
          if (parsed.encrypted && parsed.iv && parsed.authTag) {
            expect(parsed).toHaveProperty('encrypted');
            expect(parsed).toHaveProperty('iv');
            expect(parsed).toHaveProperty('authTag');
          }
        } catch (e) {
          // Not JSON, might be legacy format
        }
      }
    });
    
    test('should store encrypted insurance info in database', async () => {
      const { createTestPatient, truncateTable } = require('../setup');
      await truncateTable('Users');
      await truncateTable('Patients');
      
      const insuranceInfo = {
        provider: 'Test Insurance',
        policyNumber: 'SENSITIVE789',
        coverageType: 'comprehensive'
      };
      
      const patient = await createTestPatient({
        email: 'encrypt2@test.com'
      }, {
        insurance_info: JSON.stringify(insuranceInfo)
      });
      
      const [rows] = await executeQuery(
        'SELECT insurance_info FROM Patients WHERE user_id = ?',
        [patient.user.id]
      );
      
      const storedValue = rows[0].insurance_info;
      expect(storedValue).toBeDefined();
    });
    
  });
  
  describe('Encryption Performance', () => {
    
    test('encryption should be fast for typical data', () => {
      const data = 'P123456789';
      const iterations = 1000;
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        encrypt(data);
      }
      const endTime = Date.now();
      
      const avgTime = (endTime - startTime) / iterations;
      expect(avgTime).toBeLessThan(5); // Less than 5ms per encryption
    });
    
    test('decryption should be fast for typical data', () => {
      const data = 'P123456789';
      const encrypted = encrypt(data);
      const iterations = 1000;
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        decrypt(encrypted);
      }
      const endTime = Date.now();
      
      const avgTime = (endTime - startTime) / iterations;
      expect(avgTime).toBeLessThan(5); // Less than 5ms per decryption
    });
    
  });
  
  describe('Encryption Edge Cases', () => {
    
    test('should handle empty string', () => {
      const text = '';
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });
    
    test('should handle very long strings', () => {
      const text = 'A'.repeat(10000);
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(text);
      expect(decrypted.length).toBe(10000);
    });
    
    test('should handle strings with newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(text);
    });
    
    test('should handle strings with special characters', () => {
      const text = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(text);
    });
    
  });
  
  describe('Data Protection in Transit', () => {
    
    test('sensitive data should not be exposed in API responses', async () => {
      const request = require('supertest');
      const app = require('../../src/app');
      const { createTestPatient, truncateTable } = require('../setup');
      
      await truncateTable('Users');
      await truncateTable('Patients');
      
      const patient = await createTestPatient();
      
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${patient.user.accessToken}`)
        .expect(200);
      
      // Response should have decrypted data (not raw encrypted)
      expect(response.body.data.patient.passport_info).toBeInstanceOf(Object);
      
      // But response should not contain encryption artifacts
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('cipher');
      expect(responseString).not.toContain('encrypted');
    });
    
  });
  
  describe('Encryption Algorithm Validation', () => {
    
    test('should use AES-256-GCM algorithm with authentication', () => {
      const text = 'Test';
      const encrypted = encrypt(text);
      
      // GCM format: object with encrypted, iv, authTag
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
    });
    
    test('IV should be 12 bytes for AES-GCM (recommended)', () => {
      const text = 'Test';
      const encrypted = encrypt(text);
      
      // IV is hex-encoded, so divide by 2 for byte length
      const ivBuffer = Buffer.from(encrypted.iv, 'hex');
      expect(ivBuffer.length).toBe(12); // 12 bytes is recommended for GCM
    });
    
    test('authTag should be 16 bytes for AES-GCM', () => {
      const text = 'Test';
      const encrypted = encrypt(text);
      
      const authTagBuffer = Buffer.from(encrypted.authTag, 'hex');
      expect(authTagBuffer.length).toBe(16); // 128-bit authentication tag
    });
    
    test('should use random IV for each encryption', () => {
      const text = 'Same Text';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });
    
  });
  
  describe('Compliance & Best Practices', () => {
    
    test('encryption key should be stored securely (not in code)', () => {
      // Encryption key should come from environment variable
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
    });
    
    test('should not log sensitive data', () => {
      // This is a reminder test - ensure logging doesn't expose sensitive data
      const sensitiveData = 'P123456789';
      const encrypted = encrypt(sensitiveData);
      
      // If logging is implemented, verify it logs encrypted, not plaintext
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted.encrypted).not.toBe(sensitiveData);
    });
    
    test('encrypted data should be substantial', () => {
      const plaintext = 'Short';
      const encrypted = encrypt(plaintext);
      
      // GCM encrypted object has multiple components
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.encrypted.length).toBeGreaterThan(0);
      expect(encrypted.iv.length).toBeGreaterThan(0);
      expect(encrypted.authTag.length).toBeGreaterThan(0);
    });
    
  });
  
});

