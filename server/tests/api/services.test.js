const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, truncateTable, executeQuery } = require('../setup');

describe('Services API Tests', () => {
  
  let adminToken, staffToken, patientToken;
  let serviceId;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('Services');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const staff = await createTestUser('staff', { email: 'staff@test.com' });
    staffToken = staff.accessToken;
    
    const patient = await createTestUser('patient', { email: 'patient@test.com' });
    patientToken = patient.accessToken;
  });
  
  describe('POST /api/services', () => {
    
    test('should create a new service as admin', async () => {
      const serviceData = {
        name: 'Blood Test',
        description: 'Complete blood count test',
        price: 50.00,
        service_category: 'laboratory',
        is_active: true
      };
      
      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(serviceData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toHaveProperty('id');
      expect(response.body.data.service.name).toBe(serviceData.name);
      expect(response.body.data.service.price).toBe(serviceData.price);
      
      serviceId = response.body.data.service.id;
    });
    
    test('should fail to create service without authentication', async () => {
      const serviceData = {
        name: 'X-Ray',
        description: 'Chest X-Ray',
        price: 100.00,
        service_category: 'radiology'
      };
      
      await request(app)
        .post('/api/services')
        .send(serviceData)
        .expect(401);
    });
    
    test('should fail to create service as patient', async () => {
      const serviceData = {
        name: 'MRI Scan',
        description: 'Brain MRI',
        price: 500.00,
        service_category: 'radiology'
      };
      
      await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(serviceData)
        .expect(403);
    });
    
    test('should fail with missing required fields', async () => {
      const serviceData = {
        name: 'Incomplete Service'
        // Missing price and service_category
      };
      
      await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(serviceData)
        .expect(400);
    });
    
  });
  
  describe('GET /api/services', () => {
    
    test('should get all services as admin', async () => {
      const response = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(Array.isArray(response.body.data.services)).toBe(true);
    });
    
    test('should get active services without authentication', async () => {
      const response = await request(app)
        .get('/api/services/active')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toBeDefined();
    });
    
    test('should filter services by category', async () => {
      const response = await request(app)
        .get('/api/services?category=laboratory')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toBeDefined();
    });
    
    test('should filter services by price range', async () => {
      const response = await request(app)
        .get('/api/services?min_price=10&max_price=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toBeDefined();
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/services?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });
    
  });
  
  describe('GET /api/services/:id', () => {
    
    test('should get service by ID', async () => {
      const response = await request(app)
        .get(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.service.id).toBe(serviceId);
    });
    
    test('should fail with invalid service ID', async () => {
      await request(app)
        .get('/api/services/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/services/:id', () => {
    
    test('should update service as admin', async () => {
      const updateData = {
        name: 'Updated Blood Test',
        price: 75.00,
        description: 'Updated description'
      };
      
      const response = await request(app)
        .put(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.service.name).toBe(updateData.name);
      expect(response.body.data.service.price).toBe(updateData.price);
    });
    
    test('should fail to update service as patient', async () => {
      const updateData = {
        price: 100.00
      };
      
      await request(app)
        .put(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('DELETE /api/services/:id', () => {
    
    test('should deactivate service as admin', async () => {
      const response = await request(app)
        .delete(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to delete service as staff', async () => {
      await request(app)
        .delete(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
});
