const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, createTestPatient, truncateTable, executeQuery } = require('../setup');

describe('Admin Analytics API Tests', () => {
  
  let adminToken, superAdminToken, staffToken, patientToken;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('Patients');
    await truncateTable('Invoices');
    await truncateTable('Appointments');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const superAdmin = await createTestUser('super_admin', { email: 'superadmin@test.com' });
    superAdminToken = superAdmin.accessToken;
    
    const staff = await createTestUser('staff', { email: 'staff@test.com' });
    staffToken = staff.accessToken;
    
    const patient = await createTestPatient({ email: 'patient@test.com' });
    patientToken = patient.user.accessToken;
  });
  
  describe('GET /api/admin/dashboard/stats', () => {
    
    test('should get dashboard statistics as admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('totalPatients');
      expect(response.body.data).toHaveProperty('totalAppointments');
      expect(response.body.data).toHaveProperty('totalRevenue');
    });
    
    test('should get dashboard statistics as super admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to get dashboard stats without authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .expect(401);
    });
    
    test('should fail to get dashboard stats as patient', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
    
    test('should fail to get dashboard stats as staff', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/admin/analytics/revenue', () => {
    
    test('should get revenue analytics for daily period', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('revenue');
      expect(Array.isArray(response.body.data.revenue)).toBe(true);
    });
    
    test('should get revenue analytics for weekly period', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=weekly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should get revenue analytics for monthly period', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=monthly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should get revenue analytics for yearly period', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue?period=yearly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should default to monthly if no period specified', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to get revenue analytics as patient', async () => {
      await request(app)
        .get('/api/admin/analytics/revenue')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/admin/analytics/user-activity', () => {
    
    test('should get user activity analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/user-activity?period=weekly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activity');
    });
    
    test('should support different time periods', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/user-activity?period=daily')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to get activity analytics as staff', async () => {
      await request(app)
        .get('/api/admin/analytics/user-activity')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/admin/analytics/appointments', () => {
    
    test('should get appointment analytics', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/appointments?period=monthly')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
    
    test('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/admin/analytics/appointments?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
  });
  
  describe('GET /api/admin/users', () => {
    
    test('should get all users as admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });
    
    test('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=patient')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should search users by name or email', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=patient')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });
    
    test('should fail to get users as patient', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/admin/users/:id', () => {
    
    let userId;
    
    beforeAll(async () => {
      const patient = await createTestPatient({ email: 'testuser@test.com' });
      userId = patient.user.id;
    });
    
    test('should get user by ID as admin', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
    });
    
    test('should fail with invalid user ID', async () => {
      await request(app)
        .get('/api/admin/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/admin/users/:id', () => {
    
    let userId;
    
    beforeAll(async () => {
      const patient = await createTestPatient({ email: 'updateuser@test.com' });
      userId = patient.user.id;
    });
    
    test('should update user as admin', async () => {
      const updateData = {
        full_name: 'Updated Name',
        is_active: true
      };
      
      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to update user as staff', async () => {
      const updateData = {
        full_name: 'Unauthorized Update'
      };
      
      await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('POST /api/admin/users', () => {
    
    test('should create user as admin', async () => {
      const userData = {
        email: 'newadminuser@test.com',
        password: 'Test@123456',
        full_name: 'New Admin User',
        phone_number: '1234567890',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
    });
    
    test('should fail to create user as patient', async () => {
      const userData = {
        email: 'forbidden@test.com',
        password: 'Test@123456',
        full_name: 'Forbidden User',
        role: 'admin'
      };
      
      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(userData)
        .expect(403);
    });
    
  });
  
});
