const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, createTestStaff, truncateTable } = require('../setup');

describe('Staff API Tests', () => {
  
  let adminToken, staffToken, patientToken;
  let staffMemberId;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('Staff_Members');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const staff = await createTestStaff({ email: 'staff@test.com' });
    staffToken = staff.user.accessToken;
    staffMemberId = staff.user.id;
    
    const patient = await createTestUser('patient', { email: 'patient@test.com' });
    patientToken = patient.accessToken;
  });
  
  describe('POST /api/staff', () => {
    
    test('should create a new staff member as admin', async () => {
      const staffData = {
        email: 'newstaff@test.com',
        password: 'Test@123456',
        full_name: 'New Staff Member',
        phone_number: '1234567890',
        staff_role: 'nurse',
        shift: 'morning',
        salary: 3000.00
      };
      
      const response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(staffData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff).toHaveProperty('id');
      expect(response.body.data.staff.staff_role).toBe(staffData.staff_role);
    });
    
    test('should fail to create staff without authentication', async () => {
      const staffData = {
        email: 'unauthorized@test.com',
        password: 'Test@123456',
        full_name: 'Unauthorized Staff',
        phone_number: '9999999999',
        staff_role: 'doctor'
      };
      
      await request(app)
        .post('/api/staff')
        .send(staffData)
        .expect(401);
    });
    
    test('should fail to create staff as patient', async () => {
      const staffData = {
        email: 'forbidden@test.com',
        password: 'Test@123456',
        full_name: 'Forbidden Staff',
        phone_number: '8888888888',
        staff_role: 'receptionist'
      };
      
      await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(staffData)
        .expect(403);
    });
    
    test('should fail with missing required fields', async () => {
      const staffData = {
        email: 'incomplete@test.com',
        password: 'Test@123456'
        // Missing full_name, staff_role, etc.
      };
      
      await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(staffData)
        .expect(400);
    });
    
  });
  
  describe('GET /api/staff', () => {
    
    test('should get all staff as admin', async () => {
      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff).toBeDefined();
      expect(Array.isArray(response.body.data.staff)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });
    
    test('should filter staff by role', async () => {
      const response = await request(app)
        .get('/api/staff?staff_role=nurse')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff).toBeDefined();
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/staff?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 5);
    });
    
    test('should search staff by name', async () => {
      const response = await request(app)
        .get('/api/staff?search=Staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to get staff as patient', async () => {
      await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/staff/:id', () => {
    
    test('should get staff member by ID as admin', async () => {
      const response = await request(app)
        .get(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff.id).toBe(staffMemberId);
    });
    
    test('should allow staff to view their own profile', async () => {
      const response = await request(app)
        .get(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff.id).toBe(staffMemberId);
    });
    
    test('should fail with invalid staff ID', async () => {
      await request(app)
        .get('/api/staff/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/staff/:id', () => {
    
    test('should update staff member as admin', async () => {
      const updateData = {
        full_name: 'Updated Staff Name',
        staff_role: 'senior_nurse',
        salary: 3500.00
      };
      
      const response = await request(app)
        .put(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff.full_name).toBe(updateData.full_name);
    });
    
    test('should fail to update staff as patient', async () => {
      const updateData = {
        salary: 5000.00
      };
      
      await request(app)
        .put(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('DELETE /api/staff/:id', () => {
    
    test('should deactivate staff member as admin', async () => {
      const response = await request(app)
        .delete(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to delete staff as non-admin', async () => {
      await request(app)
        .delete(`/api/staff/${staffMemberId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
});
