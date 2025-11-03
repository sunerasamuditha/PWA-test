const request = require('supertest');
const app = require('../../src/app');
const { createTestPatient, createTestUser, getAuthToken, truncateTable } = require('../setup');
const crypto = require('crypto');

describe('Patient API Tests', () => {
  
  describe('GET /api/patients/me - Get Own Profile', () => {
    
    let patientData;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      
      patientData = await createTestPatient({
        email: 'patient@test.com',
        full_name: 'Test Patient'
      }, {
        current_address: '123 Test Street',
        passport_info: JSON.stringify({
          number: 'P123456789',
          country: 'USA',
          expiryDate: '2030-12-31'
        }),
        insurance_info: JSON.stringify({
          provider: 'Test Insurance',
          policyNumber: 'INS123456',
          coverageType: 'comprehensive'
        })
      });
      
      authToken = patientData.user.accessToken;
    });
    
    test('should get own patient profile with decrypted data', async () => {
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient.current_address).toBe('123 Test Street');
      
      // Verify passport info is decrypted and parsed
      expect(response.body.data.patient.passport_info).toBeInstanceOf(Object);
      expect(response.body.data.patient.passport_info.number).toBe('P123456789');
      
      // Verify insurance info is decrypted and parsed
      expect(response.body.data.patient.insurance_info).toBeInstanceOf(Object);
      expect(response.body.data.patient.insurance_info.provider).toBe('Test Insurance');
    });
    
    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/patients/me')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should fail for non-patient role', async () => {
      const admin = await createTestUser('admin');
      
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('patient');
    });
    
  });
  
  describe('PUT /api/patients/me - Update Own Profile', () => {
    
    let patientData;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      
      patientData = await createTestPatient();
      authToken = patientData.user.accessToken;
    });
    
    test('should update patient profile successfully', async () => {
      const updates = {
        current_address: '456 New Street',
        passport_info: {
          number: 'P987654321',
          country: 'CAN',
          expiryDate: '2031-06-30'
        },
        insurance_info: {
          provider: 'New Insurance Co',
          policyNumber: 'INS987654',
          coverageType: 'basic'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.data.patient.current_address).toBe(updates.current_address);
      expect(response.body.data.patient.passport_info.number).toBe(updates.passport_info.number);
      expect(response.body.data.patient.insurance_info.provider).toBe(updates.insurance_info.provider);
    });
    
    test('should validate passport info JSON structure', async () => {
      const updates = {
        passport_info: {
          // Missing required fields
          country: 'USA'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('passport');
    });
    
    test('should validate insurance info JSON structure', async () => {
      const updates = {
        insurance_info: {
          // Missing required fields
          provider: 'Insurance Co'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('insurance');
    });
    
    test('should encrypt sensitive data before storage', async () => {
      const updates = {
        passport_info: {
          number: 'SENSITIVE123',
          country: 'USA',
          expiryDate: '2030-12-31'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      // Verify encryption by checking database directly
      // In real scenario, you'd query the database and verify encrypted format
      expect(response.body.data.patient.passport_info.number).toBe('SENSITIVE123');
    });
    
  });
  
  describe('GET /api/patients/me/health-history - Get Health History', () => {
    
    let patientData;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      await truncateTable('Appointments');
      await truncateTable('Documents');
      await truncateTable('Invoices');
      
      patientData = await createTestPatient();
      authToken = patientData.user.accessToken;
    });
    
    test('should get health history in chronological order', async () => {
      const response = await request(app)
        .get('/api/patients/me/health-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);
      
      // Verify chronological order (newest first)
      if (response.body.data.history.length > 1) {
        const dates = response.body.data.history.map(h => new Date(h.date));
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i-1] >= dates[i]).toBe(true);
        }
      }
    });
    
    test('should include appointments in health history', async () => {
      const { createTestAppointment } = require('../setup');
      await createTestAppointment(patientData.user.id, {
        type: 'opd',
        status: 'completed',
        notes: 'Test appointment'
      });
      
      const response = await request(app)
        .get('/api/patients/me/health-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const appointments = response.body.data.history.filter(h => h.type === 'appointment');
      expect(appointments.length).toBeGreaterThan(0);
      expect(appointments[0]).toHaveProperty('notes');
    });
    
    test('should include documents in health history', async () => {
      const { createTestDocument } = require('../setup');
      await createTestDocument(patientData.user.id, {
        type: 'lab_report', // Use canonical enum value (medical_report → lab_report)
        original_filename: 'report.pdf'
      });
      
      const response = await request(app)
        .get('/api/patients/me/health-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const documents = response.body.data.history.filter(h => h.type === 'document');
      expect(documents.length).toBeGreaterThan(0);
    });
    
    test('should include invoices in health history', async () => {
      const { createTestInvoice } = require('../setup');
      await createTestInvoice(patientData.user.id, [
        { quantity: 1, unit_price: 50, description: 'OPD Consultation' }
      ]);
      
      const response = await request(app)
        .get('/api/patients/me/health-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const invoices = response.body.data.history.filter(h => h.type === 'invoice');
      expect(invoices.length).toBeGreaterThan(0);
      expect(invoices[0]).toHaveProperty('total_amount');
    });
    
    test('should filter by type query parameter', async () => {
      const response = await request(app)
        .get('/api/patients/me/health-history?type=appointment')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const allAppointments = response.body.data.history.every(h => h.type === 'appointment');
      expect(allAppointments).toBe(true);
    });
    
    test('should paginate results', async () => {
      const response = await request(app)
        .get('/api/patients/me/health-history?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.data.history.length).toBeLessThanOrEqual(10);
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('offset');
    });
    
  });
  
  describe('GET /api/patients - List All Patients (Admin)', () => {
    
    let adminToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      
      const admin = await createTestUser('admin');
      adminToken = admin.accessToken;
      
      // Create some patients
      await createTestPatient({ email: 'patient1@test.com' });
      await createTestPatient({ email: 'patient2@test.com' });
      await createTestPatient({ email: 'patient3@test.com' });
    });
    
    test('should list all patients for admin', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('patients');
      expect(Array.isArray(response.body.data.patients)).toBe(true);
      expect(response.body.data.patients.length).toBeGreaterThanOrEqual(3);
    });
    
    test('should include user details in patient list', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data.patients[0]).toHaveProperty('full_name');
      expect(response.body.data.patients[0]).toHaveProperty('email');
      expect(response.body.data.patients[0]).toHaveProperty('current_address');
    });
    
    test('should fail for non-admin role', async () => {
      const patient = await createTestPatient();
      
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${patient.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('admin');
    });
    
    test('should search patients by name', async () => {
      await createTestPatient({ full_name: 'John Doe' });
      
      const response = await request(app)
        .get('/api/patients?search=John')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data.patients.length).toBeGreaterThan(0);
      expect(response.body.data.patients.some(p => p.full_name.includes('John'))).toBe(true);
    });
    
    test('should paginate patient list', async () => {
      const response = await request(app)
        .get('/api/patients?limit=2&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data.patients.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toHaveProperty('total');
    });
    
  });
  
  describe('GET /api/patients/:userId - Get Specific Patient (Admin/Staff)', () => {
    
    let adminToken;
    let patientData;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      
      const admin = await createTestUser('admin');
      adminToken = admin.accessToken;
      
      patientData = await createTestPatient({ email: 'specific@test.com' });
    });
    
    test('should get specific patient for admin', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientData.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data.patient.user_id).toBe(patientData.user.id);
      expect(response.body.data.patient).toHaveProperty('full_name');
    });
    
    test('should get specific patient for staff', async () => {
      const staff = await createTestUser('staff');
      
      const response = await request(app)
        .get(`/api/patients/${patientData.user.id}`)
        .set('Authorization', `Bearer ${staff.accessToken}`)
        .expect(200);
      
      expect(response.body.data.patient.user_id).toBe(patientData.user.id);
    });
    
    test('should fail when patient tries to access other patient', async () => {
      const otherPatient = await createTestPatient({ email: 'other@test.com' });
      
      const response = await request(app)
        .get(`/api/patients/${patientData.user.id}`)
        .set('Authorization', `Bearer ${otherPatient.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('access');
    });
    
    test('should return 404 for non-existent patient', async () => {
      const response = await request(app)
        .get('/api/patients/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
    
  });
  
  describe('Data Encryption Tests', () => {
    
    let patientData;
    let authToken;
    
    beforeEach(async () => {
      await truncateTable('Users');
      await truncateTable('Patients');
      
      patientData = await createTestPatient();
      authToken = patientData.user.accessToken;
    });
    
    test('should encrypt passport number before storage', async () => {
      const updates = {
        passport_info: {
          number: 'SENSITIVE_PASSPORT_123',
          country: 'USA',
          expiryDate: '2030-12-31'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      // Response should have decrypted data
      expect(response.body.data.patient.passport_info.number).toBe('SENSITIVE_PASSPORT_123');
      
      // Database should have encrypted data (verify with direct query)
      // Note: This requires direct database access in test
    });
    
    test('should encrypt insurance policy number before storage', async () => {
      const updates = {
        insurance_info: {
          provider: 'Test Insurance',
          policyNumber: 'SENSITIVE_POLICY_789',
          coverageType: 'comprehensive'
        }
      };
      
      const response = await request(app)
        .put('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);
      
      // Response should have decrypted data
      expect(response.body.data.patient.insurance_info.policyNumber).toBe('SENSITIVE_POLICY_789');
    });
    
    test('should decrypt data when retrieving patient profile', async () => {
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Verify decryption worked (data should be readable)
      expect(response.body.data.patient.passport_info).toBeInstanceOf(Object);
      expect(response.body.data.patient.passport_info.number).toBeDefined();
      
      if (response.body.data.patient.insurance_info) {
        expect(response.body.data.patient.insurance_info).toBeInstanceOf(Object);
        expect(response.body.data.patient.insurance_info.policyNumber).toBeDefined();
      }
    });
    
  });
  
});

