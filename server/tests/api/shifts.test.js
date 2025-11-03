const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, createTestStaff, truncateTable, executeQuery } = require('../setup');

describe('Staff Shifts API Tests', () => {
  
  let adminToken, staffToken, staffUserId;
  let shiftId;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('Staff_Members');
    await truncateTable('Staff_Shifts');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const staff = await createTestStaff({ email: 'staff@test.com' });
    staffToken = staff.user.accessToken;
    staffUserId = staff.user.id;
  });
  
  describe('POST /api/shifts', () => {
    
    test('should create a new shift as admin', async () => {
      const shiftData = {
        staff_user_id: staffUserId,
        shift_type: 'regular',
        shift_date: new Date().toISOString().split('T')[0],
        start_time: '08:00:00',
        end_time: '16:00:00',
        notes: 'Morning shift'
      };
      
      const response = await request(app)
        .post('/api/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shiftData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shift).toHaveProperty('id');
      expect(response.body.data.shift.shift_type).toBe(shiftData.shift_type);
      
      shiftId = response.body.data.shift.id;
    });
    
    test('should create overtime shift', async () => {
      const shiftData = {
        staff_user_id: staffUserId,
        shift_type: 'overtime',
        shift_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        start_time: '18:00:00',
        end_time: '22:00:00',
        notes: 'Evening overtime'
      };
      
      const response = await request(app)
        .post('/api/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shiftData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shift.shift_type).toBe('overtime');
    });
    
    test('should fail to create shift without authentication', async () => {
      const shiftData = {
        staff_user_id: staffUserId,
        shift_type: 'regular',
        shift_date: new Date().toISOString().split('T')[0],
        start_time: '08:00:00',
        end_time: '16:00:00'
      };
      
      await request(app)
        .post('/api/shifts')
        .send(shiftData)
        .expect(401);
    });
    
    test('should fail with missing required fields', async () => {
      const shiftData = {
        staff_user_id: staffUserId
        // Missing shift_date, start_time, end_time
      };
      
      await request(app)
        .post('/api/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(shiftData)
        .expect(400);
    });
    
  });
  
  describe('GET /api/shifts/me', () => {
    
    test('should get own shifts as staff', async () => {
      const response = await request(app)
        .get('/api/shifts/me')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shifts).toBeDefined();
      expect(Array.isArray(response.body.data.shifts)).toBe(true);
    });
    
    test('should filter own shifts by date range', async () => {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/shifts/me?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should filter own shifts by type', async () => {
      const response = await request(app)
        .get('/api/shifts/me?shift_type=regular')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
  });
  
  describe('GET /api/shifts/me/active', () => {
    
    test('should get active shift for staff', async () => {
      const response = await request(app)
        .get('/api/shifts/me/active')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('shift');
    });
    
  });
  
  describe('GET /api/shifts', () => {
    
    test('should get all shifts as admin', async () => {
      const response = await request(app)
        .get('/api/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shifts).toBeDefined();
      expect(response.body.data).toHaveProperty('pagination');
    });
    
    test('should filter shifts by staff member', async () => {
      const response = await request(app)
        .get(`/api/shifts?staff_user_id=${staffUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should filter shifts by date range', async () => {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/shifts?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/shifts?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });
    
  });
  
  describe('GET /api/shifts/:id', () => {
    
    test('should get shift by ID as admin', async () => {
      const response = await request(app)
        .get(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shift.id).toBe(shiftId);
    });
    
    test('should allow staff to view their own shift', async () => {
      const response = await request(app)
        .get(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail with invalid shift ID', async () => {
      await request(app)
        .get('/api/shifts/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/shifts/:id', () => {
    
    test('should update shift as admin', async () => {
      const updateData = {
        shift_type: 'regular',
        start_time: '09:00:00',
        end_time: '17:00:00',
        notes: 'Updated shift hours'
      };
      
      const response = await request(app)
        .put(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.shift.start_time).toBe(updateData.start_time);
    });
    
    test('should fail to update shift as regular staff', async () => {
      const updateData = {
        notes: 'Trying to update'
      };
      
      await request(app)
        .put(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('DELETE /api/shifts/:id', () => {
    
    test('should delete shift as admin', async () => {
      const response = await request(app)
        .delete(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to delete shift as staff', async () => {
      await request(app)
        .delete(`/api/shifts/${shiftId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/shifts/me/stats', () => {
    
    test('should get shift statistics for staff', async () => {
      const response = await request(app)
        .get('/api/shifts/me/stats')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });
    
    test('should support date range for statistics', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/shifts/me/stats?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
  });
  
});
