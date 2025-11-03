const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, truncateTable } = require('../setup');

describe('External Entities API Tests', () => {
  
  let adminToken, staffToken, patientToken;
  let entityId;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('External_Entities');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const staff = await createTestUser('staff', { email: 'staff@test.com' });
    staffToken = staff.accessToken;
    
    const patient = await createTestUser('patient', { email: 'patient@test.com' });
    patientToken = patient.accessToken;
  });
  
  describe('POST /api/external-entities', () => {
    
    test('should create a new external entity as admin', async () => {
      const entityData = {
        name: 'ABC Pharmacy',
        type: 'pharmacy',
        contact_info: {
          phone: '123-456-7890',
          email: 'abc@pharmacy.com',
          address: '123 Main St'
        }
      };
      
      const response = await request(app)
        .post('/api/external-entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(entityData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity).toHaveProperty('id');
      expect(response.body.data.entity.name).toBe(entityData.name);
      expect(response.body.data.entity.type).toBe(entityData.type);
      
      entityId = response.body.data.entity.id;
    });
    
    test('should create laboratory entity', async () => {
      const entityData = {
        name: 'City Lab',
        type: 'laboratory',
        contact_info: {
          phone: '555-0100',
          email: 'info@citylab.com'
        }
      };
      
      const response = await request(app)
        .post('/api/external-entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(entityData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity.type).toBe('laboratory');
    });
    
    test('should fail to create entity without authentication', async () => {
      const entityData = {
        name: 'Test Supplier',
        type: 'supplier',
        contact_info: { phone: '555-0200' }
      };
      
      await request(app)
        .post('/api/external-entities')
        .send(entityData)
        .expect(401);
    });
    
    test('should fail to create entity as patient', async () => {
      const entityData = {
        name: 'Patient Pharmacy',
        type: 'pharmacy',
        contact_info: { phone: '555-0300' }
      };
      
      await request(app)
        .post('/api/external-entities')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(entityData)
        .expect(403);
    });
    
    test('should fail with missing required fields', async () => {
      const entityData = {
        name: 'Incomplete Entity'
        // Missing type
      };
      
      await request(app)
        .post('/api/external-entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(entityData)
        .expect(400);
    });
    
  });
  
  describe('GET /api/external-entities', () => {
    
    test('should get all external entities as admin', async () => {
      const response = await request(app)
        .get('/api/external-entities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entities).toBeDefined();
      expect(Array.isArray(response.body.data.entities)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });
    
    test('should filter entities by type', async () => {
      const response = await request(app)
        .get('/api/external-entities?type=pharmacy')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entities).toBeDefined();
    });
    
    test('should search entities by name', async () => {
      const response = await request(app)
        .get('/api/external-entities?search=ABC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/external-entities?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
    });
    
    test('should allow staff to view entities', async () => {
      const response = await request(app)
        .get('/api/external-entities')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
  });
  
  describe('GET /api/external-entities/:id', () => {
    
    test('should get entity by ID as admin', async () => {
      const response = await request(app)
        .get(`/api/external-entities/${entityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity.id).toBe(entityId);
    });
    
    test('should fail with invalid entity ID', async () => {
      await request(app)
        .get('/api/external-entities/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/external-entities/:id', () => {
    
    test('should update entity as admin', async () => {
      const updateData = {
        name: 'Updated ABC Pharmacy',
        contact_info: {
          phone: '123-456-9999',
          email: 'updated@pharmacy.com'
        }
      };
      
      const response = await request(app)
        .put(`/api/external-entities/${entityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.entity.name).toBe(updateData.name);
    });
    
    test('should fail to update entity as patient', async () => {
      const updateData = {
        name: 'Unauthorized Update'
      };
      
      await request(app)
        .put(`/api/external-entities/${entityId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('DELETE /api/external-entities/:id', () => {
    
    test('should delete entity as admin', async () => {
      const response = await request(app)
        .delete(`/api/external-entities/${entityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to delete entity as staff', async () => {
      await request(app)
        .delete(`/api/external-entities/${entityId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
});
