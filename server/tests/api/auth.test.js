const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, createTestPartner, truncateTable } = require('../setup');

describe('Authentication API Tests', () => {
  
  describe('POST /api/auth/register', () => {
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Partners');
      await truncateTable('Patients');
    });
    
    test('should register a new patient successfully', async () => {
      const userData = {
        email: 'newpatient@test.com',
        password: 'Test@123456',
        full_name: 'New Patient',
        phone_number: '1234567890',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe('patient');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });
    
    test('should register a patient with referral code', async () => {
      // Create partner first
      const { user: partner } = await createTestPartner();
      const referralCode = partner.uuid; // Use UUID for referrals
      
      const userData = {
        email: 'referred@test.com',
        password: 'Test@123456',
        full_name: 'Referred Patient',
        phone_number: '9876543210',
        role: 'patient',
        referredBy: referralCode
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      expect(response.body.data.user.email).toBe(userData.email);
      
      // Verify referral was created
      // Note: This requires querying the database or exposing referral info
    });
    
    test('should fail with duplicate email', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'Test@123456',
        full_name: 'First User',
        phone_number: '1111111111',
        role: 'patient'
      };
      
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });
    
    test('should fail with weak password', async () => {
      const userData = {
        email: 'weakpass@test.com',
        password: '12345', // Too short, no special chars
        full_name: 'Weak Password',
        phone_number: '2222222222',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });
    
    test('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email', // Invalid format
        password: 'Test@123456',
        full_name: 'Invalid Email',
        phone_number: '3333333333',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });
    
    test('should fail with missing required fields', async () => {
      const userData = {
        email: 'incomplete@test.com',
        // Missing password, full_name, etc.
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should sanitize against SQL injection', async () => {
      const userData = {
        email: "'; DROP TABLE Users; --",
        password: 'Test@123456',
        full_name: "Robert'); DROP TABLE Users;--",
        phone_number: '4444444444',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should sanitize against XSS', async () => {
      const userData = {
        email: 'xss@test.com',
        password: 'Test@123456',
        full_name: '<script>alert("XSS")</script>',
        phone_number: '5555555555',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      if (response.status === 201) {
        expect(response.body.data.user.full_name).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });
    
  });
  
  describe('POST /api/auth/login', () => {
    
    let testUser;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('patient', {
        email: 'login@test.com',
        full_name: 'Login Test User'
      });
    });
    
    test('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'Test@123' // Default password from createTestUser
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user.email).toBe('login@test.com');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });
    
    test('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid');
    });
    
    test('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Test@123'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should fail for inactive user', async () => {
      // Create inactive user
      const inactiveUser = await createTestUser('patient', {
        email: 'inactive@test.com',
        is_active: false
      });
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@test.com',
          password: 'Test@123'
        })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inactive');
    });
    
    test('should create staff shift on login for staff role', async () => {
      const staff = await createTestUser('staff', {
        email: 'staff@test.com'
      });
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'staff@test.com',
          password: 'Test@123'
        })
        .expect(200);
      
      expect(response.body.data).toHaveProperty('shift');
      expect(response.body.data.shift).toHaveProperty('shift_start');
    });
    
    test('should rate limit after multiple failed attempts', async () => {
      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login@test.com',
            password: 'WrongPassword'
          });
      }
      
      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword'
        })
        .expect(429);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Too many');
    });
    
    test('should return valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'Test@123'
        })
        .expect(200);
      
      const jwt = require('jsonwebtoken');
      const token = response.body.data.accessToken;
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test_secret');
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded.email).toBe('login@test.com');
    });
    
  });
  
  describe('POST /api/auth/logout', () => {
    
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('staff', {
        email: 'logout@test.com'
      });
      authToken = testUser.accessToken;
    });
    
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Logged out');
    });
    
    test('should end staff shift on logout', async () => {
      // Login to create shift
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout@test.com',
          password: 'Test@123'
        });
      
      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('shift');
      expect(response.body.data.shift).toHaveProperty('shift_end');
    });
    
    test('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('POST /api/auth/refresh', () => {
    
    let testUser;
    let refreshToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('patient', {
        email: 'refresh@test.com'
      });
      refreshToken = testUser.refreshToken;
    });
    
    test('should refresh access token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.accessToken).not.toBe(testUser.accessToken);
    });
    
    test('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('GET /api/auth/me', () => {
    
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('patient', {
        email: 'me@test.com'
      });
      authToken = testUser.accessToken;
    });
    
    test('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('me@test.com');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });
    
    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('PUT /api/auth/profile', () => {
    
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('patient', {
        email: 'profile@test.com'
      });
      authToken = testUser.accessToken;
    });
    
    test('should update profile successfully', async () => {
      const updates = {
        full_name: 'Updated Name',
        phone_number: '9999999999'
      };
      
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.data.user.full_name).toBe(updates.full_name);
      expect(response.body.data.user.phone_number).toBe(updates.phone_number);
    });
    
    test('should not allow email update', async () => {
      const updates = {
        email: 'newemail@test.com'
      };
      
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });
    
    test('should not allow role update', async () => {
      const updates = {
        role: 'admin'
      };
      
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('role');
    });
    
  });
  
  describe('PUT /api/auth/password-change', () => {
    
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      testUser = await createTestUser('patient', {
        email: 'password@test.com'
      });
      authToken = testUser.accessToken;
    });
    
    test('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'Test@123',
        newPassword: 'NewTest@456'
      };
      
      const response = await request(app)
        .put('/api/auth/password-change')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Password changed');
      
      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'password@test.com',
          password: 'NewTest@456'
        })
        .expect(200);
      
      expect(loginResponse.body.data).toHaveProperty('accessToken');
    });
    
    test('should fail with incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewTest@456'
      };
      
      const response = await request(app)
        .put('/api/auth/password-change')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Current password');
    });
    
    test('should fail with weak new password', async () => {
      const passwordData = {
        currentPassword: 'Test@123',
        newPassword: 'weak'
      };
      
      const response = await request(app)
        .put('/api/auth/password-change')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('password');
    });
    
  });
  
});

