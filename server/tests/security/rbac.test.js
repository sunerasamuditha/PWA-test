const request = require('supertest');
const app = require('../../src/app');
const { createTestUser, createTestPatient, createTestPartner, createTestStaff, truncateTable, executeQuery } = require('../setup');

describe('RBAC (Role-Based Access Control) Security Tests', () => {
  
  let patientUser, partnerUser, staffUser, adminUser, superAdminUser;
  let patientToken, partnerToken, staffToken, adminToken, superAdminToken;
  
  beforeEach(async () => {
    await truncateTable('Users');
    await truncateTable('Patients');
    await truncateTable('Partners');
    await truncateTable('Staff_Members');
    
    // Create users of each role
    const patient = await createTestPatient({ email: 'patient@test.com' });
    patientUser = patient.user;
    patientToken = patient.user.accessToken;
    
    const partner = await createTestPartner({ email: 'partner@test.com' });
    partnerUser = partner.user;
    partnerToken = partner.user.accessToken;
    
    const staff = await createTestStaff({ email: 'staff@test.com' });
    staffUser = staff.user;
    staffToken = staff.user.accessToken;
    
    adminUser = await createTestUser('admin', { email: 'admin@test.com' });
    adminToken = adminUser.accessToken;
    
    superAdminUser = await createTestUser('super_admin', { email: 'superadmin@test.com' });
    superAdminToken = superAdminUser.accessToken;
  });
  
  describe('Patient Role Access Control', () => {
    
    test('patient can view own profile', async () => {
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data.patient.userId).toBe(patientUser.id);
    });
    
    test('patient cannot view other patient profiles', async () => {
      const otherPatient = await createTestPatient({ email: 'other@test.com' });
      
      const response = await request(app)
        .get(`/api/patients/${otherPatient.user.id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('patient can create own appointments', async () => {
      const appointmentData = {
        appointment_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type: 'opd',
        notes: 'Test appointment'
      };
      
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);
      
      expect(response.body.data.appointment.patient_user_id).toBe(patientUser.id);
    });
    
    test('patient cannot access admin routes', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('admin');
    });
    
    test('patient can upload own documents', async () => {
      const testFile = Buffer.from('Test document');
      
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('type', 'passport')
        .attach('document', testFile, 'passport.pdf')
        .expect(201);
      
      expect(response.body.data.document.patientUserId).toBe(patientUser.id);
    });
    
    test('patient can view own invoices', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('invoices');
    });
    
    test('patient cannot create invoices', async () => {
      const invoiceData = {
        patient_user_id: patientUser.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(invoiceData)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Partner Role Access Control', () => {
    
    test('partner can view own profile', async () => {
      const response = await request(app)
        .get('/api/partners/me')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(response.body.data.partner.user_id).toBe(partnerUser.id);
    });
    
    test('partner can generate QR code', async () => {
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('qrCode'); // camelCase keys
      expect(response.body.data).toHaveProperty('referralUrl');
      expect(response.body.data).toHaveProperty('partnerUuid');
    });
    
    test('partner can view own referrals', async () => {
      const response = await request(app)
        .get('/api/partners/me/referrals')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('referrals');
    });
    
    test('partner cannot access patient data', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientUser.id}`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('partner cannot create invoices', async () => {
      const invoiceData = {
        patient_user_id: patientUser.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send(invoiceData)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('partner cannot access admin routes', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Staff Role Access Control', () => {
    
    test('staff can view assigned patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('patients');
    });
    
    test('staff can manage appointments', async () => {
      const appointmentData = {
        patient_user_id: patientUser.id,
        appointment_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type: 'opd',
        notes: 'Staff created'
      };
      
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(appointmentData)
        .expect(201);
      
      expect(response.body.data.appointment).toBeDefined();
    });
    
    test('staff can create invoices', async () => {
      const invoiceData = {
        patient_user_id: patientUser.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(201);
      
      expect(response.body.data.invoice).toBeDefined();
    });
    
    test('staff permissions validated', async () => {
      // Verify staff has correct permissions
      const [staffRecord] = await executeQuery(
        'SELECT permissions FROM Staff_Members WHERE user_id = ?',
        [staffUser.id]
      );
      
      const permissions = JSON.parse(staffRecord[0].permissions);
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });
    
    test('staff cannot delete users', async () => {
      const response = await request(app)
        .delete(`/api/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('staff cannot access super admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/system/health')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Admin Role Access Control', () => {
    
    test('admin can access all patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('patients');
    });
    
    test('admin can manage users', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'Test@123456',
        full_name: 'New User',
        phone_number: '1234567890',
        role: 'patient'
      };
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);
      
      expect(response.body.data.user).toBeDefined();
    });
    
    test('admin can view reports', async () => {
      const response = await request(app)
        .get('/api/admin/analytics/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('report');
    });
    
    test('admin can view audit logs', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('logs');
    });
    
    test('admin cannot delete audit logs (immutable)', async () => {
      const response = await request(app)
        .delete('/api/audit-logs/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Super Admin Role Access Control', () => {
    
    test('super admin has full access', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('patients');
    });
    
    test('super admin can delete users', async () => {
      const testUser = await createTestUser('patient', { email: 'deleteme@test.com' });
      
      const response = await request(app)
        .delete(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      
      expect(response.body.message).toContain('deleted');
    });
    
    test('super admin can modify any data', async () => {
      const updateData = {
        full_name: 'Updated Name',
        phone_number: '9999999999'
      };
      
      const response = await request(app)
        .put(`/api/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.data.user.full_name).toBe('Updated Name');
    });
    
    test('super admin cannot delete audit logs (immutable)', async () => {
      const response = await request(app)
        .delete('/api/audit-logs/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Role Escalation Prevention', () => {
    
    test('users cannot change their own role', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ role: 'admin' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('role');
    });
    
    test('role changes require admin authentication', async () => {
      const response = await request(app)
        .put(`/api/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ role: 'admin' })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('role changes are audit logged', async () => {
      await request(app)
        .put(`/api/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'staff' })
        .expect(200);
      
      const [logs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE action = ? AND target_entity = ? AND details LIKE ?',
        ['update', 'Users', `%${patientUser.id}%`]
      );
      
      expect(logs.length).toBeGreaterThan(0);
    });
    
  });
  
  describe('Resource Ownership Validation', () => {
    
    test('patient can only access own data via /me endpoint', async () => {
      const otherPatient = await createTestPatient({ email: 'other2@test.com' });
      
      // Patient should use /api/patients/me for self-access
      const response = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${otherPatient.user.accessToken}`)
        .expect(200);
      
      // Should return only own data
      expect(response.body.data.patient.user_id).toBe(otherPatient.user.id);
    });
    
    test('patient cannot access admin-only /api/patients list', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('user ID matches resource owner', async () => {
      const { createTestDocument } = require('../setup');
      const doc = await createTestDocument(patientUser.id);
      
      const otherPatient = await createTestPatient({ email: 'other3@test.com' });
      
      const response = await request(app)
        .get(`/api/documents/${doc.id}`)
        .set('Authorization', `Bearer ${otherPatient.user.accessToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Cross-Role Access Tests', () => {
    
    test('patient cannot access partner routes', async () => {
      const response = await request(app)
        .get('/api/partners/me/qrcode')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('partner cannot access staff routes', async () => {
      const response = await request(app)
        .get('/api/staff/shifts')
        .set('Authorization', `Bearer ${partnerToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('staff cannot access partner routes', async () => {
      const response = await request(app)
        .get(`/api/partners/${partnerUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
  });
  
  describe('Permission Granularity (Staff)', () => {
    
    test('staff with manage_appointments can create appointments', async () => {
      // Update staff permissions
      await executeQuery(
        'UPDATE Staff_Members SET permissions = ? WHERE user_id = ?',
        [JSON.stringify(['manage_appointments']), staffUser.id]
      );
      
      const appointmentData = {
        patient_user_id: patientUser.id,
        appointment_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        type: 'opd',
        notes: 'Test'
      };
      
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(appointmentData)
        .expect(201);
      
      expect(response.body.data.appointment).toBeDefined();
    });
    
    test('staff without manage_invoices cannot create invoices', async () => {
      // Update staff permissions (remove manage_invoices)
      await executeQuery(
        'UPDATE Staff_Members SET permissions = ? WHERE user_id = ?',
        [JSON.stringify(['view_patients']), staffUser.id]
      );
      
      const invoiceData = {
        patient_user_id: patientUser.id,
        invoice_type: 'opd',
        payment_method: 'cash',
        items: [{ description: 'Service', quantity: 1, unit_price: 50.00 }]
      };
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(invoiceData)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });
    
  });
  
  describe('Audit Logging for Sensitive Actions', () => {
    
    test('sensitive actions are audit logged', async () => {
      // Change user role (sensitive action)
      await request(app)
        .put(`/api/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'staff' })
        .expect(200);
      
      const [logs] = await executeQuery(
        'SELECT * FROM Audit_Logs WHERE user_id = ? AND action = ? AND target_entity = ?',
        [adminUser.id, 'update', 'Users']
      );
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].details).toContain(patientUser.id.toString());
    });
    
  });
  
  describe('Token and Role Edge Cases', () => {
    
    test('access continues with old role after role change until token refresh', async () => {
      // Patient user has active token
      const initialResponse = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      // Admin changes patient role to staff
      await request(app)
        .patch(`/api/admin/users/${patientUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'staff' })
        .expect(200);
      
      // Old token still has patient role - should still work for patient endpoints
      const afterChangeResponse = await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      // Verify user can still access with old token (role embedded in token)
      expect(afterChangeResponse.body.data).toBeDefined();
    });
    
    test('GET /api/audit-logs/me returns only current user logs', async () => {
      // Create some audit log data for patient
      await request(app)
        .get('/api/patients/me')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      // Fetch audit logs for current user
      const response = await request(app)
        .get('/api/audit-logs/me')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);
      
      // Verify all logs belong to current user
      if (response.body.data.logs && response.body.data.logs.length > 0) {
        const allBelongToUser = response.body.data.logs.every(
          log => log.user_id === patientUser.id
        );
        expect(allBelongToUser).toBe(true);
      }
    });
    
    test('unauthenticated request to /api/audit-logs/me returns 401', async () => {
      await request(app)
        .get('/api/audit-logs/me')
        .expect(401);
    });
    
    test('patient cannot access other users audit logs', async () => {
      // Try to access admin user's audit logs
      const response = await request(app)
        .get(`/api/audit-logs?user_id=${adminUser.id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('admin can access audit logs for any user', async () => {
      // Admin should be able to query logs for patient user
      const response = await request(app)
        .get(`/api/audit-logs?user_id=${patientUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      // Should return logs (might be empty array, but shouldn't error)
      expect(response.body).toHaveProperty('data');
    });
    
  });
  
});


