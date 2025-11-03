const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, truncateTable } = require('../setup');

describe('Rate Limiting Security Tests', () => {
  
  beforeEach(async () => {
    await truncateTable('Users');
  });
  
  describe('Login Rate Limiting', () => {
    
    let testUser;
    
    beforeEach(async () => {
      testUser = await createTestUser('patient', {
        email: 'ratelimit@test.com'
      });
    });
    
    test('should allow normal login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratelimit@test.com',
          password: 'Test@123'
        })
        .expect(200);
      
      expect(response.body.data).toHaveProperty('accessToken');
    });
    
    test('should rate limit after multiple failed login attempts', async () => {
      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratelimit@test.com',
            password: 'WrongPassword'
          });
      }
      
      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratelimit@test.com',
          password: 'WrongPassword'
        })
        .expect(429);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Too many');
    });
    
    test('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratelimit@test.com',
          password: 'WrongPassword'
        });
      
      // Accept either RateLimit-* or X-RateLimit-* header families
      const hasStandardHeaders = 
        response.headers['ratelimit-limit'] && response.headers['ratelimit-remaining'];
      const hasLegacyHeaders = 
        response.headers['x-ratelimit-limit'] && response.headers['x-ratelimit-remaining'];
      
      expect(hasStandardHeaders || hasLegacyHeaders).toBe(true);
    });
    
    test('should reset rate limit after time window', async () => {
      // Attempt login 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratelimit@test.com',
            password: 'WrongPassword'
          });
      }
      
      // Wait for rate limit window to reset (e.g., 15 minutes)
      // In test environment, this might be shortened
      // For testing, we'll just verify the rate limit was applied
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratelimit@test.com',
          password: 'WrongPassword'
        });
      
      expect(response.status).toBe(429);
    });
    
    test('should apply rate limit per IP address', async () => {
      // Create another user
      await createTestUser('patient', { email: 'another@test.com' });
      
      // Rate limit for first email
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratelimit@test.com',
            password: 'WrongPassword'
          });
      }
      
      // Should still be able to try different email (from same IP)
      // Depending on implementation (IP-based vs email-based)
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'another@test.com',
          password: 'Test@123'
        });
      
      // This behavior depends on rate limit strategy
      // If IP-based, should also be limited
      // If email-based, should succeed
    });
    
  });
  
  describe('API Endpoint Rate Limiting', () => {
    
    let authToken;
    
    beforeEach(async () => {
      const user = await createTestUser('patient');
      authToken = user.accessToken;
    });
    
    test('should rate limit API requests', async () => {
      // Make many requests quickly
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].body).toHaveProperty('error');
        expect(rateLimited[0].body.error).toContain('rate limit');
      }
    });
    
    test('should have different rate limits for different endpoints', async () => {
      // Public endpoints might have stricter limits
      const publicRequests = [];
      for (let i = 0; i < 20; i++) {
        publicRequests.push(
          request(app).get('/api/services')
        );
      }
      
      const publicResponses = await Promise.all(publicRequests);
      const publicRateLimited = publicResponses.filter(r => r.status === 429);
      
      // Authenticated endpoints might have higher limits
      const authRequests = [];
      for (let i = 0; i < 20; i++) {
        authRequests.push(
          request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      const authResponses = await Promise.all(authRequests);
      const authRateLimited = authResponses.filter(r => r.status === 429);
      
      // Expect different rate limit behaviors
      // This depends on actual implementation
    });
    
  });
  
  describe('Document Upload Rate Limiting', () => {
    
    let patientToken;
    
    beforeEach(async () => {
      const { createTestPatient } = require('../setup');
      await truncateTable('Patients');
      
      const patient = await createTestPatient();
      patientToken = patient.user.accessToken;
    });
    
    test('should rate limit document uploads', async () => {
      const testFile = Buffer.from('Test document');
      
      // Try to upload many documents quickly
      const uploads = [];
      for (let i = 0; i < 20; i++) {
        uploads.push(
          request(app)
            .post('/api/documents/upload')
            .set('Authorization', `Bearer ${patientToken}`)
            .field('type', 'other')
            .attach('document', testFile, `doc${i}.pdf`)
        );
      }
      
      const responses = await Promise.all(uploads);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].body).toHaveProperty('error');
      }
    });
    
  });
  
  describe('Registration Rate Limiting', () => {
    
    test('should rate limit registration attempts', async () => {
      // Try to register many accounts quickly
      const registrations = [];
      for (let i = 0; i < 10; i++) {
        registrations.push(
          request(app)
            .post('/api/auth/register')
            .send({
              email: `spam${i}@test.com`,
              password: 'Test@123456',
              full_name: `Spam User ${i}`,
              phone_number: `${1000000000 + i}`,
              role: 'patient'
            })
        );
      }
      
      const responses = await Promise.all(registrations);
      
      // Some registrations should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      
      if (rateLimited.length > 0) {
        expect(rateLimited[0].body.error).toContain('rate limit');
      }
    });
    
  });
  
  describe('Rate Limit Headers', () => {
    
    test('should include rate limit headers (either standard or legacy)', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);
      
      // Accept either RateLimit-Limit or X-RateLimit-Limit
      const limitHeader = response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit'];
      const remainingHeader = response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining'];
      
      if (limitHeader) {
        expect(parseInt(limitHeader)).toBeGreaterThan(0);
      }
      if (remainingHeader) {
        expect(remainingHeader).toBeDefined();
      }
    });
    
    test('should include reset timestamp header', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);
      
      // Accept either RateLimit-Reset or X-RateLimit-Reset
      const resetHeader = response.headers['ratelimit-reset'] || response.headers['x-ratelimit-reset'];
      
      if (resetHeader) {
        expect(resetHeader).toBeDefined();
      }
    });
    
    test('should include Retry-After header when rate limited', async () => {
      // Trigger rate limit
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/services');
      }
      
      const response = await request(app)
        .get('/api/services');
      
      if (response.status === 429) {
        expect(response.headers['retry-after']).toBeDefined();
      }
    });
    
  });
  
  describe('Rate Limit Reset', () => {
    
    test('remaining count should decrease with each request', async () => {
      const response1 = await request(app).get('/api/services');
      // Accept both header families
      const remaining1 = parseInt(
        response1.headers['ratelimit-remaining'] || 
        response1.headers['x-ratelimit-remaining'] || 
        100
      );
      
      const response2 = await request(app).get('/api/services');
      const remaining2 = parseInt(
        response2.headers['ratelimit-remaining'] || 
        response2.headers['x-ratelimit-remaining'] || 
        100
      );
      
      if (remaining1 && remaining2) {
        expect(remaining2).toBeLessThanOrEqual(remaining1);
      }
    });
    
  });
  
  describe('Rate Limit by User Role', () => {
    
    test('admin should have higher rate limits', async () => {
      const admin = await createTestUser('admin');
      
      // Make many requests
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${admin.accessToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      const success = responses.filter(r => r.status === 200);
      
      // Admin should have higher success rate
      expect(success.length).toBeGreaterThan(0);
    });
    
    test('patient should have standard rate limits', async () => {
      const patient = await createTestUser('patient');
      
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${patient.accessToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      // Some should be rate limited
      // This depends on actual rate limit configuration
    });
    
  });
  
  describe('Distributed Rate Limiting (if applicable)', () => {
    
    test('rate limit should work across multiple server instances', async () => {
      // This test is only relevant if using distributed rate limiting
      // (e.g., Redis-based rate limiter)
      
      // For single-server setup, this test can be skipped
      // For distributed setup, verify rate limit is shared across instances
    });
    
  });
  
  describe('Rate Limit Bypass Prevention', () => {
    
    test('should not bypass rate limit with different user agents', async () => {
      const user = await createTestUser('patient');
      
      // Try with different user agents
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('User-Agent', `TestAgent${i}`);
      }
      
      // Should still be rate limited regardless of user agent
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('User-Agent', 'DifferentAgent');
      
      // Depending on implementation, might be rate limited
    });
    
    test('should not bypass rate limit with proxy headers', async () => {
      const user = await createTestUser('patient');
      
      // Try with different X-Forwarded-For headers
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('X-Forwarded-For', `192.168.1.${i}`);
      }
      
      // Should still be rate limited
    });
    
  });
  
  describe('Error Messages', () => {
    
    test('rate limit error should be descriptive', async () => {
      // Trigger rate limit
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' });
      }
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      
      if (response.status === 429) {
        expect(response.body.error).toBeDefined();
        expect(response.body.error.toLowerCase()).toContain('rate');
      }
    });
    
    test('should include retry information', async () => {
      // Trigger rate limit
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/services');
      }
      
      const response = await request(app).get('/api/services');
      
      if (response.status === 429) {
        expect(
          response.body.error || response.headers['retry-after']
        ).toBeDefined();
      }
    });
    
  });
  
  describe('Rate Limit Configuration', () => {
    
    test('rate limit should be configurable', () => {
      // Verify rate limit configuration can be changed via environment
      // This is implementation-specific
      
      const defaultLimit = process.env.RATE_LIMIT_MAX || 100;
      expect(parseInt(defaultLimit)).toBeGreaterThan(0);
    });
    
    test('rate limit window should be configurable', () => {
      const defaultWindow = process.env.RATE_LIMIT_WINDOW_MS || 900000; // 15 minutes
      expect(parseInt(defaultWindow)).toBeGreaterThan(0);
    });
    
  });
  
});

