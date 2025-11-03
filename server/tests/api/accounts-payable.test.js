const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, truncateTable, executeQuery } = require('../setup');

describe('Accounts Payable API Tests', () => {
  
  let adminToken, staffToken, patientToken;
  let payableId, entityId;
  
  beforeAll(async () => {
    await truncateTable('Users');
    await truncateTable('External_Entities');
    await truncateTable('Accounts_Payable');
    
    const admin = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = admin.accessToken;
    
    const staff = await createTestUser('staff', { email: 'staff@test.com' });
    staffToken = staff.accessToken;
    
    const patient = await createTestUser('patient', { email: 'patient@test.com' });
    patientToken = patient.accessToken;
    
    // Create external entity for testing
    const [entity] = await executeQuery(
      'INSERT INTO External_Entities (name, type, contact_info) VALUES (?, ?, ?)',
      ['Test Supplier', 'supplier', JSON.stringify({ phone: '123-456-7890' })]
    );
    entityId = entity.insertId;
  });
  
  describe('POST /api/accounts-payable', () => {
    
    test('should create a new payable as admin', async () => {
      const payableData = {
        entity_id: entityId,
        reference_code: 'INV-2024-001',
        description: 'Medical supplies purchase',
        total_amount: 5000.00,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Monthly supply order'
      };
      
      const response = await request(app)
        .post('/api/accounts-payable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payableData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.payable).toHaveProperty('id');
      expect(response.body.data.payable.reference_code).toBe(payableData.reference_code);
      expect(response.body.data.payable.total_amount).toBe(payableData.total_amount);
      
      payableId = response.body.data.payable.id;
    });
    
    test('should fail to create payable without authentication', async () => {
      const payableData = {
        entity_id: entityId,
        reference_code: 'INV-2024-002',
        description: 'Test',
        total_amount: 1000.00,
        due_date: new Date().toISOString()
      };
      
      await request(app)
        .post('/api/accounts-payable')
        .send(payableData)
        .expect(401);
    });
    
    test('should fail to create payable as patient', async () => {
      const payableData = {
        entity_id: entityId,
        reference_code: 'INV-2024-003',
        description: 'Unauthorized',
        total_amount: 500.00,
        due_date: new Date().toISOString()
      };
      
      await request(app)
        .post('/api/accounts-payable')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(payableData)
        .expect(403);
    });
    
    test('should fail with missing required fields', async () => {
      const payableData = {
        entity_id: entityId
        // Missing required fields
      };
      
      await request(app)
        .post('/api/accounts-payable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payableData)
        .expect(400);
    });
    
    test('should fail with invalid entity_id', async () => {
      const payableData = {
        entity_id: 99999,
        reference_code: 'INV-2024-004',
        description: 'Invalid entity',
        total_amount: 100.00,
        due_date: new Date().toISOString()
      };
      
      await request(app)
        .post('/api/accounts-payable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payableData)
        .expect(404);
    });
    
  });
  
  describe('GET /api/accounts-payable', () => {
    
    test('should get all payables as admin', async () => {
      const response = await request(app)
        .get('/api/accounts-payable')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.payables).toBeDefined();
      expect(Array.isArray(response.body.data.payables)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });
    
    test('should filter payables by status', async () => {
      const response = await request(app)
        .get('/api/accounts-payable?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should filter payables by entity', async () => {
      const response = await request(app)
        .get(`/api/accounts-payable?entity_id=${entityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should support date range filtering', async () => {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/accounts-payable?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/accounts-payable?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
    });
    
    test('should fail to get payables as patient', async () => {
      await request(app)
        .get('/api/accounts-payable')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
    });
    
  });
  
  describe('GET /api/accounts-payable/:id', () => {
    
    test('should get payable by ID as admin', async () => {
      const response = await request(app)
        .get(`/api/accounts-payable/${payableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.payable.id).toBe(payableId);
    });
    
    test('should fail with invalid payable ID', async () => {
      await request(app)
        .get('/api/accounts-payable/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
  });
  
  describe('PUT /api/accounts-payable/:id', () => {
    
    test('should update payable as admin', async () => {
      const updateData = {
        description: 'Updated description',
        total_amount: 5500.00,
        notes: 'Updated notes'
      };
      
      const response = await request(app)
        .put(`/api/accounts-payable/${payableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.payable.total_amount).toBe(updateData.total_amount);
    });
    
    test('should fail to update payable as staff', async () => {
      const updateData = {
        total_amount: 6000.00
      };
      
      await request(app)
        .put(`/api/accounts-payable/${payableId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData)
        .expect(403);
    });
    
  });
  
  describe('PUT /api/accounts-payable/:id/mark-paid', () => {
    
    test('should mark payable as paid as admin', async () => {
      const paymentData = {
        payment_date: new Date().toISOString(),
        payment_method: 'bank_transfer',
        transaction_reference: 'TXN-12345',
        notes: 'Payment completed'
      };
      
      const response = await request(app)
        .put(`/api/accounts-payable/${payableId}/mark-paid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(paymentData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.payable.status).toBe('paid');
    });
    
    test('should fail to mark paid as patient', async () => {
      const paymentData = {
        payment_date: new Date().toISOString(),
        payment_method: 'cash'
      };
      
      await request(app)
        .put(`/api/accounts-payable/${payableId}/mark-paid`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(paymentData)
        .expect(403);
    });
    
  });
  
  describe('DELETE /api/accounts-payable/:id', () => {
    
    test('should delete payable as admin', async () => {
      const response = await request(app)
        .delete(`/api/accounts-payable/${payableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    test('should fail to delete payable as staff', async () => {
      await request(app)
        .delete(`/api/accounts-payable/${payableId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
    
  });
  
});
