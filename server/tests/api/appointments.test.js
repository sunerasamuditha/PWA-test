const request = require('supertest');
const app = require('../../src/app');
const { executeQuery } = require('../../src/config/database');

describe('Appointment API Tests', () => {
  let tokens = {};
  let users = {};
  let testAppointment = null;

  beforeAll(async () => {
    // Get authentication tokens for different user types
    
    // Patient user
    const patientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'patient1@test.com',
        password: 'Patient123!@#'
      });
    
    tokens.patient = patientLogin.body.data.token;
    users.patient = patientLogin.body.data.user;

    // Another patient user for cross-owner tests
    const patient2Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'patient2@test.com',
        password: 'Patient123!@#'
      });
    
    tokens.patient2 = patient2Login.body.data.token;
    users.patient2 = patient2Login.body.data.user;

    // Staff user with manage_appointments permission
    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nurse1@test.com',
        password: 'Nurse123!@#'
      });
    
    tokens.staffWithPermission = staffLogin.body.data.token;
    users.staffWithPermission = staffLogin.body.data.user;

    // Staff user without manage_appointments permission (if exists)
    // For now, we'll assume all staff in test DB have the permission
    // In a real scenario, you'd create a staff user without this permission

    // Admin user
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Admin123!@#'
      });
    
    tokens.admin = adminLogin.body.data.token;
    users.admin = adminLogin.body.data.user;
  });

  beforeEach(async () => {
    // Create a fresh test appointment before each test
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    futureDate.setHours(10, 0, 0, 0); // 10:00 AM

    const response = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokens.patient}`)
      .send({
        patient_user_id: users.patient.id,
        appointment_datetime: futureDate.toISOString(),
        appointment_type: 'opd',
        notes: 'Test appointment for cancellation'
      });

    testAppointment = response.body.data;
  });

  afterEach(async () => {
    // Clean up test appointment if it still exists
    if (testAppointment && testAppointment.id) {
      try {
        await executeQuery(
          'DELETE FROM `Appointments` WHERE id = ?',
          [testAppointment.id]
        );
      } catch (error) {
        // Ignore errors if already deleted
      }
      testAppointment = null;
    }
  });

  describe('PUT /api/appointments/:id/cancel - Access Control', () => {
    
    test('Should allow patient to cancel their own scheduled appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.message).toBe('Appointment cancelled successfully');
    });

    test('Should prevent patient from cancelling someone else\'s appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient2}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/permission/i);
    });

    test('Should allow staff with manage_appointments to cancel any appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.staffWithPermission}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    test('Should allow admin to cancel any appointment', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.admin}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    test('Should return 404 when appointment does not exist', async () => {
      const nonExistentId = 999999;
      
      const response = await request(app)
        .put(`/api/appointments/${nonExistentId}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    test('Should require authentication', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/appointments/:id/cancel - Business Logic', () => {
    
    test('Should prevent cancelling already cancelled appointment', async () => {
      // First cancellation
      await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      // Attempt second cancellation
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already cancelled/i);
    });

    test('Should prevent cancelling completed appointment', async () => {
      // Update appointment to completed status (requires direct DB update for test)
      await executeQuery(
        'UPDATE `Appointments` SET status = ? WHERE id = ?',
        ['completed', testAppointment.id]
      );

      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/cannot cancel.*completed/i);
    });

    test('Should allow cancelling checked_in appointment', async () => {
      // Update appointment to checked_in status
      await executeQuery(
        'UPDATE `Appointments` SET status = ? WHERE id = ?',
        ['checked_in', testAppointment.id]
      );

      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('PUT /api/appointments/:id/cancel - Audit Logging', () => {
    
    test('Should create audit log entry when patient cancels own appointment', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      // Check if audit log was created
      const [auditLogs] = await executeQuery(
        'SELECT * FROM `AuditLogs` WHERE resource_type = ? AND resource_id = ? AND action = ? ORDER BY created_at DESC LIMIT 1',
        ['appointment', testAppointment.id, 'cancel']
      );

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].user_id).toBe(users.patient.id);
      expect(auditLogs[0].action).toBe('cancel');
    });

    test('Should create audit log entry when staff cancels appointment', async () => {
      await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.staffWithPermission}`);

      // Check if audit log was created
      const [auditLogs] = await executeQuery(
        'SELECT * FROM `AuditLogs` WHERE resource_type = ? AND resource_id = ? AND action = ? ORDER BY created_at DESC LIMIT 1',
        ['appointment', testAppointment.id, 'cancel']
      );

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].user_id).toBe(users.staffWithPermission.id);
      expect(auditLogs[0].action).toBe('cancel');
    });
  });

  describe('PUT /api/appointments/:id/cancel - Response Format', () => {
    
    test('Should return complete appointment data after cancellation', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: testAppointment.id,
        patientUserId: users.patient.id,
        status: 'cancelled',
        appointmentType: 'opd'
      });
      expect(response.body.data).toHaveProperty('appointmentDatetime');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('updatedAt');
    });

    test('Should not include notes field for patient responses', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.patient}`);

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('notes');
    });

    test('Should include notes field for staff responses', async () => {
      const response = await request(app)
        .put(`/api/appointments/${testAppointment.id}/cancel`)
        .set('Authorization', `Bearer ${tokens.staffWithPermission}`);

      expect(response.status).toBe(200);
      // Notes field should be present (even if null)
      expect('notes' in response.body.data).toBe(true);
    });
  });
});
